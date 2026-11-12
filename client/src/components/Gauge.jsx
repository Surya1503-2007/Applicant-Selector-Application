/**
 * @file Gauge.jsx
 * @description Semicircular SVG gauge for skill-match percentage and suitability band.
 * Uses pure SVG geometry without external charting libraries.
 */

import React from 'react';

/**
 * Returns color tokens based on the suitability band.
 *
 * @param {'STRONG'|'MODERATE'|'WEAK'|string} band
 * @returns {{ stroke: string, bg: string, text: string, track: string }}
 */
function getBandColors(band) {
  const normalized = (band || '').toUpperCase();
  switch (normalized) {
    case 'STRONG':
      return {
        stroke: '#16A34A', // Emerald 600
        bg: '#DCFCE7',     // Emerald 100
        text: '#15803D',   // Emerald 700
        track: '#E2E8F0',  // Slate 200
      };
    case 'MODERATE':
      return {
        stroke: '#D97706', // Amber 600
        bg: '#FEF3C7',     // Amber 100
        text: '#B45309',   // Amber 700
        track: '#E2E8F0',
      };
    case 'WEAK':
    default:
      return {
        stroke: '#DC2626', // Rose 600
        bg: '#FEE2E2',     // Rose 100
        text: '#B91C1C',   // Rose 700
        track: '#E2E8F0',
      };
  }
}

/**
 * Renders a semicircular SVG gauge representing match percentage (0..100%).
 *
 * @param {object} props
 * @param {number} props.matchPercent - Calculated percentage (0 to 100).
 * @param {'STRONG'|'MODERATE'|'WEAK'|string} props.band - Suitability band.
 * @param {string} [props.label='Candidate Match'] - Optional gauge title.
 * @param {number} [props.size=220] - Width/diameter of the gauge in pixels.
 * @returns {React.ReactElement}
 */
export default function Gauge({
  matchPercent = 0,
  band = 'WEAK',
  label = 'Candidate Match',
  size = 220,
}) {
  const percent = Math.max(0, Math.min(100, Number(matchPercent) || 0));
  const colors = getBandColors(band);

  // SVG Geometry Constants
  const strokeWidth = 18;
  const radius = 80;
  const cx = 110;
  const cy = 105;

  // Semicircle perimeter = π * radius
  const arcLength = Math.PI * radius;
  // Offset represents how much of the arc is filled
  const strokeDashoffset = arcLength * (1 - percent / 100);

  return (
    <div
      className="flex flex-col items-center justify-center select-none"
      role="meter"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuetext={`${percent}% - ${band}`}
    >
      <div className="relative" style={{ width: size, height: size * 0.62 }}>
        <svg
          viewBox="0 0 220 135"
          className="w-full h-full overflow-visible"
        >
          {/* Background Track Arc */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke={colors.track}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Filled Progress Arc */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={arcLength}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-700 ease-out"
          />

          {/* Percentage Text */}
          <text
            x={cx}
            y={cy - 12}
            textAnchor="middle"
            className="font-bold text-3xl fill-slate-900"
            style={{ fontSize: '32px', fontWeight: '800' }}
          >
            {percent}%
          </text>

          {/* Semicircle baseline markers */}
          <text
            x={cx - radius}
            y={cy + 18}
            textAnchor="middle"
            className="text-[10px] fill-slate-400 font-mono"
          >
            0%
          </text>
          <text
            x={cx + radius}
            y={cy + 18}
            textAnchor="middle"
            className="text-[10px] fill-slate-400 font-mono"
          >
            100%
          </text>
        </svg>
      </div>

      {/* Band Badge Below Gauge */}
      <div className="mt-1 flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase border"
          style={{
            backgroundColor: colors.bg,
            color: colors.text,
            borderColor: colors.stroke,
          }}
        >
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: colors.stroke }}
            aria-hidden="true"
          />
          {band} SUITABILITY
        </span>
      </div>
    </div>
  );
}

