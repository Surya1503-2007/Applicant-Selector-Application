/**
 * @file DifficultyChart.jsx
 * @description Responsive pure SVG step/line chart depicting the interview difficulty progression.
 * Plots EASY, MEDIUM, and HARD trajectories colored by answer verdict without external charting libraries.
 */

import React from 'react';

/**
 * Renders an accessible pure SVG difficulty progression chart.
 *
 * @param {object} props
 * @param {Array<{ step: number, difficulty: 'EASY'|'MEDIUM'|'HARD', verdict: string }>} props.progression
 * @param {string} [props.className='']
 * @returns {React.ReactElement}
 */
export default function DifficultyChart({ progression = [], className = '' }) {
  if (!progression || progression.length === 0) {
    return (
      <div className="w-full h-48 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-xs italic">
        No progression data recorded.
      </div>
    );
  }

  // Chart Dimensions & Grid Mapping
  const width = 640;
  const height = 220;
  const paddingLeft = 85;
  const paddingRight = 35;
  const paddingTop = 35;
  const paddingBottom = 45;

  const innerWidth = width - paddingLeft - paddingRight;
  const totalSteps = Math.max(progression.length, 4);

  // Y-axis mappings
  const yMap = {
    HARD: paddingTop + 10,                 // 45
    MEDIUM: paddingTop + (height - paddingTop - paddingBottom) / 2, // 105
    EASY: height - paddingBottom - 10,      // 165
  };

  // Helper for X coordinates
  const getX = (stepIndex) => {
    if (totalSteps <= 1) return paddingLeft + innerWidth / 2;
    return paddingLeft + (stepIndex / (totalSteps - 1)) * innerWidth;
  };

  // Helper for verdict colors
  const getVerdictColor = (verdict) => {
    switch ((verdict || '').toUpperCase()) {
      case 'STRONG':
        return { fill: '#10B981', stroke: '#047857' }; // Emerald
      case 'PARTIAL':
        return { fill: '#F59E0B', stroke: '#B45309' }; // Amber
      case 'IRRELEVANT':
        return { fill: '#EF4444', stroke: '#B91C1C' }; // Rose
      case 'NOT_SCORED':
      default:
        return { fill: '#64748B', stroke: '#334155' }; // Slate
    }
  };

  // Build connecting polyline path
  const points = progression.map((item, idx) => {
    const x = getX(idx);
    const y = yMap[item.difficulty] || yMap.EASY;
    return `${x},${y}`;
  });
  const pathD = points.length > 0 ? `M ${points.join(' L ')}` : '';

  return (
    <div className={`w-full bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-200 gap-2 mb-2">
        <div>
          <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
            Difficulty Trajectory & Verdict Progression
          </h4>
          <p className="text-xs text-slate-500">
            Adaptive engine question sequencing and candidate assessment response map
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Strong</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Partial</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>Irrelevant</span>
          </div>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-w-[500px] select-none"
          role="img"
          aria-label="Interview difficulty progression line chart"
        >
          {/* Horizontal Level Guides */}
          {['HARD', 'MEDIUM', 'EASY'].map((level) => {
            const y = yMap[level];
            return (
              <g key={level}>
                {/* Level Label */}
                <text
                  x={paddingLeft - 12}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-600 text-[11px] font-bold font-mono"
                >
                  {level}
                </text>
                {/* Dashed Horizontal Grid Line */}
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#E2E8F0"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
              </g>
            );
          })}

          {/* X Axis Line */}
          <line
            x1={paddingLeft}
            y1={height - paddingBottom}
            x2={width - paddingRight}
            y2={height - paddingBottom}
            stroke="#CBD5E1"
            strokeWidth="2"
          />

          {/* X Axis Step Labels */}
          {progression.map((item, idx) => {
            const x = getX(idx);
            return (
              <g key={idx}>
                <line
                  x1={x}
                  y1={height - paddingBottom}
                  x2={x}
                  y2={height - paddingBottom + 5}
                  stroke="#94A3B8"
                  strokeWidth="1.5"
                />
                <text
                  x={x}
                  y={height - paddingBottom + 18}
                  textAnchor="middle"
                  className="fill-slate-700 text-[11px] font-mono font-bold"
                >
                  Q{item.step || idx + 1}
                </text>
              </g>
            );
          })}

          {/* Stepped/Interpolated Connecting Line */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="#0F1E36"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data Points */}
          {progression.map((item, idx) => {
            const x = getX(idx);
            const y = yMap[item.difficulty] || yMap.EASY;
            const colors = getVerdictColor(item.verdict);

            return (
              <g key={idx} className="cursor-pointer group">
                {/* Outer Ring */}
                <circle
                  cx={x}
                  cy={y}
                  r="7"
                  fill={colors.fill}
                  stroke="#FFFFFF"
                  strokeWidth="2.5"
                  className="transition-transform duration-150 group-hover:scale-125"
                />
                {/* Tooltip on Hover */}
                <title>
                  {`Question ${item.step || idx + 1}: ${item.difficulty} Difficulty (${item.verdict})`}
                </title>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

