/**
 * @file AdminSubjectsPage.jsx
 * @description Admin portal screen for multi-subject governance, topic breakdown,
 * question balance alerts, and JSON subject bundle importer with dry-run preview (Part 7D).
 */

import React, { useState, useEffect } from 'react';
import { fetchSubjects, fetchSubjectStats, importSubjectBundle } from '../api/client';
import Spinner from '../components/Spinner';
import ErrorState from '../components/ErrorState';
import Toast from '../components/Toast';

export default function AdminSubjectsPage() {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [subjectStats, setSubjectStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [bundleJson, setBundleJson] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Load subjects
  const loadSubjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchSubjects();
      setSubjects(data);
      if (data.length > 0 && !selectedSubjectId) {
        setSelectedSubjectId(data[0].id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load subject domains.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubjects();
  }, []);

  // Load stats when subject selection changes
  useEffect(() => {
    if (!selectedSubjectId) return;
    const loadStats = async () => {
      try {
        setStatsLoading(true);
        const stats = await fetchSubjectStats(selectedSubjectId);
        setSubjectStats(stats);
      } catch (err) {
        setToastMessage({ type: 'error', text: err.message || 'Failed to load subject statistics.' });
      } finally {
        setStatsLoading(false);
      }
    };
    loadStats();
  }, [selectedSubjectId]);

  // Handle dry-run validation
  const handleDryRun = async () => {
    try {
      setImportLoading(true);
      let parsed;
      try {
        parsed = JSON.parse(bundleJson);
      } catch (jsonErr) {
        throw new Error('Invalid JSON format: ' + jsonErr.message);
      }

      const res = await importSubjectBundle(parsed, true);
      setPreviewResult(res);
      setToastMessage({ type: 'info', text: 'Dry-run validation completed successfully.' });
    } catch (err) {
      setPreviewResult({
        valid: false,
        dryRun: true,
        errors: [err.message || 'Validation failed.'],
      });
    } finally {
      setImportLoading(false);
    }
  };

  // Handle actual transactional import
  const handleCommitImport = async () => {
    try {
      setImportLoading(true);
      const parsed = JSON.parse(bundleJson);
      const res = await importSubjectBundle(parsed, false);

      setToastMessage({ type: 'success', text: res.message || 'Subject imported successfully!' });
      setShowImportModal(false);
      setBundleJson('');
      setPreviewResult(null);

      // Refresh list
      await loadSubjects();
      if (res.subject?.id) {
        setSelectedSubjectId(res.subject.id);
      }
    } catch (err) {
      setToastMessage({ type: 'error', text: err.message || 'Failed to import bundle.' });
    } finally {
      setImportLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <Spinner size="lg" />
        <p className="mt-4 text-xs font-mono text-slate-500 uppercase tracking-widest">
          Loading Curriculum Domains & Question Repositories...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <ErrorState message={error} onRetry={loadSubjects} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gov-gold bg-gov-navy px-2 py-0.5 rounded">
              ADMIN TOOLING • PART 7D
            </span>
            <span className="text-xs text-slate-500 font-mono">DRDO RAC Curriculum Governance</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            Subject Domains & Question Bank Management
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Monitor question bank quotas per topic difficulty and import new subject bundles purely via data.
          </p>
        </div>

        <button
          onClick={() => {
            setShowImportModal(true);
            setPreviewResult(null);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-gov-navy text-white hover:bg-gov-navy-light shadow-sm transition-colors"
        >
          <svg className="w-4 h-4 text-gov-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Import Subject Bundle (JSON)
        </button>
      </div>

      {/* Main Grid: Subject Selector & Topics Explorer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Registered Subjects List */}
        <div className="space-y-4">
          <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center justify-between">
            <span>Registered Subjects</span>
            <span className="text-xs text-slate-500 font-mono">({subjects.length})</span>
          </h2>

          <div className="space-y-2.5">
            {subjects.map((s) => {
              const isSelected = s.id === selectedSubjectId;
              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedSubjectId(s.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-gov-gold bg-gov-navy text-white shadow-md'
                      : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm leading-tight">{s.name}</h3>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                        isSelected ? 'bg-gov-gold text-slate-950' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {s.questionCount} Qs
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-3 text-xs">
                    <span className={isSelected ? 'text-slate-300' : 'text-slate-500'}>
                      <strong>{s.topicCount}</strong> Topics
                    </span>
                    <span className={isSelected ? 'text-slate-400' : 'text-slate-300'}>•</span>
                    <span className={isSelected ? 'text-slate-300' : 'text-slate-500'}>
                      <strong>{s.postCount}</strong> Active Posts
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Detailed Topic Breakdown & Question Deficit Alerts */}
        <div className="lg:col-span-2 space-y-6">
          {statsLoading ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
              <Spinner size="md" />
              <p className="mt-3 text-xs text-slate-500">Compiling difficulty quotas...</p>
            </div>
          ) : subjectStats ? (
            <div className="space-y-6">
              {/* Subject Summary Banner */}
              <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">{subjectStats.subject.name}</h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {subjectStats.subject.id}</p>
                </div>

                <div className="flex items-center gap-4 text-center">
                  <div className="px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-xs text-slate-500 uppercase font-bold text-[10px]">Topics</div>
                    <div className="text-base font-extrabold text-slate-900">{subjectStats.topicCount}</div>
                  </div>
                  <div className="px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-xs text-slate-500 uppercase font-bold text-[10px]">Active Qs</div>
                    <div className="text-base font-extrabold text-slate-900">{subjectStats.totalQuestions}</div>
                  </div>
                  <div
                    className={`px-3 py-1.5 rounded-lg border ${
                      subjectStats.hasDeficits
                        ? 'bg-amber-50 border-amber-300 text-amber-900'
                        : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    }`}
                  >
                    <div className="text-xs uppercase font-bold text-[10px]">Quotas</div>
                    <div className="text-base font-extrabold">
                      {subjectStats.hasDeficits ? `${subjectStats.deficitCount} Deficits` : 'Optimal'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Warnings Banner if any deficits exist */}
              {subjectStats.hasDeficits && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
                    <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Question Bank Quota Warnings
                  </div>
                  <ul className="text-xs space-y-1 pl-6 list-disc">
                    {subjectStats.warnings.map((w, idx) => (
                      <li key={idx}>{w.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Topics Breakdown Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Topic Breakdown & Difficulty Distribution
                  </h4>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Min required: 1 Easy, 1 Med, 1 Hard
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {subjectStats.topics.map((topic) => (
                    <div key={topic.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h5 className="font-bold text-sm text-slate-900">{topic.name}</h5>
                          {topic.hasDeficit && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                              Needs Questions
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 font-mono">ID: {topic.id}</p>
                      </div>

                      {/* Difficulty Counts Badges */}
                      <div className="flex items-center gap-2 self-start sm:self-center">
                        <div className="px-2.5 py-1 rounded bg-slate-100 text-slate-800 text-xs font-mono font-bold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>EASY: {topic.counts.EASY}</span>
                        </div>
                        <div className="px-2.5 py-1 rounded bg-slate-100 text-slate-800 text-xs font-mono font-bold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          <span>MED: {topic.counts.MEDIUM}</span>
                        </div>
                        <div className="px-2.5 py-1 rounded bg-slate-100 text-slate-800 text-xs font-mono font-bold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-purple-500" />
                          <span>HARD: {topic.counts.HARD}</span>
                        </div>
                        <div className="px-2.5 py-1 rounded bg-gov-navy text-white text-xs font-mono font-bold">
                          Total: {topic.counts.total}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
              <p className="text-xs text-slate-500">Select a subject domain to inspect topics and question counts.</p>
            </div>
          )}
        </div>
      </div>

      {/* JSON Subject Bundle Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
                  Import Subject Curriculum Bundle
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Paste a valid subject bundle JSON containing subject, topics, and questions.
                </p>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ×
              </button>
            </div>

            {/* JSON Textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Bundle JSON Payload
              </label>
              <textarea
                value={bundleJson}
                onChange={(e) => setBundleJson(e.target.value)}
                placeholder='{ "subject": { "name": "..." }, "topics": [...], "questions": [...] }'
                rows={9}
                className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gov-navy focus:outline-none"
              />
            </div>

            {/* Preview / Validation Results */}
            {previewResult && (
              <div
                className={`p-4 rounded-xl border text-xs space-y-2 ${
                  previewResult.valid
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-red-50 border-red-300 text-red-900'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  <span>{previewResult.valid ? '✔ Validation Succeeded' : '❌ Validation Failed'}</span>
                </div>

                {previewResult.valid && previewResult.preview && (
                  <div className="space-y-1">
                    <p>
                      <strong>Subject:</strong> {previewResult.preview.subjectName}
                    </p>
                    <p>
                      <strong>Topics:</strong> {previewResult.preview.topics.length} | <strong>Questions:</strong> {previewResult.preview.totalQuestions}
                    </p>
                    <p className="font-mono text-[11px]">
                      Difficulties: {previewResult.preview.difficulties.EASY} Easy, {previewResult.preview.difficulties.MEDIUM} Med, {previewResult.preview.difficulties.HARD} Hard
                    </p>
                  </div>
                )}

                {previewResult.errors?.length > 0 && (
                  <ul className="list-disc pl-5 space-y-0.5">
                    {previewResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={!bundleJson.trim() || importLoading}
                onClick={handleDryRun}
                className="px-4 py-2 rounded-lg text-xs font-bold border border-slate-300 text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                {importLoading ? 'Validating...' : 'Dry-Run Preview'}
              </button>

              <button
                type="button"
                disabled={!previewResult?.valid || importLoading}
                onClick={handleCommitImport}
                className="px-5 py-2 rounded-lg text-xs font-bold bg-gov-navy text-white hover:bg-gov-navy-light disabled:opacity-50 shadow-sm"
              >
                {importLoading ? 'Importing...' : 'Confirm & Ingest Subject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {toastMessage && (
        <Toast
          message={toastMessage.text}
          type={toastMessage.type}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}

