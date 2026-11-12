/**
 * @file EmptyState.jsx
 * @description Accessible view rendered when no records or data items are available.
 */

import React from 'react';

/**
 * Empty state presentation component.
 *
 * @param {object} props
 * @param {string} [props.title='No Records Found'] - Heading.
 * @param {string} [props.message='There are no items to display at this time.'] - Explanation.
 * @param {React.ReactNode} [props.icon] - Optional custom icon.
 * @param {React.ReactNode} [props.action] - Optional call to action button.
 * @param {string} [props.className=''] - Extra classes.
 * @returns {React.ReactElement}
 */
export default function EmptyState({
  title = 'No Records Found',
  message = 'There are no items to display at this time.',
  icon,
  action,
  className = '',
}) {
  return (
    <div
      className={`text-center py-12 px-6 bg-white border border-slate-200 rounded-xl shadow-sm ${className}`}
    >
      <div className="w-12 h-12 mx-auto mb-3 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center">
        {icon || (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
        )}
      </div>
      <h3 className="text-base font-bold text-slate-800 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 max-w-sm mx-auto mb-5 leading-relaxed">{message}</p>
      {action && <div className="flex justify-center">{action}</div>}
    </div>
  );
}

