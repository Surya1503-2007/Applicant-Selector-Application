/**
 * @file RankingsPage.jsx
 * @description Recruitment Rankings and Dossier Archive view (/reports) for RAC DRDO examiners.
 *
 * Implements:
 *  - Tabular ranking matrix of all evaluated candidates across recruitment posts.
 *  - Filtering by Post vacancy and Recommendation status (SUITABLE, BORDERLINE, NOT_SUITABLE).
 *  - Sorting by Overall Score.
 *  - Direct row navigation to the candidate assessment report dossier (/report/:sessionId).
 *  - Loading, error, and empty state presentations.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { fetchRankings } from '../api/client';
import ScoreBadge from '../components/ScoreBadge';
import Spinner from '../components/Spinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

export default function RankingsPage() {
  const navigate = useNavigate();

  // Data State
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Sorting
  const [selectedPost, setSelectedPost] = useState('ALL');
  const [selectedRec, setSelectedRec] = useState('ALL');
  const [sortOrder, setSortOrder] = useState('DESC'); // 'DESC' | 'ASC'
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch rankings
  const loadRankings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRankings();
      setRankings(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to retrieve recruitment rankings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRankings();
  }, []);

  // Distinct posts for filter dropdown
  const uniquePosts = useMemo(() => {
    const set = new Set();
    rankings.forEach((r) => {
      if (r.postApplied) set.add(r.postApplied);
    });
    return Array.from(set);
  }, [rankings]);

  // Filtered & Sorted Rankings
  const processedRankings = useMemo(() => {
    return rankings
      .filter((r) => {
        // Post Filter
        if (selectedPost !== 'ALL' && r.postApplied !== selectedPost) {
          return false;
        }
        // Recommendation Filter
        if (selectedRec !== 'ALL' && r.recommendation !== selectedRec) {
          return false;
        }
        // Search Query
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          const nameMatch = (r.candidateName || '').toLowerCase().includes(query);
          const postMatch = (r.postApplied || '').toLowerCase().includes(query);
          if (!nameMatch && !postMatch) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const scoreA = Number(a.overallScore) || 0;
        const scoreB = Number(b.overallScore) || 0;
        return sortOrder === 'DESC' ? scoreB - scoreA : scoreA - scoreB;
      });
  }, [rankings, selectedPost, selectedRec, searchQuery, sortOrder]);

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-4 border-b border-slate-200 gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-widest text-slate-500">
            <span>RAC DRDO BOARDROOM</span>
            <span>/</span>
            <span className="text-gov-navy">DOSSIER RANKINGS ARCHIVE</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Recruitment Assessment Rankings
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Comparative performance matrix across Scientist & Engineer vacancy applicant cohorts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/setup"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gov-navy text-white rounded-lg text-xs font-bold hover:bg-gov-navy-light shadow-sm transition-colors"
          >
            <svg className="w-4 h-4 text-gov-gold" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                clipRule="evenodd"
              />
            </svg>
            <span>Start New Interview</span>
          </Link>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        {/* Search */}
        <div>
          <label htmlFor="rankings-search" className="block font-bold text-slate-700 uppercase mb-1">
            Search Candidate
          </label>
          <input
            id="rankings-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or post..."
            className="w-full p-2 rounded border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-gov-navy"
          />
        </div>

        {/* Post Filter */}
        <div>
          <label htmlFor="filter-post" className="block font-bold text-slate-700 uppercase mb-1">
            Filter by Vacancy Post
          </label>
          <select
            id="filter-post"
            value={selectedPost}
            onChange={(e) => setSelectedPost(e.target.value)}
            className="w-full p-2 rounded border border-slate-300 text-xs text-slate-900 bg-white"
          >
            <option value="ALL">All Posts ({rankings.length})</option>
            {uniquePosts.map((post) => (
              <option key={post} value={post}>
                {post}
              </option>
            ))}
          </select>
        </div>

        {/* Recommendation Filter */}
        <div>
          <label htmlFor="filter-rec" className="block font-bold text-slate-700 uppercase mb-1">
            Recommendation Tier
          </label>
          <select
            id="filter-rec"
            value={selectedRec}
            onChange={(e) => setSelectedRec(e.target.value)}
            className="w-full p-2 rounded border border-slate-300 text-xs text-slate-900 bg-white"
          >
            <option value="ALL">All Recommendations</option>
            <option value="SUITABLE">SUITABLE</option>
            <option value="BORDERLINE">BORDERLINE</option>
            <option value="NOT_SUITABLE">NOT_SUITABLE</option>
          </select>
        </div>

        {/* Sort Order */}
        <div>
          <label htmlFor="sort-order" className="block font-bold text-slate-700 uppercase mb-1">
            Score Order
          </label>
          <button
            id="sort-order"
            type="button"
            onClick={() => setSortOrder((prev) => (prev === 'DESC' ? 'ASC' : 'DESC'))}
            className="w-full p-2 rounded border border-slate-300 text-xs font-bold text-slate-800 bg-slate-50 hover:bg-slate-100 flex items-center justify-between"
          >
            <span>Score: {sortOrder === 'DESC' ? 'Highest First' : 'Lowest First'}</span>
            <svg
              className={`w-4 h-4 transition-transform ${sortOrder === 'ASC' ? 'rotate-180' : ''}`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Rankings Data Table */}
      {loading ? (
        <div className="py-24 text-center bg-white border border-slate-200 rounded-xl shadow-sm">
          <Spinner size="lg" label="Compiling recruitment rankings..." />
        </div>
      ) : error ? (
        <ErrorState
          title="Failed to Load Rankings Matrix"
          message={error}
          onRetry={loadRankings}
        />
      ) : processedRankings.length === 0 ? (
        <EmptyState
          title="No Matching Candidate Dossiers"
          description="No candidate assessments match the active filter criteria. Adjust your search parameters or initiate a new interview."
          actionText="Clear Filters"
          onAction={() => {
            setSelectedPost('ALL');
            setSelectedRec('ALL');
            setSearchQuery('');
          }}
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[11px]">
                  <th className="py-3.5 px-4 w-12 text-center">Rank</th>
                  <th className="py-3.5 px-4">Candidate Profile</th>
                  <th className="py-3.5 px-4">Target Post</th>
                  <th className="py-3.5 px-4 text-center">Overall Score</th>
                  <th className="py-3.5 px-4 text-center">Board Recommendation</th>
                  <th className="py-3.5 px-4 text-center">Interview Date</th>
                  <th className="py-3.5 px-4 text-center">Session Status</th>
                  <th className="py-3.5 px-4 text-center w-28">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {processedRankings.map((row, index) => {
                  const recStyle = recBadgeConfig[row.recommendation] || recBadgeConfig.SUITABLE;

                  return (
                    <tr
                      key={row.sessionId}
                      onClick={() => navigate(`/report/${row.sessionId}`)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer group"
                    >
                      {/* Rank */}
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-500">
                        #{index + 1}
                      </td>

                      {/* Candidate */}
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-slate-900 group-hover:text-gov-navy">
                          {row.candidateName}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          ID: {row.candidateId?.slice(0, 10)}...
                        </div>
                      </td>

                      {/* Post */}
                      <td className="py-3.5 px-4 font-semibold text-slate-700">
                        {row.postApplied}
                      </td>

                      {/* Overall Score */}
                      <td className="py-3.5 px-4 text-center">
                        <ScoreBadge score={row.overallScore} size="md" />
                      </td>

                      {/* Recommendation */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold border ${recStyle.bg}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${recStyle.dot}`} />
                            <span>{recStyle.label}</span>
                          </span>
                          {row.isOverridden && (
                            <span
                              className="text-[9px] font-bold px-1 py-0.2 rounded bg-purple-100 text-purple-800"
                              title="Board recommendation overridden"
                            >
                              MOD
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-center font-medium text-slate-600">
                        {row.interviewDate}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            row.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-blue-50 text-blue-800 border border-blue-200'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-center">
                        <Link
                          to={`/report/${row.sessionId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs font-bold text-gov-navy hover:underline"
                        >
                          <span>Dossier</span>
                          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path
                              fillRule="evenodd"
                              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

