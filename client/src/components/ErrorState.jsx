/**
 * @file ErrorState.jsx
 * @description Accessible error message view with retry capability.
 */

import React from 'react';

/**
 * Standard error state presentation.
 *
 * @param {object} props
 * @param {string} [props.title='Unable to load data'] - Error heading.
 * @param {string|Error} [props.message='An unexpected error occurred while communicating with the assessment system.'] - User-friendly message.
 * @param {() => void} [props.onRetry] - Optional retry handler.
 * @param {boolean} [props.compact=false] - Whether to render in inline compact format.
 * @param {string} [props.className=''] - Extra classes.
 * @returns {React.ReactElement}
 */
export default function ErrorState({
  title = 'Unable to Load Data',
  message = 'An unexpected error occurred while communicating with the assessment system.',
  onRetry,
  compact = false,
  className = '',
}) {
  const displayMessage =
    typeof message === 'string'
      ? message
      : message?.message || 'A system communication error occurred.';

  if (compact) {
    return (
      <div
        role="alert"
        className={`flex items-center justify-between p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-sm ${className}`}
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-rose-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span className="font-medium">{displayMessage}</span>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="text-xs font-semibold underline hover:text-rose-950 focus:outline-none"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={`text-center py-10 px-6 bg-white border border-rose-200 rounded-xl shadow-sm ${className}`}
    >
      <div className="w-12 h-12 mx-auto mb-3 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h3 className="text-base font-bold text-slate-900 mb-1">{title}</h3>
      <p className="text-sm text-slate-600 max-w-md mx-auto mb-5 leading-relaxed">
        {displayMessage}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-gov-gold focus:ring-offset-2 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Retry Operation</span>
        </button>
      )}
    </div>
  );
}

