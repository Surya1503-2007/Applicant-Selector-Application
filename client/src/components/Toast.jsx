/**
 * @file Toast.jsx
 * @description Accessible notification banner with auto-dismissal.
 */

import React, { useEffect } from 'react';

/**
 * Toast notification banner.
 *
 * @param {object} props
 * @param {string} props.message - Notification text.
 * @param {'success'|'error'|'warning'|'info'} [props.type='info'] - Status type.
 * @param {() => void} props.onClose - Dismiss callback.
 * @param {number} [props.duration=4000] - Duration in ms before auto-close.
 * @returns {React.ReactElement|null}
 */
export default function Toast({
  message,
  type = 'info',
  onClose,
  duration = 4000,
}) {
  useEffect(() => {
    if (!message || !onClose) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, onClose, duration]);

  if (!message) return null;

  const styles = {
    success: {
      bg: 'bg-emerald-50 border-emerald-300 text-emerald-900',
      icon: (
        <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    error: {
      bg: 'bg-rose-50 border-rose-300 text-rose-900',
      icon: (
        <svg className="w-5 h-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
    },
    warning: {
      bg: 'bg-amber-50 border-amber-300 text-amber-900',
      icon: (
        <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    info: {
      bg: 'bg-slate-50 border-slate-300 text-slate-900',
      icon: (
        <svg className="w-5 h-5 text-gov-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  }[type] || {
    bg: 'bg-slate-50 border-slate-300 text-slate-900',
    icon: null,
  };

  return (
    <div
      className="fixed bottom-5 right-5 z-50 max-w-md animate-in slide-in-from-bottom-5 duration-200"
      role={type === 'error' ? 'alert' : 'status'}
    >
      <div className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg ${styles.bg}`}>
        <div className="flex-shrink-0">{styles.icon}</div>
        <div className="flex-1 text-sm font-medium leading-snug">{message}</div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 rounded p-0.5 focus:outline-none"
          aria-label="Close notification"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

