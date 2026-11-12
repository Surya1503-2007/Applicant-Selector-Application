/**
 * @file ChipInput.jsx
 * @description Accessible tag/chip input component for entering and managing candidate skills.
 */

import React, { useState } from 'react';

/**
 * Interactive chip input allowing examiners to enter and remove skill tags.
 *
 * @param {object} props
 * @param {string[]} props.chips - Current array of skill strings.
 * @param {(chips: string[]) => void} props.onChange - Handler called when chips are added or removed.
 * @param {string} [props.label='Candidate Competencies'] - Field label.
 * @param {string} [props.placeholder='Type skill and press Enter (e.g. MBSE, DO-178C)...'] - Input placeholder.
 * @param {string} [props.id='skills-input'] - HTML ID.
 * @param {string[]} [props.suggestions=[]] - Optional list of quick-add skills.
 * @param {string} [props.error=''] - Optional error message.
 * @param {boolean} [props.disabled=false] - Whether input is disabled.
 * @returns {React.ReactElement}
 */
export default function ChipInput({
  chips = [],
  onChange,
  label = 'Candidate Competencies',
  placeholder = 'Type skill and press Enter or click Add...',
  id = 'skills-input',
  suggestions = [],
  error = '',
  disabled = false,
}) {
  const [inputValue, setInputValue] = useState('');
  const [localFeedback, setLocalFeedback] = useState('');

  const addChip = (text) => {
    const trimmed = (text || '').trim();
    if (!trimmed) return;

    // Check duplicate (case-insensitive)
    const exists = chips.some((c) => c.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      setLocalFeedback(`"${trimmed}" is already added.`);
      setTimeout(() => setLocalFeedback(''), 2500);
      return;
    }

    setLocalFeedback('');
    onChange([...chips, trimmed]);
    setInputValue('');
  };

  const removeChip = (indexToRemove) => {
    if (disabled) return;
    onChange(chips.filter((_, i) => i !== indexToRemove));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addChip(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && chips.length > 0) {
      removeChip(chips.length - 1);
    }
  };

  // Filter suggestions to show only unadded ones
  const availableSuggestions = (suggestions || []).filter(
    (s) => !chips.some((c) => c.toLowerCase() === s.toLowerCase())
  );

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={id} className="block text-sm font-semibold text-slate-800">
          {label}
        </label>
        <span className="text-xs text-slate-500 font-medium">
          {chips.length} {chips.length === 1 ? 'skill' : 'skills'} added
        </span>
      </div>

      {/* Input container */}
      <div
        className={`min-h-[52px] w-full p-2 bg-white border rounded-lg transition-colors flex flex-wrap items-center gap-1.5 ${
          error
            ? 'border-rose-400 focus-within:ring-2 focus-within:ring-rose-500'
            : 'border-slate-300 focus-within:border-slate-500 focus-within:ring-2 focus-within:ring-gov-gold'
        } ${disabled ? 'bg-slate-100 opacity-70 cursor-not-allowed' : ''}`}
      >
        {/* Chips display */}
        {chips.map((chip, idx) => (
          <span
            key={`${chip}-${idx}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-800 border border-slate-300 text-xs font-medium rounded-md shadow-sm"
          >
            <span>{chip}</span>
            {!disabled && (
              <button
                type="button"
                onClick={() => removeChip(idx)}
                className="text-slate-400 hover:text-rose-600 focus:outline-none focus:text-rose-600 rounded-sm"
                aria-label={`Remove skill ${chip}`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            )}
          </span>
        ))}

        {/* Text Input */}
        <div className="flex-1 min-w-[200px] flex items-center">
          <input
            id={id}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setLocalFeedback('');
            }}
            onKeyDown={handleKeyDown}
            placeholder={chips.length === 0 ? placeholder : 'Add another skill...'}
            disabled={disabled}
            className="w-full text-sm text-slate-900 bg-transparent border-none outline-none focus:ring-0 placeholder:text-slate-400 py-1 px-1"
          />
          {inputValue.trim() && (
            <button
              type="button"
              onClick={() => addChip(inputValue)}
              className="ml-2 px-2.5 py-0.5 bg-gov-navy text-white text-xs font-semibold rounded hover:bg-gov-navy-light focus:outline-none"
            >
              Add
            </button>
          )}
        </div>
      </div>

      {/* Local validation or duplicate notice */}
      {localFeedback && (
        <p className="mt-1 text-xs text-amber-600 font-medium" role="alert">
          {localFeedback}
        </p>
      )}

      {/* Form Error */}
      {error && !localFeedback && (
        <p className="mt-1 text-xs text-rose-600 font-medium" role="alert">
          {error}
        </p>
      )}

      {/* Suggested Quick-Add Skills from Post */}
      {availableSuggestions.length > 0 && !disabled && (
        <div className="mt-2.5">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
            Suggested Required Competencies (Click to add):
          </span>
          <div className="flex flex-wrap gap-1.5">
            {availableSuggestions.slice(0, 8).map((sugg) => (
              <button
                key={sugg}
                type="button"
                onClick={() => addChip(sugg)}
                className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
                title={`Click to add ${sugg}`}
              >
                <span>+</span>
                <span>{sugg}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

