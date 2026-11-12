/**
 * @file ReportPage.jsx
 * @description Comprehensive, print-ready Candidate Evaluation Dossier (/report/:sessionId) for RAC DRDO.
 *
 * Implements:
 *  - Report header with candidate, post, date, and version metadata.
 *  - Executive summary metrics cards (Overall score, recommendation, skill-match %, interview score, relevancy).
 *  - Warning banners for early termination and mandatory competence gaps.
 *  - Topic assessment scores with horizontal proficiency bars.
 *  - Pure SVG difficulty progression trajectory chart.
 *  - Question-by-question expandable tabular audit log with keyword analysis and flags.
 *  - Anti-gaming flags summary chips.
 *  - Adaptive decision log timeline.
 *  - Collapsible scoring calculation formulas & configuration snapshot.
 *  - Presiding board remarks persistence.
 *  - Recommendation override form with audit trail.
 *  - Report version regeneration & print-to-PDF styles.
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  fetchReport,
  saveBoardRemarks,
  overrideRecommendation,
  regenerateReport,
} from '../api/client';
import ScoreBadge from '../components/ScoreBadge';
import VerdictBadge from '../components/VerdictBadge';
import TopicBar from '../components/TopicBar';
import DifficultyChart from '../components/DifficultyChart';
import Collapsible from '../components/Collapsible';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast from '../components/Toast';
import Spinner from '../components/Spinner';
import ErrorState from '../components/ErrorState';

export default function ReportPage() {
  const { sessionId } = useParams();

  // Report Data State
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Expanded question row keys
  const [expandedRows, setExpandedRows] = useState({});

  // Board Remarks State
  const [remarks, setRemarks] = useState('');
  const [isSavingRemarks, setIsSavingRemarks] = useState(false);

  // Recommendation Override State
  const [overrideRec, setOverrideRec] = useState('SUITABLE');
  const [overrideReason, setOverrideReason] = useState('');
  const [overriddenBy, setOverriddenBy] = useState('Board Presiding Officer');
  const [isSubmittingOverride, setIsSubmittingOverride] = useState(false);
  const [showOverrideForm, setShowOverrideForm] = useState(false);

  // Regenerate Report Confirmation Modal
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Toast Feedback
  const [toast, setToast] = useState(null);

  // Fetch report
  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchReport(sessionId);
      setReportData(data);
      setRemarks(data.boardRemarks || '');
      if (data.metrics?.finalRecommendation) {
        setOverrideRec(data.metrics.finalRecommendation);
      }
    } catch (err) {
      setError(err.message || 'Failed to retrieve assessment dossier.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [sessionId]);

  // Toggle table row expansion
  const toggleRow = (questionNumber) => {
    setExpandedRows((prev) => ({
      ...prev,
      [questionNumber]: !prev[questionNumber],
    }));
  };

  // Save Remarks
  const handleSaveRemarks = async (e) => {
    if (e) e.preventDefault();
    setIsSavingRemarks(true);
    try {
      await saveBoardRemarks(sessionId, remarks);
      setToast({ type: 'success', message: 'Board remarks saved successfully.' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to save remarks.' });
    } finally {
      setIsSavingRemarks(false);
    }
  };

  // Submit Recommendation Override
  const handleSaveOverride = async (e) => {
    if (e) e.preventDefault();
    if (!overrideReason.trim()) {
      setToast({ type: 'error', message: 'Override justification reason is mandatory.' });
      return;
    }

    setIsSubmittingOverride(true);
    try {
      await overrideRecommendation(sessionId, {
        finalRecommendation: overrideRec,
        reason: overrideReason.trim(),
        overriddenBy: overriddenBy.trim(),
      });
      setToast({ type: 'success', message: 'Recommendation override recorded into dossier.' });
      setShowOverrideForm(false);
      // Reload report
      await loadReport();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to record override.' });
    } finally {
      setIsSubmittingOverride(false);
    }
  };

  // Regenerate Report
  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const updated = await regenerateReport(sessionId);
      setReportData(updated);
      setShowRegenModal(false);
      setToast({
        type: 'success',
        message: `Dossier regenerated successfully (New Version: ${updated.reportVersion}).`,
      });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to regenerate dossier.' });
    } finally {
      setIsRegenerating(false);
    }
  };

  // Print Report Handler
  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-24 text-center">
        <Spinner size="lg" label="Compiling assessment dossier and scoring tables..." />
        <p className="text-xs text-slate-500 mt-2">
          Generating deterministic skill matrices and progression charts...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <ErrorState
          title="Failed to Load Assessment Report"
          message={error}
          onRetry={loadReport}
        />
      </div>
    );
  }

  const { candidate, metrics, topicScores, difficultyProgression, questions, flagsSummary, decisionLog, scoreCalculation } = reportData;

  const recBadgeConfig = {
    SUITABLE: {
      label: 'SUITABLE',
      bg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      dot: 'bg-emerald-600',
    },
    BORDERLINE: {
      label: 'BORDERLINE',
      bg: 'bg-amber-100 text-amber-900 border-amber-300',
      dot: 'bg-amber-600',
    },
    NOT_SUITABLE: {
      label: 'NOT SUITABLE',
      bg: 'bg-rose-100 text-rose-900 border-rose-300',
      dot: 'bg-rose-600',
    },
  };

  const activeRec = metrics.finalRecommendation || metrics.systemRecommendation || 'SUITABLE';
  const recBadge = recBadgeConfig[activeRec] || recBadgeConfig.SUITABLE;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 print:py-0 print:px-0 print:max-w-none">
      {/* Toast notifications */}
      {toast && (
        <div className="no-print">
          <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />
        </div>
      )}

      {/* ========================================================================= */}
      {/* ACTION BAR (SCREEN ONLY)                                                  */}
      {/* ========================================================================= */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-3">
        <Link
          to="/"
          className="text-xs font-bold text-slate-600 hover:text-gov-navy flex items-center gap-1.5 focus:outline-none"
        >
          ← Return to Boardroom Dashboard
        </Link>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowRegenModal(true)}
            className="px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            Regenerate Report
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-gov-navy text-white hover:bg-gov-navy-light rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-gov-navy"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>Print / Save as PDF</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* A. OFFICIAL REPORT HEADER                                                 */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm print:border-none print:shadow-none print:p-0">
        <div className="border-b-2 border-gov-gold pb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-widest text-slate-500">
                <span>GOVERNMENT OF INDIA</span>
                <span>•</span>
                <span>MINISTRY OF DEFENCE</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
                Recruitment and Assessment Centre (RAC)
              </h1>
              <p className="text-sm font-semibold text-gov-navy mt-0.5">
                Technical Evaluation Dossier & Candidate Competency Assessment
              </p>
            </div>

            <div className="sm:text-right bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-lg border sm:border-none border-slate-200">
              <div className="text-xs font-mono font-bold text-slate-800">
                Dossier Ver: <span className="text-gov-navy font-extrabold">v{reportData.reportVersion}</span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Date: <strong className="text-slate-800">{reportData.interviewDate}</strong>
              </div>
              <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                Session ID: {sessionId.slice(0, 18)}...
              </div>
            </div>
          </div>

          {/* Candidate & Post Identifiers */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-200">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold block">
                Candidate Name
              </span>
              <span className="text-base font-extrabold text-slate-900">{candidate.name}</span>
            </div>

            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold block">
                Post Applied For
              </span>
              <span className="text-sm font-bold text-gov-navy">{candidate.postApplied}</span>
            </div>

            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold block">
                Experience Category
              </span>
              <span className="text-sm font-medium text-slate-700">{candidate.experienceLevel}</span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* C. WARNING BANNERS                                                        */}
        {/* ========================================================================= */}
        <div className="mt-6 space-y-3">
          {/* Terminated Early Warning */}
          {metrics.terminatedEarly && (
            <div
              role="alert"
              className="p-4 bg-amber-50 border-l-4 border-amber-600 rounded-r-lg text-amber-900 flex items-start gap-3"
            >
              <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="text-xs">
                <div className="font-extrabold uppercase tracking-wide">
                  Administrative Notice: Session Terminated Early
                </div>
                <p className="mt-0.5 text-amber-800">
                  <strong>Reason on Record:</strong> {metrics.terminationReason || 'Presiding examiner directive.'}
                </p>
              </div>
            </div>
          )}

          {/* Mandatory Competency Gap Warning */}
          {metrics.mandatoryGap && (
            <div
              role="alert"
              className="p-4 bg-rose-50 border-l-4 border-rose-600 rounded-r-lg text-rose-900 flex items-start gap-3"
            >
              <svg className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="text-xs">
                <div className="font-extrabold uppercase tracking-wide text-rose-900">
                  Eligibility Flag: Mandatory Skill Gap Detected
                </div>
                <p className="mt-0.5 text-rose-800">
                  Candidate profile failed to satisfy required mandatory technical competencies:
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(metrics.missingMandatory || []).map((m, i) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-rose-200 text-rose-900 font-bold text-[11px]">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* B. EXECUTIVE SUMMARY CARDS                                                */}
        {/* ========================================================================= */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* 1. Overall Score */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Overall Score
            </span>
            <div className="my-2">
              <span className="text-3xl sm:text-4xl font-extrabold text-gov-navy font-mono">
                {metrics.overallScore}
              </span>
              <span className="text-xs text-slate-500 font-bold">/100</span>
            </div>
            <span className="text-[10px] text-slate-500">
              Weighted composite rating
            </span>
          </div>

          {/* 2. Recommendation Badge */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Board Decision
              </span>
              {metrics.isOverridden && (
                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 border border-purple-300">
                  Overridden
                </span>
              )}
            </div>
            <div className="my-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-extrabold border ${recBadge.bg}`}
              >
                <span className={`w-2 h-2 rounded-full ${recBadge.dot}`} />
                <span>{recBadge.label}</span>
              </span>
            </div>
            <span className="text-[10px] text-slate-500 truncate" title={`System: ${metrics.systemRecommendation}`}>
              System: {metrics.systemRecommendation}
            </span>
          </div>

          {/* 3. Skill-Match Percentage */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Skill-Match %
            </span>
            <div className="my-2">
              <span className="text-2xl font-bold text-slate-900 font-mono">
                {metrics.skillMatchPercent}%
              </span>
            </div>
            <span className="text-[10px] text-slate-500">
              Deterministic 4-tier match
            </span>
          </div>

          {/* 4. Interview Score */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Interview Score
            </span>
            <div className="my-2">
              <span className="text-2xl font-bold text-slate-900 font-mono">
                {metrics.interviewScore}%
              </span>
            </div>
            <span className="text-[10px] text-slate-500">
              Average question coverage
            </span>
          </div>

          {/* 5. Question Relevancy */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Relevancy Score
            </span>
            <div className="my-2">
              <span className="text-2xl font-bold text-slate-900 font-mono">
                {metrics.questionRelevancyScore}%
              </span>
            </div>
            <span className="text-[10px] text-slate-500">
              TF-IDF vocabulary overlap
            </span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* D. TOPIC SCORES                                                           */}
        {/* ========================================================================= */}
        <div className="mt-8">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              Domain Competency & Topic Breakdown
            </h3>
            <span className="text-xs text-slate-500 font-medium">
              4 Evaluated Domains
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(topicScores || []).map((t, idx) => (
              <TopicBar
                key={idx}
                topicName={t.topicName}
                score={t.score}
                classification={t.classification}
                highestDifficultyReached={t.highestDifficultyReached}
              />
            ))}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* E. DIFFICULTY PROGRESSION CHART                                           */}
        {/* ========================================================================= */}
        <div className="mt-8">
          <DifficultyChart progression={difficultyProgression} />
        </div>

        {/* ========================================================================= */}
        {/* F. QUESTION-BY-QUESTION AUDIT TABLE                                       */}
        {/* ========================================================================= */}
        <div className="mt-8">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                Question Evaluation Log
              </h3>
              <p className="text-xs text-slate-500">
                Click any question row to expand full response text and scoring breakdown
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-600">
              {questions.length} Questions Evaluated
            </span>
          </div>

          <div className="overflow-hidden border border-slate-200 rounded-lg shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[11px]">
                  <th className="py-3 px-3 w-12 text-center">#</th>
                  <th className="py-3 px-3">Assessment Question</th>
                  <th className="py-3 px-3 text-center">Difficulty</th>
                  <th className="py-3 px-3 text-center">Score</th>
                  <th className="py-3 px-3 text-center">Verdict</th>
                  <th className="py-3 px-3 text-center">Relevancy</th>
                  <th className="py-3 px-3 text-center w-16 no-print">Expand</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {questions.map((q) => {
                  const isExpanded = Boolean(expandedRows[q.questionNumber]);
                  return (
                    <React.Fragment key={q.questionNumber}>
                      <tr
                        onClick={() => toggleRow(q.questionNumber)}
                        className={`cursor-pointer hover:bg-slate-50 transition-colors ${
                          isExpanded ? 'bg-slate-50/80 font-medium' : ''
                        }`}
                      >
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-500">
                          Q{q.questionNumber}
                        </td>
                        <td className="py-3 px-3 text-slate-900 font-semibold max-w-md">
                          <div className="line-clamp-2">{q.questionText}</div>
                          <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                            Topic: {q.topicName}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-[11px] text-slate-700">
                          {q.difficulty}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {q.answerScore !== null ? (
                            <ScoreBadge score={q.answerScore} size="sm" />
                          ) : (
                            <span className="text-slate-400 italic">N/A</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <VerdictBadge verdict={q.verdict} size="sm" />
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-slate-700">
                          {q.relevancyScore !== null ? `${q.relevancyScore}%` : 'N/A'}
                        </td>
                        <td className="py-3 px-3 text-center no-print text-slate-400">
                          <svg
                            className={`w-4 h-4 mx-auto transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </td>
                      </tr>

                      {/* Expandable Details Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 border-b border-slate-200">
                          <td colSpan={7} className="p-4 sm:p-5">
                            <div className="space-y-4 text-xs">
                              {/* Full Candidate Answer */}
                              <div>
                                <span className="font-bold uppercase tracking-wider text-slate-700 block mb-1">
                                  Full Candidate Transcript / Answer Text:
                                </span>
                                <div className="p-3 bg-white border border-slate-200 rounded-md font-sans text-slate-800 leading-relaxed">
                                  {q.answerText || '<No verbal answer recorded>'}
                                </div>
                              </div>

                              {/* Keywords & Flags Grid */}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                  <span className="font-bold text-emerald-800 block mb-1">
                                    Matched Keywords ({q.matchedKeywords?.length || 0}):
                                  </span>
                                  <div className="flex flex-wrap gap-1">
                                    {(q.matchedKeywords || []).map((kw, i) => (
                                      <span key={i} className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 text-[10px]">
                                        {kw}
                                      </span>
                                    ))}
                                    {(!q.matchedKeywords || q.matchedKeywords.length === 0) && (
                                      <span className="text-slate-400 italic">None</span>
                                    )}
                                  </div>
                                </div>

                                <div>
                                  <span className="font-bold text-rose-800 block mb-1">
                                    Missing Keywords ({q.missingKeywords?.length || 0}):
                                  </span>
                                  <div className="flex flex-wrap gap-1">
                                    {(q.missingKeywords || []).map((kw, i) => (
                                      <span key={i} className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-900 text-[10px]">
                                        {kw}
                                      </span>
                                    ))}
                                    {(!q.missingKeywords || q.missingKeywords.length === 0) && (
                                      <span className="text-slate-400 italic">None</span>
                                    )}
                                  </div>
                                </div>

                                <div>
                                  <span className="font-bold text-slate-700 block mb-1">
                                    Scoring Flags on Record:
                                  </span>
                                  <div className="flex flex-wrap gap-1">
                                    {(q.flags || []).map((f, i) => (
                                      <span key={i} className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono font-bold text-[10px] border border-amber-300">
                                        {f}
                                      </span>
                                    ))}
                                    {(!q.flags || q.flags.length === 0) && (
                                      <span className="text-slate-400 italic">No flags triggered</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* G. FLAGS SUMMARY CHIPS                                                    */}
        {/* ========================================================================= */}
        {flagsSummary && flagsSummary.length > 0 && (
          <div className="mt-8 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-2">
              Anti-Gaming & Integrity Flags Summary ({flagsSummary.length})
            </span>
            <div className="flex flex-wrap gap-2">
              {flagsSummary.map((flag, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-mono font-bold text-xs"
                >
                  {flag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* H. DECISION LOG TIMELINE                                                  */}
        {/* ========================================================================= */}
        <div className="mt-8">
          <div className="pb-3 border-b border-slate-200 mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              Adaptive Interview Decision Log (Audit Trail)
            </h3>
            <p className="text-xs text-slate-500">
              Step-by-step Markov transitions and difficulty calibration recorded by the adaptive engine
            </p>
          </div>

          <div className="space-y-3">
            {decisionLog && decisionLog.length > 0 ? (
              decisionLog.map((log, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                >
                  <div className="w-6 h-6 rounded-full bg-gov-navy text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <span className="font-bold text-slate-900 font-mono">
                        {log.event}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-700 mt-1">{log.reason}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 italic">No decision events recorded.</p>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* I. HOW THIS SCORE WAS CALCULATED (COLLAPSIBLE)                             */}
        {/* ========================================================================= */}
        <div className="mt-8">
          <Collapsible
            id="scoring-methodology"
            title="How This Score Was Calculated (Formulas & Weightings)"
            subtitle="Deterministic mathematical specification under RAC recruitment policy"
          >
            <div className="space-y-4 text-xs text-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="font-bold text-slate-900 mb-1">Composite Overall Score</div>
                  <code className="text-gov-navy font-mono font-bold block mb-2">
                    {scoreCalculation.overallFormula}
                  </code>
                  <p className="text-slate-600">
                    Weights candidate curriculum suitability (30%) against adaptive board interview performance (70%).
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="font-bold text-slate-900 mb-1">Answer Evaluation Formula</div>
                  <code className="text-gov-navy font-mono font-bold block mb-2">
                    {scoreCalculation.answerScoreFormula}
                  </code>
                  <p className="text-slate-600">
                    Combines TF-IDF domain relevancy with Porter-stemmed keyword and concept correctness.
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex flex-wrap gap-4 text-[11px] text-slate-600">
                <span>Suitable Threshold: <strong>≥ 70%</strong></span>
                <span>Borderline Threshold: <strong>50% – 69%</strong></span>
                <span>Not Suitable Threshold: <strong>&lt; 50% or Mandatory Gap</strong></span>
              </div>
            </div>
          </Collapsible>
        </div>

        {/* ========================================================================= */}
        {/* J. BOARD REMARKS & K. RECOMMENDATION OVERRIDE                             */}
        {/* ========================================================================= */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 no-print">
          {/* Board Remarks */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <h4 className="text-sm font-bold uppercase tracking-wide text-slate-900">
              Presiding Board Remarks
            </h4>
            <p className="text-xs text-slate-500">
              Record qualitative board observations, behavioral traits, and official remarks.
            </p>

            <form onSubmit={handleSaveRemarks} className="space-y-3">
              <textarea
                rows={4}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter board committee observations and rationale here..."
                className="w-full p-2.5 rounded border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-gov-navy"
              />

              <button
                type="submit"
                disabled={isSavingRemarks}
                className="px-4 py-2 text-xs font-bold bg-gov-navy text-white rounded hover:bg-gov-navy-light focus:outline-none focus:ring-2 focus:ring-gov-navy disabled:opacity-50"
              >
                {isSavingRemarks ? 'Saving Remarks...' : 'Save Remarks to Dossier'}
              </button>
            </form>
          </div>

          {/* Recommendation Override */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold uppercase tracking-wide text-slate-900">
                Board Recommendation Override
              </h4>
              <button
                type="button"
                onClick={() => setShowOverrideForm((prev) => !prev)}
                className="text-xs font-bold text-gov-navy hover:underline focus:outline-none"
              >
                {showOverrideForm ? 'Close Override Form' : 'Modify Recommendation'}
              </button>
            </div>

            {/* Overridden state summary */}
            {metrics.isOverridden && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded text-xs text-purple-900 space-y-1">
                <div className="font-bold flex items-center justify-between">
                  <span>Current Board Status: {metrics.finalRecommendation}</span>
                  <span className="text-[10px] uppercase font-mono">OVERRIDDEN</span>
                </div>
                <p><strong>Overridden By:</strong> {metrics.overrideDetails?.overriddenBy}</p>
                <p><strong>Justification:</strong> {metrics.overrideDetails?.reason}</p>
              </div>
            )}

            {showOverrideForm ? (
              <form onSubmit={handleSaveOverride} className="space-y-3 pt-2 border-t border-slate-200">
                <div>
                  <label htmlFor="new-recommendation" className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    New Board Recommendation
                  </label>
                  <select
                    id="new-recommendation"
                    value={overrideRec}
                    onChange={(e) => setOverrideRec(e.target.value)}
                    className="w-full p-2 rounded border border-slate-300 text-xs text-slate-900 bg-white"
                  >
                    <option value="SUITABLE">SUITABLE</option>
                    <option value="BORDERLINE">BORDERLINE</option>
                    <option value="NOT_SUITABLE">NOT_SUITABLE</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="override-reason" className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Mandatory Justification Rationale <span className="text-rose-600">*</span>
                  </label>
                  <textarea
                    id="override-reason"
                    rows={2}
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="State justification (e.g. Exceptional specialized research accomplishments outweigh gap)..."
                    className="w-full p-2 rounded border border-slate-300 text-xs text-slate-900"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="overridden-by" className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Authorizing Officer / Board Title
                  </label>
                  <input
                    id="overridden-by"
                    type="text"
                    value={overriddenBy}
                    onChange={(e) => setOverriddenBy(e.target.value)}
                    className="w-full p-2 rounded border border-slate-300 text-xs text-slate-900"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingOverride || !overrideReason.trim()}
                  className="px-4 py-2 text-xs font-bold bg-gov-gold text-gov-navy rounded hover:bg-gov-gold/90 focus:outline-none focus:ring-2 focus:ring-gov-gold disabled:opacity-50"
                >
                  {isSubmittingOverride ? 'Recording Override...' : 'Commit Board Override'}
                </button>
              </form>
            ) : (
              <p className="text-xs text-slate-500">
                Official recommendations are generated deterministically based on overall scores and mandatory skills. Board members can record a formal override with justification.
              </p>
            )}
          </div>
        </div>

        {/* Boardroom Sign-off Strip (Visible in Print) */}
        <div className="mt-12 pt-8 border-t border-slate-300 hidden print:block text-xs">
          <div className="grid grid-cols-3 gap-8 text-center pt-8">
            <div>
              <div className="border-t border-slate-400 pt-2 font-bold text-slate-800">
                Subject Matter Expert
              </div>
              <div className="text-[10px] text-slate-500">Technical Board Member</div>
            </div>
            <div>
              <div className="border-t border-slate-400 pt-2 font-bold text-slate-800">
                RAC Observer
              </div>
              <div className="text-[10px] text-slate-500">Procedural Assessment Officer</div>
            </div>
            <div>
              <div className="border-t border-slate-400 pt-2 font-bold text-slate-800">
                Presiding Board Officer
              </div>
              <div className="text-[10px] text-slate-500">Selection Board Chairperson</div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal: Regenerate Report */}
      <ConfirmDialog
        isOpen={showRegenModal}
        title="Regenerate Assessment Dossier?"
        variant="warning"
        loading={isRegenerating}
        confirmText="Confirm & Regenerate"
        cancelText="Cancel"
        onCancel={() => setShowRegenModal(false)}
        onConfirm={handleRegenerate}
        message={
          <div className="text-xs text-slate-700 space-y-1">
            <p>
              Regenerating the report will recalculate metric breakdowns against all stored responses and advance the report version (e.g. v{reportData.reportVersion} → v{(Number(reportData.reportVersion) + 0.1).toFixed(1)}).
            </p>
            <p className="font-semibold text-amber-900">
              Previous version records and board remarks are permanently retained.
            </p>
          </div>
        }
      />
    </div>
  );
}

