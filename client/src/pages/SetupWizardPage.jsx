/**
 * @file SetupWizardPage.jsx
 * @description Three-step interview setup wizard for RAC DRDO examiners:
 *  - STEP 1: Select Recruitment Post
 *  - STEP 2: Candidate Details & Competencies
 *  - STEP 3: Skill-Match Suitability Assessment & Session Launch
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  fetchPosts,
  createCandidate,
  saveCandidateSkills,
  computeSkillMatch,
  startInterview,
} from '../api/client';
import Gauge from '../components/Gauge';
import BandBadge from '../components/BandBadge';
import ChipInput from '../components/ChipInput';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast from '../components/Toast';
import Spinner from '../components/Spinner';
import ErrorState from '../components/ErrorState';
import DataTable from '../components/DataTable';

const EXPERIENCE_LEVELS = [
  { value: 'Junior (0-2 years)', label: 'Junior / Entry-Level (0-2 years)' },
  { value: 'Mid-Level (3-5 years)', label: 'Mid-Level Scientist / Engineer (3-5 years)' },
  { value: 'Senior (6+ years)', label: 'Senior Scientist / Specialist (6+ years)' },
  { value: 'Principal / Lead Scientist (10+ years)', label: 'Principal / Lead Scientist (10+ years)' },
];

export default function SetupWizardPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Wizard state: 1 = Post, 2 = Candidate, 3 = Skill Match
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Posts
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState(null);
  const [selectedPostId, setSelectedPostId] = useState(
    location.state?.selectedPostId || null
  );

  // Step 2: Candidate details
  const [candidateName, setCandidateName] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('Mid-Level (3-5 years)');
  const [candidateSkills, setCandidateSkills] = useState([]);
  const [candidateFormErrors, setCandidateFormErrors] = useState({});
  const [isSubmittingCandidate, setIsSubmittingCandidate] = useState(false);
  const [createdCandidate, setCreatedCandidate] = useState(null);

  // Step 3: Skill-match result
  const [skillMatchResult, setSkillMatchResult] = useState(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState(null);

  // Confirmation dialog for Weak / Mandatory Gap override
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [isLaunchingSession, setIsLaunchingSession] = useState(false);

  // Toast feedback
  const [toast, setToast] = useState(null);

  // Fetch posts on mount
  useEffect(() => {
    let isMounted = true;
    async function loadPosts() {
      setPostsLoading(true);
      setPostsError(null);
      try {
        const data = await fetchPosts();
        if (isMounted) {
          const list = Array.isArray(data) ? data : data?.posts || [];
          setPosts(list);
          // If preselected or only one post, select first by default
          if (!selectedPostId && list.length > 0) {
            setSelectedPostId(list[0].id);
          }
        }
      } catch (err) {
        if (isMounted) {
          setPostsError(err.message || 'Failed to retrieve recruitment posts.');
        }
      } finally {
        if (isMounted) {
          setPostsLoading(false);
        }
      }
    }

    loadPosts();
    return () => {
      isMounted = false;
    };
  }, []);

  const selectedPost = posts.find((p) => p.id === selectedPostId) || null;

  // Compute skill-match when entering step 3
  const runSkillMatch = async (candidateId, postId) => {
    setMatchLoading(true);
    setMatchError(null);
    try {
      const match = await computeSkillMatch({ candidateId, postId });
      setSkillMatchResult(match);
    } catch (err) {
      setMatchError(err.message || 'Failed to compute candidate skill match.');
    } finally {
      setMatchLoading(false);
    }
  };

  // Handler: Step 1 -> Step 2
  const handleProceedToCandidate = () => {
    if (!selectedPostId) {
      setToast({
        type: 'error',
        message: 'Please select a recruitment post before continuing.',
      });
      return;
    }
    setCurrentStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handler: Step 2 -> Step 3
  const handleProceedToSkillMatch = async (e) => {
    if (e) e.preventDefault();
    const errors = {};

    if (!candidateName.trim() || candidateName.trim().length < 2) {
      errors.name = 'Full candidate name is required (at least 2 characters).';
    }
    if (!experienceLevel) {
      errors.experience = 'Please select candidate experience tier.';
    }
    if (!candidateSkills || candidateSkills.length === 0) {
      errors.skills = 'Please enter at least one verified skill/competency.';
    }

    if (Object.keys(errors).length > 0) {
      setCandidateFormErrors(errors);
      setToast({
        type: 'error',
        message: 'Please review and fix the highlighted form errors.',
      });
      return;
    }

    setCandidateFormErrors({});
    setIsSubmittingCandidate(true);

    try {
      // 1. Create candidate record
      const postAppliedTitle = selectedPost ? selectedPost.title : 'Scientist ‘B’ / ASD';
      const candidate = await createCandidate({
        name: candidateName.trim(),
        postApplied: postAppliedTitle,
        experienceLevel,
      });

      // 2. Save candidate skills
      await saveCandidateSkills(candidate.id, candidateSkills);

      setCreatedCandidate(candidate);
      setCurrentStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // 3. Compute skill match
      await runSkillMatch(candidate.id, selectedPostId);
    } catch (err) {
      setToast({
        type: 'error',
        message: err.message || 'Failed to register candidate and competencies.',
      });
    } finally {
      setIsSubmittingCandidate(false);
    }
  };

  // Handler: Launch Interview Session
  const handleInitiateSession = async () => {
    if (!createdCandidate?.id) {
      setToast({
        type: 'error',
        message: 'Candidate record not found. Please complete Step 2 first.',
      });
      return;
    }

    // Check if examiner confirmation override is required
    const isWeak = skillMatchResult?.band === 'WEAK';
    const hasMandatoryGap = Boolean(skillMatchResult?.mandatoryGap);

    if ((isWeak || hasMandatoryGap) && !showOverrideDialog) {
      setShowOverrideDialog(true);
      return;
    }

    // Create session
    setIsLaunchingSession(true);
    try {
      const started = await startInterview({
        candidateId: createdCandidate.id,
        postId: selectedPostId,
      });
      const sessionId = started.sessionId;
      setToast({
        type: 'success',
        message: `Interview Session initiated successfully (ID: ${sessionId})`,
      });
      // Navigate to interview room
      setTimeout(() => {
        navigate(`/interview/${session.id}`, {
          state: {
            session,
            candidate: createdCandidate,
            post: selectedPost,
            skillMatch: skillMatchResult,
          },
        });
      }, 400);
    } catch (err) {
      setToast({
        type: 'error',
        message: err.message || 'Failed to initiate interview session.',
      });
      setIsLaunchingSession(false);
      setShowOverrideDialog(false);
    }
  };

  // Helper for match type badges in breakdown table
  const renderMatchTypeBadge = (matchType) => {
    const type = (matchType || 'none').toLowerCase();
    switch (type) {
      case 'exact':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            Exact Match
          </span>
        );
      case 'synonym':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            Synonym Match
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            Partial Match
          </span>
        );
      case 'none':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            No Match
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Toast notifications */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* Breadcrumb & Title */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
          <span>RAC DRDO BOARDROOM</span>
          <span>/</span>
          <span>ASSESSMENT SETUP</span>
          <span>/</span>
          <span className="text-gov-navy">NEW CANDIDATE INTERVIEW</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          New Interview Setup Wizard
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Standardized three-phase onboarding protocol for Scientist & Engineer technical assessment boards.
        </p>
      </div>

      {/* Stepper Indicator */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 mb-8 shadow-sm">
        <nav aria-label="Progress">
          <ol className="flex items-center justify-between sm:justify-start sm:gap-12">
            {/* Step 1 */}
            <li className="flex items-center">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="flex items-center gap-3 text-left focus:outline-none focus:ring-2 focus:ring-gov-navy rounded-lg p-1"
                aria-current={currentStep === 1 ? 'step' : undefined}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${currentStep === 1
                    ? 'bg-gov-navy text-white shadow-sm ring-4 ring-gov-navy/15'
                    : currentStep > 1
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-600'
                    }`}
                >
                  {currentStep > 1 ? (
                    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    '1'
                  )}
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Phase 1
                  </div>
                  <div
                    className={`text-sm font-bold ${currentStep === 1 ? 'text-gov-navy' : 'text-slate-800'
                      }`}
                  >
                    Select Post
                  </div>
                </div>
              </button>
            </li>

            <div className="hidden sm:block w-12 h-0.5 bg-slate-200" aria-hidden="true" />

            {/* Step 2 */}
            <li className="flex items-center">
              <button
                type="button"
                onClick={() => {
                  if (selectedPostId) setCurrentStep(2);
                }}
                disabled={!selectedPostId}
                className="flex items-center gap-3 text-left focus:outline-none focus:ring-2 focus:ring-gov-navy rounded-lg p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-current={currentStep === 2 ? 'step' : undefined}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${currentStep === 2
                    ? 'bg-gov-navy text-white shadow-sm ring-4 ring-gov-navy/15'
                    : currentStep > 2
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-600'
                    }`}
                >
                  {currentStep > 2 ? (
                    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    '2'
                  )}
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Phase 2
                  </div>
                  <div
                    className={`text-sm font-bold ${currentStep === 2 ? 'text-gov-navy' : 'text-slate-800'
                      }`}
                  >
                    Candidate Details
                  </div>
                </div>
              </button>
            </li>

            <div className="hidden sm:block w-12 h-0.5 bg-slate-200" aria-hidden="true" />

            {/* Step 3 */}
            <li className="flex items-center">
              <button
                type="button"
                disabled={!createdCandidate}
                className="flex items-center gap-3 text-left focus:outline-none focus:ring-2 focus:ring-gov-navy rounded-lg p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-current={currentStep === 3 ? 'step' : undefined}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${currentStep === 3
                    ? 'bg-gov-navy text-white shadow-sm ring-4 ring-gov-navy/15'
                    : 'bg-slate-200 text-slate-600'
                    }`}
                >
                  3
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Phase 3
                  </div>
                  <div
                    className={`text-sm font-bold ${currentStep === 3 ? 'text-gov-navy' : 'text-slate-800'
                      }`}
                  >
                    Skill Match & Suitability
                  </div>
                </div>
              </button>
            </li>
          </ol>
        </nav>
      </div>

      {/* ========================================================================= */}
      {/* STEP 1: SELECT POST                                                        */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <section aria-labelledby="step-1-heading" className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-2">
              <div>
                <h2 id="step-1-heading" className="text-xl font-bold text-slate-900">
                  Step 1: Select Recruitment Post
                </h2>
                <p className="text-sm text-slate-600 mt-0.5">
                  Choose the Defence Research vacancy profile against which candidate credentials will be evaluated.
                </p>
              </div>
              <div className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded border border-slate-200 self-start">
                Total Available Vacancies: {posts.length}
              </div>
            </div>

            {postsLoading ? (
              <div className="py-16 text-center">
                <Spinner size="lg" label="Retrieving posts from RAC question bank..." />
              </div>
            ) : postsError ? (
              <div className="py-8">
                <ErrorState
                  title="Failed to Load Vacancy Posts"
                  message={postsError}
                  onRetry={() => window.location.reload()}
                />
              </div>
            ) : posts.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                No active recruitment posts found in the database.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                {posts.map((post) => {
                  const isSelected = selectedPostId === post.id;
                  const skillsList = post.postSkills || [];
                  const mandatorySkills = skillsList.filter((s) => s.isMandatory);
                  const desirableSkills = skillsList.filter((s) => !s.isMandatory);

                  return (
                    <div
                      key={post.id}
                      onClick={() => setSelectedPostId(post.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedPostId(post.id);
                        }
                      }}
                      role="radio"
                      aria-checked={isSelected}
                      tabIndex={0}
                      className={`relative rounded-xl border p-5 cursor-pointer transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-gov-navy ${isSelected
                        ? 'border-gov-navy bg-slate-50/70 shadow-md ring-1 ring-gov-navy'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                        }`}
                    >
                      {/* Selection Checkmark */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                              {post.code || 'DRDO-RAC'}
                            </span>
                            {post.subject?.name && (
                              <span className="text-[11px] font-semibold text-slate-600">
                                Discipline: {post.subject.name}
                              </span>
                            )}
                          </div>
                          <h3 className="text-base font-bold text-slate-900 mt-1.5">
                            {post.title}
                          </h3>
                        </div>

                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${isSelected
                            ? 'border-gov-navy bg-gov-navy text-white'
                            : 'border-slate-300 bg-white'
                            }`}
                        >
                          {isSelected && (
                            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </div>
                      </div>

                      {post.description && (
                        <p className="text-xs text-slate-600 mt-2 line-clamp-2">
                          {post.description}
                        </p>
                      )}

                      {/* Required Skills breakdown */}
                      <div className="mt-4 pt-3 border-t border-slate-200">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center justify-between">
                          <span>Competency Requirements ({skillsList.length})</span>
                          <span className="text-rose-600 font-semibold lowercase">
                            {mandatorySkills.length} mandatory
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                          {skillsList.map((ps) => {
                            const skillName = ps.skill?.name || `Skill #${ps.skillId}`;
                            return (
                              <span
                                key={ps.id || ps.skillId}
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border ${ps.isMandatory
                                  ? 'bg-rose-50 text-rose-800 border-rose-200 font-semibold'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                                  }`}
                                title={`Weight: ${ps.weight || 1}${ps.isMandatory ? ' (Mandatory)' : ' (Desirable)'}`}
                              >
                                {skillName}
                                <span className="text-[10px] opacity-75 font-mono">
                                  W:{ps.weight || 1}
                                </span>
                                {ps.isMandatory && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" aria-label="Mandatory" />
                                )}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Step 1 Actions */}
            <div className="mt-8 pt-4 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                ← Return to Dashboard
              </button>

              <button
                type="button"
                disabled={!selectedPostId || postsLoading}
                onClick={handleProceedToCandidate}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold bg-gov-navy text-white hover:bg-gov-navy-light focus:outline-none focus:ring-2 focus:ring-gov-navy disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
              >
                <span>Continue to Candidate Details</span>
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: CANDIDATE DETAILS                                                  */}
      {/* ========================================================================= */}
      {currentStep === 2 && (
        <section aria-labelledby="step-2-heading" className="space-y-6">
          <form
            onSubmit={handleProceedToSkillMatch}
            className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm"
          >
            <div className="pb-4 border-b border-slate-200">
              <h2 id="step-2-heading" className="text-xl font-bold text-slate-900">
                Step 2: Candidate Details & Competencies
              </h2>
              <p className="text-sm text-slate-600 mt-0.5">
                Record applicant credentials and claimed competencies to compare against the post requirements.
              </p>
            </div>

            {/* Selected Post summary banner */}
            {selectedPost && (
              <div className="mt-5 p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs text-slate-700">
                <div>
                  <span className="font-bold text-slate-900 uppercase">Target Post: </span>
                  <span className="font-semibold text-gov-navy">{selectedPost.title}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="text-gov-navy hover:underline font-bold"
                >
                  Change Post
                </button>
              </div>
            )}

            <div className="mt-6 space-y-6">
              {/* Candidate Name */}
              <div>
                <label htmlFor="candidate-name" className="block text-sm font-bold text-slate-800 mb-1">
                  Candidate Full Name <span className="text-rose-600">*</span>
                </label>
                <input
                  id="candidate-name"
                  type="text"
                  value={candidateName}
                  onChange={(e) => {
                    setCandidateName(e.target.value);
                    if (candidateFormErrors.name) {
                      setCandidateFormErrors((prev) => ({ ...prev, name: null }));
                    }
                  }}
                  placeholder="e.g. Dr. Rajesh Sharma or Priya Nair"
                  className={`w-full px-3.5 py-2.5 rounded-lg border text-sm text-slate-900 focus:outline-none focus:ring-2 ${candidateFormErrors.name
                    ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/20'
                    : 'border-slate-300 focus:ring-gov-navy'
                    }`}
                  required
                />
                {candidateFormErrors.name && (
                  <p className="text-xs text-rose-600 font-medium mt-1">
                    {candidateFormErrors.name}
                  </p>
                )}
              </div>

              {/* Experience Tier Dropdown */}
              <div>
                <label htmlFor="experience-level" className="block text-sm font-bold text-slate-800 mb-1">
                  Experience Tier / Assessment Category <span className="text-rose-600">*</span>
                </label>
                <select
                  id="experience-level"
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-gov-navy"
                >
                  {EXPERIENCE_LEVELS.map((lvl) => (
                    <option key={lvl.value} value={lvl.value}>
                      {lvl.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Skills ChipInput */}
              <div>
                <ChipInput
                  chips={candidateSkills}
                  onChange={(newChips) => {
                    setCandidateSkills(newChips);
                    if (candidateFormErrors.skills && newChips.length > 0) {
                      setCandidateFormErrors((prev) => ({ ...prev, skills: null }));
                    }
                  }}
                  label="Candidate Competencies & Technical Skills"
                  placeholder="Type skill and press Enter or comma (e.g. Avionics, RTOS, Ada, DO-178C)..."
                  suggestions={
                    selectedPost?.postSkills
                      ?.map((ps) => ps.skill?.name)
                      .filter(Boolean) || []
                  }
                  error={candidateFormErrors.skills}
                />
              </div>
            </div>

            {/* Step 2 Actions */}
            <div className="mt-8 pt-5 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                ← Back to Post Selection
              </button>

              <button
                type="submit"
                disabled={isSubmittingCandidate}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold bg-gov-navy text-white hover:bg-gov-navy-light focus:outline-none focus:ring-2 focus:ring-gov-navy disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
              >
                {isSubmittingCandidate ? (
                  <>
                    <Spinner size="sm" color="text-white" label="Saving profile..." />
                    <span>Analyzing Competencies...</span>
                  </>
                ) : (
                  <>
                    <span>Proceed to Skill Match</span>
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: SKILL MATCH & SUITABILITY                                          */}
      {/* ========================================================================= */}
      {currentStep === 3 && (
        <section aria-labelledby="step-3-heading" className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-3">
              <div>
                <h2 id="step-3-heading" className="text-xl font-bold text-slate-900">
                  Step 3: Skill-Match Suitability Assessment
                </h2>
                <p className="text-sm text-slate-600 mt-0.5">
                  Automated offline semantic matching against vacancy requirements. Evaluates eligibility and competence gaps.
                </p>
              </div>

              {createdCandidate && (
                <div className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-700">
                  <div className="font-bold text-slate-900">{createdCandidate.name}</div>
                  <div className="text-slate-500">{createdCandidate.experienceLevel}</div>
                </div>
              )}
            </div>

            {matchLoading ? (
              <div className="py-20 text-center">
                <Spinner size="lg" label="Computing skill alignment against question bank..." />
                <p className="text-xs text-slate-500 mt-2">
                  Applying normalizer and synonym dictionary...
                </p>
              </div>
            ) : matchError ? (
              <div className="py-8">
                <ErrorState
                  title="Skill Match Computation Failed"
                  message={matchError}
                  onRetry={() => runSkillMatch(createdCandidate.id, selectedPostId)}
                />
              </div>
            ) : skillMatchResult ? (
              <div className="mt-6 space-y-6">
                {/* D. Mandatory Gap Warning Banner */}
                {skillMatchResult.mandatoryGap && (
                  <div
                    role="alert"
                    className="p-4 bg-rose-50 border-l-4 border-rose-600 rounded-r-lg text-rose-900 flex items-start gap-3 shadow-sm"
                  >
                    <svg className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div className="text-sm">
                      <div className="font-extrabold uppercase tracking-wide text-rose-900">
                        Critical Notice: Mandatory Competency Gap Detected
                      </div>
                      <p className="mt-1 text-rose-800">
                        The candidate does not satisfy one or more mandatory technical requirements for this post:
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(skillMatchResult.missingMandatory || []).map((skill, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-200 text-rose-900"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-rose-700 italic">
                        Boardroom protocol permits an examiner override. You may continue to launch the interview if approved by the presiding officer.
                      </p>
                    </div>
                  </div>
                )}

                {/* Top Section: Semicircular Gauge & Summary Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* A. Semicircular Gauge Card */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-center">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                      Weighted Suitability Score
                    </h3>
                    <Gauge
                      matchPercent={skillMatchResult.matchPercent}
                      band={skillMatchResult.band}
                      size={210}
                    />
                    <div className="mt-3">
                      <BandBadge band={skillMatchResult.band} size="lg" />
                    </div>
                  </div>

                  {/* C. Strengths & Gaps Lists */}
                  <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Strengths */}
                    <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center">
                          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                        <h4 className="text-sm font-bold text-emerald-900">
                          Identified Strengths ({skillMatchResult.strengths?.length || 0})
                        </h4>
                      </div>

                      {skillMatchResult.strengths && skillMatchResult.strengths.length > 0 ? (
                        <ul className="space-y-1.5 text-xs text-emerald-900">
                          {skillMatchResult.strengths.map((str, idx) => (
                            <li key={idx} className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                              <span className="font-semibold">{str}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-500 italic">
                          No significant skill alignments detected.
                        </p>
                      )}
                    </div>

                    {/* Skill Gaps */}
                    <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center">
                          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                            <path
                              fillRule="evenodd"
                              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                        <h4 className="text-sm font-bold text-amber-900">
                          Competency Gaps ({skillMatchResult.gaps?.length || 0})
                        </h4>
                      </div>

                      {skillMatchResult.gaps && skillMatchResult.gaps.length > 0 ? (
                        <ul className="space-y-1.5 text-xs text-amber-900">
                          {skillMatchResult.gaps.map((gap, idx) => (
                            <li key={idx} className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0" />
                              <span className="font-medium">{gap}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-emerald-700 italic font-medium">
                          All required skills satisfied. No competency gaps detected.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* B. Per-skill Breakdown Table */}
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-bold text-slate-900">
                      Detailed Competency Alignment Breakdown
                    </h3>
                    <span className="text-xs text-slate-500 font-medium">
                      Evaluated against normalizer & synonym dictionary
                    </span>
                  </div>

                  <DataTable
                    caption="Candidate skill alignment breakdown per vacancy requirement"
                    data={skillMatchResult.breakdown || []}
                    keyExtractor={(row, i) => `${row.requiredSkill}-${i}`}
                    columns={[
                      {
                        header: 'Required Skill',
                        accessor: 'requiredSkill',
                        className: 'font-bold text-slate-900',
                      },
                      {
                        header: 'Weight',
                        accessor: 'weight',
                        headerClassName: 'text-center',
                        className: 'text-center font-mono text-xs',
                        render: (row) => (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold">
                            {row.weight || 1}
                          </span>
                        ),
                      },
                      {
                        header: 'Requirement Tier',
                        accessor: 'isMandatory',
                        headerClassName: 'text-center',
                        className: 'text-center',
                        render: (row) => (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${row.isMandatory
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : 'bg-slate-100 text-slate-700'
                              }`}
                          >
                            {row.isMandatory ? 'Mandatory' : 'Desirable'}
                          </span>
                        ),
                      },
                      {
                        header: 'Best Candidate Skill',
                        accessor: 'bestCandidateSkill',
                        className: 'text-xs text-slate-700',
                        render: (row) =>
                          row.bestCandidateSkill ? (
                            <span className="font-medium text-slate-900">
                              {row.bestCandidateSkill}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">None</span>
                          ),
                      },
                      {
                        header: 'Score',
                        accessor: 'score',
                        headerClassName: 'text-center',
                        className: 'text-center font-mono font-bold text-xs',
                        render: (row) => {
                          const pct = Math.round((row.score || 0) * 100);
                          return <span>{pct}%</span>;
                        },
                      },
                      {
                        header: 'Match Type',
                        accessor: 'matchType',
                        headerClassName: 'text-center',
                        className: 'text-center',
                        render: (row) => renderMatchTypeBadge(row.matchType),
                      },
                    ]}
                  />
                </div>

                {/* E. Action Buttons: Start Interview always enabled */}
                <div className="mt-8 pt-5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    ← Back to Candidate Details
                  </button>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleInitiateSession}
                      disabled={isLaunchingSession}
                      className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg text-sm font-extrabold bg-gov-navy text-white hover:bg-gov-navy-light focus:outline-none focus:ring-2 focus:ring-gov-navy shadow-md transition-colors"
                    >
                      {isLaunchingSession ? (
                        <>
                          <Spinner size="sm" color="text-white" label="Initiating..." />
                          <span>Preparing Boardroom Session...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5 text-gov-gold" viewBox="0 0 20 20" fill="currentColor">
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span>Start Interview Session</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Examiner Override Confirmation Dialog */}
          <ConfirmDialog
            isOpen={showOverrideDialog}
            title="Examiner Boardroom Override Confirmation"
            variant="warning"
            loading={isLaunchingSession}
            confirmText="Override & Initiate Interview"
            cancelText="Review Profile"
            onCancel={() => setShowOverrideDialog(false)}
            onConfirm={async () => {
              setShowOverrideDialog(false);
              await handleInitiateSession();
            }}
            message={
              <div className="space-y-2 text-sm text-slate-700">
                <p>
                  The candidate suitability evaluation returned a{' '}
                  <strong className="text-rose-700">
                    {skillMatchResult?.band || 'WEAK'}
                  </strong>{' '}
                  classification
                  {skillMatchResult?.mandatoryGap && ' and lacks mandatory competencies'}.
                </p>
                <p className="bg-amber-50 p-2.5 rounded border border-amber-200 text-xs text-amber-900 font-medium">
                  <strong>DRDO Assessment Rule:</strong> Under committee discretion, the board may override automated screening and conduct an in-depth interview to independently assess foundational competencies.
                </p>
                <p>Do you wish to proceed and initiate the live assessment session?</p>
              </div>
            }
          />
        </section>
      )}
    </div>
  );
}

