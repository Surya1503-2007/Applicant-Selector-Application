/**
 * @file ProgressStrip.jsx
 * @description Live interview difficulty progression strip showing completed steps, verdicts, and active step.
 */

import React from 'react';

/**
 * Visual strip representing the adaptive path traversed so far.
 *
 * @param {object} props
 * @param {Array<{ step: number, difficulty: string, verdict: string, topic?: string }>} props.steps
 * @param {number} [props.currentStep=1]
 * @param {number} [props.totalSteps=10]
 * @param {string} [props.className='']
 * @returns {React.ReactElement}
 */
export default function ProgressStrip({
  steps = [],
  currentStep = 1,
  totalSteps = 10,
  className = '',
}) {
  const verdictColors = {
    STRONG: 'bg-emerald-500 text-white border-emerald-600',
    PARTIAL: 'bg-amber-500 text-white border-amber-600',
    IRRELEVANT: 'bg-rose-500 text-white border-rose-600',
    NOT_SCORED: 'bg-slate-400 text-white border-slate-500',
  };

  const diffBadgeColors = {
    EASY: 'bg-blue-100 text-blue-800',
    MEDIUM: 'bg-indigo-100 text-indigo-800',
    HARD: 'bg-purple-100 text-purple-800',
  };

  return (
    <div className={`w-full bg-slate-50 border border-slate-200 rounded-lg p-3 ${className}`}>
      <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-2.5">
        <span className="uppercase tracking-wider">Adaptive Progression Path</span>
        <span>
          Step {Math.min(currentStep, totalSteps)} of {totalSteps}
        </span>
      </div>

      <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
        {Array.from({ length: totalSteps }).map((_, index) => {
          const stepNumber = index + 1;
          const record = steps.find((s) => s.step === stepNumber);
          const isCurrent = stepNumber === currentStep;
          const isCompleted = Boolean(record);

          let circleStyle = 'bg-white border-slate-300 text-slate-400';
          if (isCompleted) {
            circleStyle = verdictColors[record.verdict] || 'bg-slate-500 text-white';
          } else if (isCurrent) {
            circleStyle = 'bg-gov-navy text-white ring-2 ring-gov-navy/30 border-gov-navy animate-pulse';
          }

          return (
            <div
              key={index}
              className="flex flex-col items-center justify-center p-1 rounded bg-white border border-slate-200 text-center"
              title={
                record
                  ? `Step ${stepNumber}: ${record.difficulty} (${record.verdict})`
                  : isCurrent
                  ? `Step ${stepNumber}: In Progress`
                  : `Step ${stepNumber}: Pending`
              }
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors ${circleStyle}`}
              >
                {stepNumber}
              </div>

              <div className="mt-1 text-[9px] font-mono font-bold uppercase truncate max-w-full">
                {record ? (
                  <span className={`px-1 py-0.2 rounded ${diffBadgeColors[record.difficulty] || 'bg-slate-100'}`}>
                    {record.difficulty[0]}
                  </span>
                ) : isCurrent ? (
                  <span className="text-gov-navy font-bold">NOW</span>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

