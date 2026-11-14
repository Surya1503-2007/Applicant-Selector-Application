/**
 * @file InterviewRoomPage.jsx
 * @description Boardroom interview interface for RAC DRDO candidate assessment (/interview/:sessionId).
 *
 * Implements:
 *  - Header with candidate & post metadata, phase badge, question counter, elapsed timer, and Examiner Mode toggle.
 *  - Refresh-safe question card with "Let me put that more simply" tag for simplified follow-ups.
 *  - Candidate view (DEFAULT): strictly sanitized with zero scoring, verdict, difficulty, or decision disclosure.
 *  - Examiner side panel: full explainability, TF-IDF metrics, matched/missing keywords, decision log, difficulty strip.
 *  - Early termination modal with examiner reason input.
 *  - Safe navigation guards and double-submission protection.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  fetchInterviewQuestion,
  submitAnswer,
  terminateInterviewEarly,
  injectExpertQuestion,
  previewQuestionRelevancy,
} from '../api/client';
import VerdictBadge from '../components/VerdictBadge';
import ScoreBadge from '../components/ScoreBadge';
import ProgressStrip from '../components/ProgressStrip';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast from '../components/Toast';
import Spinner from '../components/Spinner';
import ErrorState from '../components/ErrorState';

export default function InterviewRoomPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Load examiner mode preference from localStorage (UI-only for this phase)
  // TODO: In a future phase, Examiner Mode access MUST be secured with role-based authentication/authorization (e.g. JWT/RBAC).
  const [isExaminerMode, setIsExaminerMode] = useState(() => {
    try {
      return localStorage.getItem('rac_examiner_mode') === 'true';
    } catch {
      return false;
    }
  });

  // State
  const [questionData, setQuestionData] = useState(null);
  const [loadingQuestion, setLoadingQuestion] = useState(true);
  const [questionError, setQuestionError] = useState(null);

  // Answer form
  const [answerText, setAnswerText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [transitionMessage, setTransitionMessage] = useState('');

  // Examiner-only telemetry from last response
  const [lastAnswerDetails, setLastAnswerDetails] = useState(null);
  const [difficultyProgression, setDifficultyProgression] = useState([]);

  // Elapsed timer state (in seconds)
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Early termination modal state
  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [terminationReason, setTerminationReason] = useState('');
  const [isTerminating, setIsTerminating] = useState(false);

  // Expert question injection modal state (Part 7C)
  const [showExpertModal, setShowExpertModal] = useState(false);
  const [expertQuestionText, setExpertQuestionText] = useState('');
  const [expertDifficulty, setExpertDifficulty] = useState('MEDIUM');
  const [expertIdealAnswer, setExpertIdealAnswer] = useState('');
  const [expertKeywords, setExpertKeywords] = useState('');
  const [isInjectingExpert, setIsInjectingExpert] = useState(false);
  const [expertPreview, setExpertPreview] = useState(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  // Leave interview confirmation dialog
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  // Toast feedback
  const [toast, setToast] = useState(null);

  // Double-submission guard ref
  const submitLockRef = useRef(false);

  // Persist examiner mode preference
  const toggleExaminerMode = () => {
    setIsExaminerMode((prev) => {
      const nextVal = !prev;
      try {
        localStorage.setItem('rac_examiner_mode', String(nextVal));
      } catch (_) { }
      return nextVal;
    });
  };

  // Live timer interval
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format seconds to mm:ss
  const formatTimer = (totalSecs) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Word counter helper
  const wordCount = answerText.trim() ? answerText.trim().split(/\s+/).length : 0;

  // Load question on mount
  const loadQuestion = async () => {
    setLoadingQuestion(true);
    setQuestionError(null);
    try {
      const data = await fetchInterviewQuestion(sessionId);

      // Check if session completed
      if (data.isComplete || data.interviewComplete) {
        navigate(`/interview/${sessionId}/done`, { replace: true });
        return;
      }

      setQuestionData(data);
      if (data.lastAnswerDetails) {
        setLastAnswerDetails(data.lastAnswerDetails);
      }
      if (data.difficultyProgression) {
        setDifficultyProgression(data.difficultyProgression);
      }
    } catch (err) {
      setQuestionError(err.message || 'Failed to retrieve assessment question.');
    } finally {
      setLoadingQuestion(false);
    }
  };

  useEffect(() => {
    loadQuestion();
  }, [sessionId]);

  // Window unload confirmation warning
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'An interview session is actively in progress. Are you sure you wish to leave?';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Handle Answer Submission
  const handleSubmitAnswer = async (e) => {
    if (e) e.preventDefault();

    // Prevent double submission
    if (submitLockRef.current || isSubmitting) return;

    if (!questionData?.question?.id) {
      setToast({ type: 'error', message: 'No active question found to answer.' });
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);
    setTransitionMessage('Thank you. Next question...');

    try {
      // 1. Submit the answer. The server scores it, runs the adaptive engine and
      //    returns the next question in the same response.
      const result = await submitAnswer({
        sessionId,
        answerText: answerText.trim(),
      });

      // Update examiner telemetry from the server's scoring and engine decision
      if (result?.scoring) {
        const s = result.scoring;
        setLastAnswerDetails({
          relevancy: s.relevancy,
          correctness: s.correctness,
          answerScore: s.answerScore,
          verdict: s.verdict,
          flags: s.breakdown?.flags || [],
          matchedKeywords: s.breakdown?.matchedKeywords || [],
          missingKeywords: s.breakdown?.missingKeywords || [],
          engineDecision: {
            action: result.decision?.action || 'N/A',
            reason: result.decision?.reason || '',
            currentTopic: questionData.question?.topicName || 'Technical',
            currentDifficulty: questionData.question?.difficulty || 'EASY',
          },
        });
      }

      // 2. Interview finished: go to the completion screen
      if (result?.interviewComplete) {
        setTimeout(() => {
          navigate(`/interview/${sessionId}/done`, { replace: true });
        }, 600);
        return;
      }

      // 3. Show the next question straight from the response (no second fetch)
      if (result?.nextQuestion) {
        setQuestionData((prev) => ({
          ...prev,
          // nextQuestion is the sanitized question object; adjust if it is wrapped
          question: result.nextQuestion.question ?? result.nextQuestion,
        }));
        setAnswerText('');
      }
    } catch (err) {
      setSubmitError(err.message || 'Failed to submit response. Please retry.');
      setTransitionMessage('');
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
      setTimeout(() => setTransitionMessage(''), 1500);
    }
  };

  // Handle Early Termination
  const handleTerminateEarly = async () => {
    if (!terminationReason.trim()) {
      setToast({ type: 'error', message: 'Please provide a justification reason for early termination.' });
      return;
    }

    setIsTerminating(true);
    try {
      await terminateInterviewEarly(sessionId, terminationReason.trim());
      setShowTerminateModal(false);
      navigate(`/interview/${sessionId}/done`, {
        replace: true,
        state: { terminatedEarly: true, reason: terminationReason.trim() },
      });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to terminate session.' });
      setIsTerminating(false);
    }
  };

  // Safe navigation back to dashboard
  const handleLeaveInterview = () => {
    setShowLeaveDialog(true);
  };

  const candidateInfo = questionData?.candidate || location.state?.candidate || {
    name: 'Candidate Under Assessment',
    postApplied: 'Scientist ‘B’ / ASD',
  };

  const currentQ = questionData?.question;
  const isIcebreaker = questionData?.phase === 'Icebreaker';
  const questionNumber = questionData?.questionNumber || 1;
  const totalQuestions = questionData?.totalQuestions || 10;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Toast notifications */}
      {toast && (
        <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />
      )}

      {/* ========================================================================= */}
      {/* A. BOARDROOM INTERVIEW ROOM HEADER                                         */}
      {/* ========================================================================= */}
      <header className="bg-gov-navy text-white shadow-md border-b-2 border-gov-gold select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            {/* Candidate & Post Identifiers */}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-300">
                  DRDO ASSESSMENT BOARDROOM
                </span>
                <span className="w-1 h-1 rounded-full bg-gov-gold" />
                <span className="text-[10px] font-mono text-gov-gold uppercase">
                  ACTIVE CHAMBER
                </span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-white">
                  {candidateInfo.name}
                </h1>
                <span className="text-xs text-slate-300 font-medium">
                  • {candidateInfo.postApplied}
                </span>
              </div>
            </div>

            {/* Badges, Timer & Examiner Mode Toggle */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Phase Badge */}
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider ${isIcebreaker
                  ? 'bg-blue-900/60 text-blue-200 border border-blue-400/40'
                  : 'bg-emerald-900/60 text-emerald-200 border border-emerald-400/40'
                  }`}
              >
                {questionData?.phase || 'Technical'} Phase
              </span>

              {/* Question Counter */}
              <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-mono font-bold bg-slate-800 text-slate-200 border border-slate-700">
                Question {questionNumber} of {totalQuestions}
              </span>

              {/* Elapsed Timer */}
              <div
                className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-bold bg-slate-900 text-gov-gold border border-gov-gold/30"
                title="Elapsed interview time"
              >
                <svg className="w-3.5 h-3.5 text-gov-gold animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 60" />
                </svg>
                <span>{formatTimer(elapsedSeconds)}</span>
              </div>

              {/* Examiner Mode Toggle (UI-level toggle) */}
              {/* TODO: Authenticate examiner credentials in future phase */}
              <button
                type="button"
                onClick={toggleExaminerMode}
                className={`flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold transition-all border ${isExaminerMode
                  ? 'bg-gov-gold text-gov-navy border-gov-gold shadow-sm font-extrabold ring-2 ring-gov-gold/30'
                  : 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700'
                  }`}
                title="Toggle Examiner Telemetry Side Panel"
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path
                    fillRule="evenodd"
                    d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Examiner Mode {isExaminerMode ? 'ON' : 'OFF'}</span>
              </button>

              {/* End Interview Early Button */}
              <button
                type="button"
                onClick={() => setShowTerminateModal(true)}
                className="px-2.5 py-1 text-xs font-semibold text-rose-300 hover:text-rose-100 hover:bg-rose-900/40 rounded border border-rose-500/30 transition-colors"
                title="Conclude interview early with examiner rationale"
              >
                End Early
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loadingQuestion && !questionData ? (
          <div className="py-24 text-center">
            <Spinner size="lg" label="Preparing assessment chamber question..." />
            <p className="text-xs text-slate-500 mt-2">
              Syncing interview session state with RAC question bank...
            </p>
          </div>
        ) : questionError ? (
          <div className="py-12">
            <ErrorState
              title="Interview Room Error"
              message={questionError}
              onRetry={loadQuestion}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ========================================================================= */}
            {/* D. CANDIDATE VIEW (DEFAULT): CENTER STAGE                                 */}
            {/* CRITICAL SECURITY REQUIREMENT: NO SCORES, NO VERDICTS, NO TELEMETRY LEAK */}
            {/* ========================================================================= */}
            <div className={`${isExaminerMode ? 'lg:col-span-7' : 'lg:col-span-10 lg:col-start-2'} space-y-6`}>
              {/* Question Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
                      Question #{questionNumber}
                    </span>
                    {/* CRITICAL: ONLY show topic/difficulty if Examiner Mode is active! */}
                    {isExaminerMode && currentQ?.topicName && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        Topic: {currentQ.topicName}
                      </span>
                    )}
                  </div>

                  {/* Re-asked / Simplified question label */}
                  {currentQ?.isSimplified && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                      Let me put that more simply
                    </span>
                  )}
                </div>

                {/* Question Text */}
                <div className="mt-5">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-relaxed">
                    {currentQ?.questionText}
                  </h2>
                </div>
              </div>

              {/* Answer Section */}
              <form
                onSubmit={handleSubmitAnswer}
                className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm space-y-4"
              >
                <div className="flex items-center justify-between">
                  <label htmlFor="answer-input" className="block text-sm font-bold text-slate-800">
                    Candidate Free-Text Response
                  </label>
                  <span className="text-xs font-mono text-slate-500">
                    Word Count: <strong className="text-slate-800">{wordCount}</strong> words
                  </span>
                </div>

                <textarea
                  id="answer-input"
                  rows={7}
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="Articulate your technical rationale, system principles, and analytical conclusions here..."
                  className="w-full p-4 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-gov-navy focus:border-transparent font-sans resize-y disabled:bg-slate-100 disabled:cursor-not-allowed"
                  required
                />

                {submitError && (
                  <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-xs text-rose-800 font-medium">
                    {submitError}
                  </div>
                )}

                {/* Neutral transition message */}
                {transitionMessage && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs font-semibold text-blue-800 flex items-center gap-2">
                    <Spinner size="sm" color="text-blue-800" label="Processing answer..." />
                    <span>{transitionMessage}</span>
                  </div>
                )}

                {/* Form Actions */}
                <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleLeaveInterview}
                    className="text-xs text-slate-500 hover:text-slate-800 font-semibold focus:outline-none"
                  >
                    ← Exit Interview Chamber
                  </button>

                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={isSubmitting || !answerText.trim()}
                      className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold bg-gov-navy text-white hover:bg-gov-navy-light focus:outline-none focus:ring-2 focus:ring-gov-navy disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                    >
                      {isSubmitting ? (
                        <>
                          <Spinner size="sm" color="text-white" label="Evaluating..." />
                          <span>Recording Response...</span>
                        </>
                      ) : (
                        <>
                          <span>Submit & Proceed to Next</span>
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
                </div>
              </form>
            </div>

            {/* ========================================================================= */}
            {/* E. EXAMINER TELEMETRY SIDE PANEL                                          */}
            {/* ONLY VISIBLE WHEN isExaminerMode === true                                 */}
            {/* ========================================================================= */}
            {isExaminerMode && (
              <aside
                aria-label="Examiner Telemetry Panel"
                className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5"
              >
                <div className="pb-3 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-gov-gold animate-pulse" />
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-900">
                      Examiner Telemetry Console
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                    BOARD EYES ONLY
                  </span>
                </div>

                {/* Difficulty Progression Strip */}
                <ProgressStrip
                  steps={difficultyProgression}
                  currentStep={questionNumber}
                  totalSteps={totalQuestions}
                />

                {/* Active Question Metadata */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2 text-xs">
                  <div className="font-bold uppercase tracking-wider text-slate-600 text-[11px]">
                    Current Question Profiler
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-700">
                    <div>
                      <span className="text-slate-500">Domain Topic:</span>
                      <div className="font-bold text-slate-900">{currentQ?.topicName || 'General'}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Difficulty Tier:</span>
                      <div className="font-mono font-bold text-gov-navy">{currentQ?.difficulty || 'EASY'}</div>
                    </div>
                  </div>
                </div>

                {/* Last Submitted Answer Evaluation Telemetry */}
                {lastAnswerDetails ? (
                  <div className="border border-slate-200 rounded-lg p-4 space-y-4 bg-slate-50/70">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-700">
                        Previous Answer Scoring
                      </span>
                      <VerdictBadge verdict={lastAnswerDetails.verdict} size="sm" />
                    </div>

                    {/* Numeric Scores */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-white p-2 rounded border border-slate-200">
                        <div className="text-[10px] font-bold text-slate-500 uppercase">Relevancy</div>
                        <div className="text-sm font-mono font-extrabold text-slate-900 mt-0.5">
                          {Math.round((lastAnswerDetails.relevancy || 0) * 100)}%
                        </div>
                      </div>
                      <div className="bg-white p-2 rounded border border-slate-200">
                        <div className="text-[10px] font-bold text-slate-500 uppercase">Correctness</div>
                        <div className="text-sm font-mono font-extrabold text-slate-900 mt-0.5">
                          {Math.round((lastAnswerDetails.correctness || 0) * 100)}%
                        </div>
                      </div>
                      <div className="bg-white p-2 rounded border border-slate-200">
                        <div className="text-[10px] font-bold text-slate-500 uppercase">Weighted Score</div>
                        <div className="text-sm font-mono font-extrabold text-gov-navy mt-0.5">
                          {Math.round((lastAnswerDetails.answerScore || 0) * 100)}%
                        </div>
                      </div>
                    </div>

                    {/* Engine Decision & Reason */}
                    {lastAnswerDetails.engineDecision && (
                      <div className="bg-blue-50 border border-blue-200 rounded p-2.5 text-xs text-blue-900 space-y-1">
                        <div className="font-bold flex items-center justify-between">
                          <span>Adaptive Engine Action:</span>
                          <span className="font-mono text-[10px] uppercase bg-blue-200 px-1.5 py-0.2 rounded">
                            {lastAnswerDetails.engineDecision.action}
                          </span>
                        </div>
                        <p className="text-[11px] text-blue-800 leading-relaxed">
                          {lastAnswerDetails.engineDecision.reason}
                        </p>
                      </div>
                    )}

                    {/* Keywords Breakdown */}
                    <div className="space-y-2 text-xs">
                      <div>
                        <div className="font-bold text-emerald-800 text-[11px] mb-1">
                          Matched Keywords ({lastAnswerDetails.matchedKeywords?.length || 0})
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {(lastAnswerDetails.matchedKeywords || []).map((kw, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-medium">
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="font-bold text-rose-800 text-[11px] mb-1">
                          Missing Keywords ({lastAnswerDetails.missingKeywords?.length || 0})
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {(lastAnswerDetails.missingKeywords || []).map((kw, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-medium">
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Flags */}
                    {lastAnswerDetails.flags && lastAnswerDetails.flags.length > 0 && (
                      <div className="pt-2 border-t border-slate-200">
                        <div className="text-[10px] font-bold uppercase text-amber-800 mb-1">
                          Anti-Gaming / Edge Case Flags:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {lastAnswerDetails.flags.map((flag, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-[10px] font-bold border border-amber-300">
                              {flag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded text-center text-xs text-slate-500 italic">
                    Scoring telemetry will appear immediately upon the first submitted candidate response.
                  </div>
                )}
                {/* Part 7C: Live Expert Question Injection Trigger */}
                <div className="pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowExpertModal(true)}
                    className="w-full py-2 px-3 bg-gov-navy text-white text-xs font-bold rounded-lg hover:bg-gov-navy/90 transition-colors shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                    </svg>
                    Inject Expert Question Next
                  </button>
                </div>
              </aside>
            )}
          </div>
        )}
      </main>

      {/* Early Termination Confirmation Modal */}
      {showTerminateModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Terminate Interview Session Early
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Concluding the assessment prematurely marks the session as finished and retains all recorded evaluations. A mandatory board justification is required.
                </p>
              </div>
            </div>

            <div>
              <label htmlFor="termination-reason" className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Termination Justification Rationale <span className="text-rose-600">*</span>
              </label>
              <textarea
                id="termination-reason"
                rows={3}
                value={terminationReason}
                onChange={(e) => setTerminationReason(e.target.value)}
                placeholder="State reason (e.g. Candidate withdrew, major technical failure, disqualifying violation)..."
                className="w-full p-2.5 rounded border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                required
              />
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowTerminateModal(false)}
                disabled={isTerminating}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded border border-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTerminateEarly}
                disabled={isTerminating || !terminationReason.trim()}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-50"
              >
                {isTerminating ? 'Terminating...' : 'Confirm Early Termination'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Part 7C: Live Expert Question Injection Modal */}
      {showExpertModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-gov-navy"></span>
                Inject Expert-Authored Question
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowExpertModal(false);
                  setExpertPreview(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Question Prompt Text <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={2}
                  value={expertQuestionText}
                  onChange={(e) => setExpertQuestionText(e.target.value)}
                  placeholder="e.g. In high-criticality flight avionics, how do you handle asymmetric Byzantine faults in triple-redundant flight control computers?"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-gov-navy outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">
                    Difficulty Tier
                  </label>
                  <select
                    value={expertDifficulty}
                    onChange={(e) => setExpertDifficulty(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 focus:ring-2 focus:ring-gov-navy outline-none"
                  >
                    <option value="EASY">EASY</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HARD">HARD</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">
                    Relevancy Preview
                  </label>
                  <button
                    type="button"
                    disabled={isPreviewing || !expertKeywords.trim()}
                    onClick={async () => {
                      setIsPreviewing(true);
                      try {
                        const kws = expertKeywords.split(',').map((k) => k.trim()).filter(Boolean);
                        const prev = await previewQuestionRelevancy({
                          questionText: expertQuestionText,
                          keywords: kws,
                          candidateId: questionData?.candidate?.id,
                        });
                        setExpertPreview(prev);
                      } catch (err) {
                        setToast({ type: 'error', message: 'Failed to preview relevancy: ' + err.message });
                      } finally {
                        setIsPreviewing(false);
                      }
                    }}
                    className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    {isPreviewing ? 'Computing...' : 'Check Relevancy'}
                  </button>
                </div>
              </div>

              {expertPreview && (
                <div className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                  expertPreview.isLowFit ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}>
                  <div>
                    <span className="font-bold">Relevancy Score: </span>
                    <span className="font-mono font-extrabold">{expertPreview.score}%</span> ({expertPreview.band})
                    {expertPreview.isLowFit && <span className="ml-2 text-rose-700 font-bold">[LOW FIT WARNING]</span>}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Candidate Fit: {Math.round(expertPreview.candidateFit * 100)}%
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Ideal Grading Reference Answer <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={2}
                  value={expertIdealAnswer}
                  onChange={(e) => setExpertIdealAnswer(e.target.value)}
                  placeholder="Expected comprehensive technical points and engineering concepts..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-gov-navy outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Required Grading Keywords (comma-separated) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={expertKeywords}
                  onChange={(e) => setExpertKeywords(e.target.value)}
                  placeholder="e.g. Byzantine fault, voting algorithm, triple modular redundancy, DO-254"
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-gov-navy outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => {
                  setShowExpertModal(false);
                  setExpertPreview(null);
                }}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isInjectingExpert || !expertQuestionText.trim() || !expertIdealAnswer.trim() || !expertKeywords.trim()}
                onClick={async () => {
                  setIsInjectingExpert(true);
                  try {
                    const kws = expertKeywords.split(',').map((k) => k.trim()).filter(Boolean);
                    await injectExpertQuestion(sessionId, {
                      questionText: expertQuestionText.trim(),
                      difficulty: expertDifficulty,
                      idealAnswer: expertIdealAnswer.trim(),
                      keywords: kws,
                    });
                    setToast({
                      type: 'success',
                      message: 'Expert question successfully queued! It will be delivered as the next prompt.',
                    });
                    setShowExpertModal(false);
                    setExpertQuestionText('');
                    setExpertIdealAnswer('');
                    setExpertKeywords('');
                    setExpertPreview(null);
                  } catch (err) {
                    setToast({ type: 'error', message: err.message || 'Failed to inject expert question.' });
                  } finally {
                    setIsInjectingExpert(false);
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-gov-navy hover:bg-gov-navy/90 rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
                {isInjectingExpert ? 'Injecting...' : 'Confirm Injection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Interview Dialog */}
      <ConfirmDialog
        isOpen={showLeaveDialog}
        title="Leave Active Interview Chamber?"
        variant="warning"
        confirmText="Leave Session"
        cancelText="Stay in Interview"
        onCancel={() => setShowLeaveDialog(false)}
        onConfirm={() => {
          setShowLeaveDialog(false);
          navigate('/');
        }}
        message={
          <div className="text-xs text-slate-700 space-y-1">
            <p>
              An interview assessment session is currently active. Leaving now will retain previously submitted questions, but the chamber will remain open.
            </p>
            <p className="font-semibold text-amber-900">
              Do you wish to exit to the examiner dashboard?
            </p>
          </div>
        }
      />
    </div>
  );
}

