/**
 * @file TopicBar.jsx
 * @description Horizontal progress bar representing candidate topic proficiency and classification.
 */

import React from 'react';

/**
 * Topic assessment progress bar.
 *
 * @param {object} props
 * @param {string} props.topicName - Name of the technical topic.
 * @param {number} props.score - Average score percentage (0..100).
 * @param {'STRENGTH'|'AVERAGE'|'WEAKNESS'|'NOT_ASSESSED'} props.classification - Topic classification tier.
 * @param {'HARD'|'MEDIUM'|'EASY'|'N/A'|string} [props.highestDifficultyReached='EASY'] - Highest difficulty tier attained.
 * @returns {React.ReactElement}
 */
export default function TopicBar({
  topicName,
  score = 0,
  classification = 'AVERAGE',
  highestDifficultyReached = 'EASY',
}) {
  const numScore = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));

  const classBadges = {
    STRENGTH: {
      label: 'STRENGTH',
      bg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      barColor: 'bg-emerald-600',
    },
    AVERAGE: {
      label: 'AVERAGE',
      bg: 'bg-blue-100 text-blue-800 border-blue-300',
      barColor: 'bg-blue-600',
    },
    WEAKNESS: {
      label: 'WEAKNESS',
      bg: 'bg-rose-100 text-rose-800 border-rose-300',
      barColor: 'bg-rose-600',
    },
    NOT_ASSESSED: {
      label: 'NOT ASSESSED',
      bg: 'bg-slate-100 text-slate-600 border-slate-300',
      barColor: 'bg-slate-400',
    },
  };

  const badge = classBadges[classification] || classBadges.AVERAGE;
  const isAssessed = classification !== 'NOT_ASSESSED';

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs">
        <div className="font-bold text-slate-900 text-sm">
          {topicName}
        </div>

        <div className="flex items-center gap-2">
          {isAssessed && (
            <span className="text-xs font-mono font-bold text-slate-700">
              {numScore}%
            </span>
          )}
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${badge.bg}`}
          >
            {badge.label}
          </span>
          <span
            className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-slate-200 text-slate-800"
            title="Highest difficulty reached in this domain"
          >
            Max: {highestDifficultyReached}
          </span>
        </div>
      </div>

      {/* Progress Bar Track */}
      <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-2.5 rounded-full transition-all duration-300 ${badge.barColor}`}
          style={{ width: isAssessed ? `${numScore}%` : '0%' }}
          role="progressbar"
          aria-valuenow={numScore}
          aria-valuemin="0"
          aria-valuemax="100"
        />
      </div>
    </div>
  );
}

