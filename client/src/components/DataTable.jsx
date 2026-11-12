/**
 * @file DataTable.jsx
 * @description Accessible, responsive tabular data component adhering to government design standards.
 */

import React from 'react';
import Spinner from './Spinner';

/**
 * Tabular data presentation component.
 *
 * @param {object} props
 * @param {Array<{
 *   header: string,
 *   accessor?: string|((row: any) => any),
 *   render?: (row: any, index: number) => React.ReactNode,
 *   className?: string,
 *   headerClassName?: string
 * }>} props.columns - Column configuration definitions.
 * @param {Array<any>} props.data - Rows data.
 * @param {(row: any, index: number) => string|number} [props.keyExtractor] - Row key extractor.
 * @param {string} [props.emptyMessage='No records found.'] - Message rendered on empty data.
 * @param {boolean} [props.loading=false] - Whether data is loading.
 * @param {string} [props.caption] - Accessible table caption.
 * @param {string} [props.className=''] - Extra wrapper classes.
 * @returns {React.ReactElement}
 */
export default function DataTable({
  columns = [],
  data = [],
  keyExtractor = (row, i) => row.id || i,
  emptyMessage = 'No records found.',
  loading = false,
  caption,
  className = '',
}) {
  return (
    <div className={`w-full overflow-hidden border border-slate-200 rounded-lg shadow-sm bg-white ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider">
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  scope="col"
                  className={`py-3.5 px-4 font-bold text-slate-800 ${col.headerClassName || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Spinner size="md" label="Loading table records..." />
                    <span className="text-xs font-medium text-slate-500">Retrieving assessment records...</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-10 text-center text-slate-500 italic">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, rowIdx) => (
                <tr
                  key={keyExtractor(row, rowIdx)}
                  className={`hover:bg-slate-50/80 transition-colors ${
                    rowIdx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                  }`}
                >
                  {columns.map((col, colIdx) => {
                    let cellContent = null;
                    if (typeof col.render === 'function') {
                      cellContent = col.render(row, rowIdx);
                    } else if (typeof col.accessor === 'function') {
                      cellContent = col.accessor(row);
                    } else if (typeof col.accessor === 'string') {
                      cellContent = row[col.accessor];
                    }

                    return (
                      <td
                        key={colIdx}
                        className={`py-3.5 px-4 text-slate-700 align-middle ${col.className || ''}`}
                      >
                        {cellContent !== undefined && cellContent !== null ? cellContent : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

