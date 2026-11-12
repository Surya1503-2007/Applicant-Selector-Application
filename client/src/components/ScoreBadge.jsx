/**
 * @file ScoreBadge.jsx
 * @description Accessible score badge displaying numeric percentage with color tiering and textual label.
 */

import React from 'react';

/**
 * Score badge with accessible color-coding and icons.
 *
 * @param {object} props
 * @param {number} props.score - Score value (0..100).
 * @param {string} [props.label='Score'] - Optional accessibility label prefix.
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Visual size tier.
 * @param {string} [props.className=''] - Extra classes.
 * @returns {React.ReactElement}
 */
export default function ScoreBadge({
  score = 0,
  label = 'Score',
  size = 'md',
  className = '',
}) {
  const numScore = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));

  let tier = {
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    iconBg: 'bg-emerald-600',
    descriptor: 'Strong',
  };

  if (numScore < 50) {
    tier = {
      bg: 'bg-rose-50 text-rose-800 border-rose-300',
      iconBg: 'bg-rose-600',
      descriptor: 'Low',
    };
  } else if (numScore < 70) {
    tier = {
      bg: 'bg-amber-50 text-amber-800 border-amber-300',
      iconBg: 'bg-amber-600',
      descriptor: 'Moderate',
    };
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs font-semibold px-2.5 py-1 gap-1.5',
    lg: 'text-sm font-bold px-3 py-1.5 gap-2',
  }[size] || 'text-xs px-2.5 py-1 gap-1.5';

  return (
    <span
      className={`inline-flex items-center rounded-md border font-mono ${tier.bg} ${sizeClasses} ${className}`}
      title={`${label}: ${numScore}% (${tier.descriptor})`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${tier.iconBg} shrink-0`} aria-hidden="true" />
      <span>{numScore}%</span>
    </span>
  );
}

