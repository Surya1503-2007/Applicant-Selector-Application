/**
 * @file BandBadge.jsx
 * @description Accessible status badge for candidate suitability bands (STRONG | MODERATE | WEAK).
 * Never relies on color alone — incorporates distinct text and icons.
 */

import React from 'react';

/**
 * Renders an accessible suitability band badge.
 *
 * @param {object} props
 * @param {'STRONG'|'MODERATE'|'WEAK'|string} props.band - Suitability band.
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Visual size tier.
 * @param {string} [props.className=''] - Extra classes.
 * @returns {React.ReactElement}
 */
export default function BandBadge({ band = 'WEAK', size = 'md', className = '' }) {
  const norm = (band || '').toUpperCase();

  const configs = {
    STRONG: {
      label: 'STRONG FIT',
      bg: 'bg-emerald-50',
      text: 'text-emerald-800',
      border: 'border-emerald-300',
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
    MODERATE: {
      label: 'MODERATE FIT',
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-300',
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
    WEAK: {
      label: 'WEAK FIT',
      bg: 'bg-rose-50',
      text: 'text-rose-800',
      border: 'border-rose-300',
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
  };

  const current = configs[norm] || configs.WEAK;

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3.5 py-1.5 gap-2 font-semibold',
  }[size] || 'text-xs px-2.5 py-1 gap-1.5';

  return (
    <span
      className={`inline-flex items-center font-bold tracking-wide rounded-md border ${current.bg} ${current.text} ${current.border} ${sizeClasses} ${className}`}
      role="status"
      aria-label={`Suitability rating: ${current.label}`}
    >
      <span aria-hidden="true">{current.icon}</span>
      <span>{current.label}</span>
    </span>
  );
}

