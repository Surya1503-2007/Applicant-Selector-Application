/**
 * @file Spinner.jsx
 * @description Accessible loading indicator.
 */

import React from 'react';

/**
 * Loading spinner component.
 *
 * @param {object} props
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Spinner dimensions.
 * @param {string} [props.className=''] - Extra classes.
 * @param {string} [props.label='Loading...'] - Screen reader label.
 * @returns {React.ReactElement}
 */
export default function Spinner({ size = 'md', className = '', label = 'Loading...' }) {
  const sizeMap = {
    sm: 'w-4 h-4 border-2',
    md: 'w-7 h-7 border-3',
    lg: 'w-10 h-10 border-4',
  };

  const dim = sizeMap[size] || sizeMap.md;

  return (
    <div
      role="status"
      className={`inline-flex items-center justify-center ${className}`}
      aria-label={label}
    >
      <div
        className={`${dim} border-slate-200 border-t-gov-gold rounded-full animate-spin`}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

