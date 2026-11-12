/**
 * @file CompletionPage.jsx
 * @description Boardroom interview completion screen (/interview/:sessionId/done).
 * Displays a neutral, dignified conclusion message for the candidate without disclosing scores or verdicts.
 * Provides an examiner navigation pathway to view the final evaluation report dossier.
 */

import React from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';

export default function CompletionPage() {
  const { sessionId } = useParams();
  const location = useLocation();
  const terminatedEarly = location.state?.terminatedEarly;

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-xl w-full bg-white border border-slate-200 rounded-2xl p-8 sm:p-10 shadow-lg text-center space-y-6">
        {/* Emblem Shield */}
        <div className="w-16 h-16 rounded-2xl bg-gov-navy text-white flex items-center justify-center mx-auto shadow-md border border-gov-gold/40">
          <svg className="w-9 h-9 text-gov-gold" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
          </svg>
        </div>

        {/* Candidate-facing Neutral Message */}
        <div className="space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-widest text-slate-500 font-bold">
            RAC DRDO ASSESSMENT CHAMBER
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Interview completed. Thank you.
          </h1>
          <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
            Your responses have been recorded and encrypted into the official Recruitment and Assessment Centre dossier archive for board appraisal.
          </p>
        </div>

        {terminatedEarly && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 font-medium">
            Session concluded early under board administrative directive.
          </div>
        )}

        {/* Candidate Instruction */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
          Candidate technical responses are subject to confidential board verification. The assessment committee will notify you through official DRDO communication channels regarding recruitment outcomes.
        </div>

        {/* Boardroom Examiner Action */}
        <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/"
            className="w-full sm:w-auto px-5 py-2.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            ← Boardroom Dashboard
          </Link>

          <Link
            to={`/report/${sessionId}`}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-xs font-extrabold bg-gov-navy text-white hover:bg-gov-navy-light shadow-sm transition-colors"
          >
            <span>Examiner: View Report</span>
            <svg className="w-4 h-4 text-gov-gold" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}

