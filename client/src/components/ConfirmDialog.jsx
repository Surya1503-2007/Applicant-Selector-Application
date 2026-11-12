/**
 * @file ConfirmDialog.jsx
 * @description Accessible modal dialog for examiner overrides and critical confirmations.
 */

import React, { useEffect, useRef } from 'react';

/**
 * Accessible confirmation modal.
 *
 * @param {object} props
 * @param {boolean} props.isOpen - Whether the dialog is visible.
 * @param {string} props.title - Modal heading.
 * @param {React.ReactNode} props.message - Descriptive text or node explaining the decision.
 * @param {string} [props.confirmText='Confirm & Proceed'] - Confirmation action label.
 * @param {string} [props.cancelText='Cancel'] - Dismiss action label.
 * @param {() => void} props.onConfirm - Confirm callback.
 * @param {() => void} props.onCancel - Cancel callback.
 * @param {'warning'|'danger'|'info'} [props.variant='warning'] - Visual severity tier.
 * @param {boolean} [props.loading=false] - Whether action is processing.
 * @returns {React.ReactElement|null}
 */
export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm & Proceed',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'warning',
  loading = false,
}) {
  const confirmButtonRef = useRef(null);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // Auto-focus confirm button on open
    setTimeout(() => {
      confirmButtonRef.current?.focus();
    }, 50);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, loading]);

  if (!isOpen) return null;

  const variantStyles = {
    warning: {
      iconBg: 'bg-amber-100 text-amber-700',
      btnBg: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500 text-white',
      border: 'border-amber-200',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      ),
    },
    danger: {
      iconBg: 'bg-rose-100 text-rose-700',
      btnBg: 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500 text-white',
      border: 'border-rose-200',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      ),
    },
  }[variant] || {
    iconBg: 'bg-amber-100 text-amber-700',
    btnBg: 'bg-amber-600 hover:bg-amber-700 text-white',
    border: 'border-amber-200',
    icon: null,
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
    >
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${variantStyles.iconBg}`}
              aria-hidden="true"
            >
              {variantStyles.icon}
            </div>

            <div className="flex-1">
              <h3
                id="confirm-dialog-title"
                className="text-lg font-bold text-slate-900 leading-6"
              >
                {title}
              </h3>
              <div
                id="confirm-dialog-desc"
                className="mt-2 text-sm text-slate-600 leading-relaxed space-y-2"
              >
                {message}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-5 py-2 text-sm font-semibold rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors flex items-center gap-2 ${variantStyles.btnBg} disabled:opacity-50`}
          >
            {loading && (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
            )}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

