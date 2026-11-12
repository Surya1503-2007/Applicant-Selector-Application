/**
 * @file InterviewRoomPlaceholder.jsx
 * @description Boardroom placeholder view for the live adaptive interview room (/interview/:sessionId).
 * Connects Part 6 setup wizard to Part 4 (Adaptive Interview Engine).
 */

import React from 'react';
import { useParams, useLocation, Link, useNavigate } from 'react-router-dom';
import { useInterviewSession } from '../hooks/useInterviewSession';
import Spinner from '../components/Spinner';

export default function InterviewRoomPlaceholder() {
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const { data: session, loading, error, refresh } = useInterviewSession(sessionId);

  const candidateData = location.state?.candidate || session?.candidate;
  const postData = location.state?.post;
  const skillMatch = location.state?.skillMatch;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Boardroom Session Banner */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-8">
        <div className="bg-gov-navy text-white px-6 py-5 border-b border-gov-gold flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-gov-gold">
              BOARDROOM ASSESSMENT CHAMBER • PART 4 INTEGRATION
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-0.5">
              Live Adaptive Interview Session
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              SESSION ACTIVE
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
                {candidateData?.name || (loading ? 'Loading...' : 'Candidate profile linked')}
              </div>
              {candidateData?.experienceLevel && (
                <div className="text-xs text-slate-600">{candidateData.experienceLevel}</div>
              )}
            </div>

            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Recruitment Target
              </div>
              <div className="font-bold text-gov-navy mt-1">
                {postData?.title || candidateData?.postApplied || 'Scientist ‘B’ / ASD'}
              </div>
            </div>
          </div>

          {/* Module Integration Card */}
          <div className="border border-blue-200 bg-blue-50/60 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-gov-navy text-white flex items-center justify-center shrink-0 shadow-sm">
                <svg className="w-5 h-5 text-gov-gold" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Part 6 Setup Wizard Completed Successfully
                </h3>
                <p className="text-sm text-slate-700 mt-1">
                  Candidate credentials and competency weights have been ingested into the PostgreSQL database. The active interview session has been instantiated.
                </p>
                <div className="mt-3 text-xs text-slate-600 bg-white p-3 rounded border border-slate-200 space-y-1">
                  <p>
                    <strong>Next Phase Architecture (Part 4):</strong> The Live Interview Room interfaces with the question bank, adaptive difficulty selector, and offline logic scorer (`POST /api/answers`).
                  </p>
                  <p>
                    <strong>Next Phase Architecture (Part 5):</strong> Generates the comprehensive RAC DRDO Candidate Evaluation Dossier (`/report/${sessionId}`).
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <Link
              to="/"
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              ← Back to Boardroom Dashboard
            </Link>

            <div className="flex items-center gap-3">
              <Link
                to={`/report/${sessionId}`}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                Preview Final Report View →
              </Link>

              <button
                type="button"
                onClick={() => navigate('/setup')}
                className="px-5 py-2 bg-gov-navy hover:bg-gov-navy-light text-white rounded-lg text-sm font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-gov-navy"
              >
                Setup Another Candidate
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

