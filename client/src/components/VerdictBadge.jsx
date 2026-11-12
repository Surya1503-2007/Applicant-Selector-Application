/**
 * @file VerdictBadge.jsx
 * @description Accessible badge for answer evaluation verdicts (STRONG | PARTIAL | IRRELEVANT | NOT_SCORED).
 * Never relies on color alone — incorporates clear text and distinctive SVG icons.
 */

import React from 'react';

/**
 * Verdict badge component.
 *
 * @param {object} props
 * @param {'STRONG'|'PARTIAL'|'IRRELEVANT'|'NOT_SCORED'|string} props.verdict
 * @param {'sm'|'md'|'lg'} [props.size='md']
 * @param {string} [props.className='']
 * @returns {React.ReactElement}
 */
export default function VerdictBadge({
  verdict = 'NOT_SCORED',
  size = 'md',
  className = '',
}) {
  const norm = (verdict || 'NOT_SCORED').toUpperCase();

  const configs = {
    STRONG: {
      text: 'STRONG',
      bg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    PARTIAL: {
      text: 'PARTIAL',
      bg: 'bg-amber-50 text-amber-800 border-amber-300',
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    IRRELEVANT: {
      text: 'IRRELEVANT',
      bg: 'bg-rose-50 text-rose-800 border-rose-300',
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    NOT_SCORED: {
      text: 'NOT SCORED',
      bg: 'bg-slate-100 text-slate-700 border-slate-300',
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
  };

  const current = configs[norm] || configs.NOT_SCORED;

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 gap-1 font-semibold',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-bold',
    lg: 'text-sm px-3.5 py-1.5 gap-2 font-extrabold',
  }[size] || 'text-xs px-2.5 py-1 gap-1.5 font-bold';

  return (
    <span
      className={`inline-flex items-center rounded border tracking-wide uppercase ${current.bg} ${sizeStyles} ${className}`}
    >
      {current.icon}
      <span>{current.text}</span>
    </span>
  );
}

