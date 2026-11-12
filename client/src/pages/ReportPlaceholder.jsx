/**
 * @file ReportPlaceholder.jsx
 * @description Boardroom placeholder view for candidate assessment report (/report/:sessionId).
 * Connects Part 6 dashboard & wizard to Part 5 (Report & Final Scoring).
 */

import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useInterviewSession } from '../hooks/useInterviewSession';
import Spinner from '../components/Spinner';

export default function ReportPlaceholder() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const { data: session, loading, error, refresh } = useInterviewSession(sessionId);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-8">
        {/* Banner */}
        <div className="bg-gov-navy text-white px-6 py-5 border-b border-gov-gold flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-gov-gold">
              RECRUITMENT AND ASSESSMENT CENTRE • DOSSIER VIEW
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-0.5">
              Candidate Evaluation & Assessment Dossier
            </h1>
          </div>
          <div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
              DOSSIER ARCHIVE
            </span>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {/* Session Identification Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Session Identifier
              </div>
              <div className="font-mono font-bold text-xs text-slate-800 mt-1 break-all select-all">
                {sessionId}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Candidate Under Assessment
              </div>
              <div className="font-bold text-slate-900 mt-1">
                {session?.candidate?.name || (loading ? 'Loading...' : 'Candidate linked')}
              </div>
              {session?.candidate?.experienceLevel && (
                <div className="text-xs text-slate-600">
                  {session.candidate.experienceLevel}
                </div>
              )}
            </div>

            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Session Status
              </div>
              <div className="mt-1">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                    session?.status === 'COMPLETED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {session?.status || 'RECORDED'}
                </span>
              </div>
            </div>
          </div>

          {/* Module Integration Card */}
          <div className="border border-slate-200 bg-slate-50 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-gov-navy text-white flex items-center justify-center shrink-0 shadow-sm">
                <svg className="w-5 h-5 text-gov-gold" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path
                    fillRule="evenodd"
                    d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Part 5: Assessment Report & Final Scoring View
                </h3>
                <p className="text-sm text-slate-700 mt-1">
                  This screen serves as the final dossier presenting the question-by-question scoring breakdown, adaptive progression graph, and suitability recommendation for the DRDO selection board.
                </p>
                <div className="mt-3 text-xs text-slate-600 bg-white p-3 rounded border border-slate-200">
                  Detailed report rendering will display the complete tabular audit log from the session once the adaptive question round is completed.
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <Link
              to="/"
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              ← Return to Boardroom Dashboard
            </Link>

            <button
              type="button"
              onClick={() => navigate('/setup')}
              className="px-5 py-2 bg-gov-navy hover:bg-gov-navy-light text-white rounded-lg text-sm font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-gov-navy"
            >
              Setup New Interview
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

