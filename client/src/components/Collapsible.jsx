/**
 * @file Collapsible.jsx
 * @description Accessible expandable/collapsible disclosure panel.
 */

import React, { useState } from 'react';

/**
 * Collapsible accordion panel.
 *
 * @param {object} props
 * @param {string} props.title - Heading title of the collapsible section.
 * @param {React.ReactNode} [props.subtitle] - Optional subtitle or summary metadata.
 * @param {React.ReactNode} props.children - Collapsible content body.
 * @param {boolean} [props.defaultOpen=false] - Whether section starts expanded.
 * @param {string} [props.id='collapsible-section'] - Unique ID for ARIA controls.
 * @param {string} [props.className=''] - Extra classes.
 * @returns {React.ReactElement}
 */
export default function Collapsible({
  title,
  subtitle,
  children,
  defaultOpen = false,
  id = 'collapsible-section',
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm ${className}`}>
      <button
        type="button"
        id={`${id}-button`}
        aria-expanded={isOpen}
        aria-controls={`${id}-content`}
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full px-5 py-4 flex items-center justify-between text-left bg-slate-50 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gov-navy select-none"
      >
        <div>
          <h4 className="text-sm font-bold text-slate-900 tracking-wide flex items-center gap-2">
            <span>{title}</span>
          </h4>
          {subtitle && (
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          )}
        </div>

        <div className="shrink-0 ml-3 text-slate-600">
          <svg
            className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div
          id={`${id}-content`}
          role="region"
          aria-labelledby={`${id}-button`}
          className="p-5 border-t border-slate-200 bg-white"
        >
          {children}
        </div>
      )}
    </div>
  );
}

