/**
 * @file DashboardPage.jsx
 * @description Examiner Dashboard (Route: /) displaying recent interviews, status metrics,
 * and quick-action launcher cards for RAC DRDO board assessors.
 */

import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { fetchSessions } from '../api/client';
import DataTable from '../components/DataTable';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

/**
 * Formats ISO date string to readable government dispatch timestamp.
 *
 * @param {string|Date} dateStr - Raw date string.
 * @returns {string} Formatted date.
 */
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dateStr);
  }
}

export default function DashboardPage() {
  const { data: sessions, loading, error, execute: refreshSessions } = useAsync(fetchSessions, true);

  // Compute summary metrics
  const metrics = useMemo(() => {
    const list = Array.isArray(sessions) ? sessions : [];
    const active = list.filter((s) => s.status === 'ACTIVE').length;
    const completed = list.filter((s) => s.status === 'COMPLETED').length;
    return {
      total: list.length,
      active,
      completed,
    };
  }, [sessions]);

  // Columns definition for Recent Interviews DataTable
  const columns = useMemo(
    () => [
      {
        header: 'Candidate Name',
        accessor: 'candidateName',
        render: (row) => (
          <div>
            <div className="font-bold text-slate-900">{row.candidateName}</div>
            <div className="text-[11px] text-slate-500 font-mono">ID: {row.candidateId ? row.candidateId.slice(0, 8) : '—'}</div>
          </div>
        ),
      },
      {
        header: 'Post Applied',
        accessor: 'postApplied',
        render: (row) => (
          <div>
            <div className="font-medium text-slate-800">{row.postApplied}</div>
            <div className="text-xs text-slate-500">{row.experienceLevel}</div>
          </div>
        ),
      },
      {
        header: 'Status',
        accessor: 'status',
        render: (row) => {
          const isActive = row.status === 'ACTIVE';
          return (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border tracking-wide uppercase ${
                isActive
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
              role="status"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isActive ? 'bg-blue-500 animate-pulse' : 'bg-emerald-500'
                }`}
                aria-hidden="true"
              />
              {row.status}
            </span>
          );
        },
      },
      {
        header: 'Date & Time',
        accessor: 'startTime',
        render: (row) => (
          <span className="text-xs text-slate-600 font-medium">
            {formatDate(row.startTime || row.createdAt)}
          </span>
        ),
      },
      {
        header: 'Actions',
        className: 'text-right',
        headerClassName: 'text-right',
        render: (row) => {
          const isActive = row.status === 'ACTIVE';
          return (
            <Link
              to={isActive ? `/interview/${row.id}` : `/report/${row.id}`}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                isActive
                  ? 'bg-gov-navy text-white hover:bg-gov-navy-light focus:ring-2 focus:ring-gov-gold'
                  : 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              <span>{isActive ? 'Resume Session' : 'View Debrief'}</span>
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                  clipRule="evenodd"
                />
              </svg>
            </Link>
          );
        },
      },
    ],
    []
  );

  return (
    <div className="space-y-8 pb-12">
      {/* Boardroom Banner */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 uppercase tracking-wider mb-2 border border-slate-200">
              Assessor Boardroom Console
            </span>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Defence Scientist Recruitment & Assessment
            </h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Conduct standardized, AI-assisted competency screening and adaptive oral examinations for
              Scientist / Engineer appointments under DRDO. Screen declared candidate skills, review match bands,
              and execute calibrated technical interviews.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/setup"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-bold bg-gov-navy text-white hover:bg-gov-navy-light shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-gov-gold focus:ring-offset-2"
            >
              <svg className="w-5 h-5 text-gov-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
              </svg>
              <span>Start New Interview</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Dashboard Launcher & Metric Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5" aria-label="Key Assessment Metrics">
        {/* Card 1: Start New Interview */}
        <div className="bg-white border-2 border-gov-navy/10 hover:border-gov-gold rounded-xl p-6 shadow-sm transition-all flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg bg-gov-navy text-gov-gold flex items-center justify-center mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Start a New Interview</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Select post vacancy, register candidate profile and competencies, calculate suitability match, and initiate session.
            </p>
          </div>
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">3-Step Setup Wizard</span>
            <Link
              to="/setup"
              className="text-xs font-bold text-gov-blue hover:text-blue-900 flex items-center gap-1 group"
            >
              <span>Launch Wizard</span>
              <span className="group-hover:translate-x-0.5 transition-transform">→</span>
            </Link>
          </div>
        </div>

        {/* Card 2: View Reports / Rankings */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Assessment Archives</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              View standardized evaluation debriefs, question-by-question scoring breakdowns, and candidate suitability audit trails.
            </p>
          </div>
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              {metrics.completed} Completed Assessment{metrics.completed === 1 ? '' : 's'}
            </span>
            <span className="text-xs font-bold text-slate-400">Archived</span>
          </div>
        </div>

        {/* Card 3: Active Interviews Counter */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Active Board Sessions</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Current interviews ongoing or awaiting follow-up question responses across examination rooms.
            </p>
          </div>
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-slate-900">{metrics.active}</span>
              <span className="text-xs font-semibold text-slate-500">Live Active</span>
            </div>
            <span className="text-xs font-bold text-slate-500">Total: {metrics.total}</span>
          </div>
        </div>
      </section>

      {/* Recent Interviews List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Recent Candidate Interviews</h3>
            <p className="text-xs text-slate-500">
              Audit log of scheduled and active oral examination sessions.
            </p>
          </div>
          <button
            type="button"
            onClick={refreshSessions}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none transition-colors"
          >
            <svg
              className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>

        {/* State Rendering */}
        {error ? (
          <ErrorState
            title="Unable to load interview sessions"
            message={error.message}
            onRetry={refreshSessions}
          />
        ) : !loading && (!sessions || sessions.length === 0) ? (
          <EmptyState
            title="No Interview Sessions Found"
            message="No candidate interviews have been initiated yet. Use the setup wizard to create your first session."
            action={
              <Link
                to="/setup"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gov-navy text-white text-xs font-bold rounded-lg hover:bg-gov-navy-light shadow-sm"
              >
                <span>Launch New Interview Wizard</span>
                <span>→</span>
              </Link>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={sessions || []}
            loading={loading}
            keyExtractor={(row) => row.id}
            caption="List of recent candidate interviews conducted at RAC DRDO"
            emptyMessage="No interviews recorded yet."
          />
        )}
      </section>
    </div>
  );
}

