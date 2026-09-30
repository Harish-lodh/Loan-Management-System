import React from 'react';
import { EmptyState } from './AsyncState';

export default function DataTable({ columns, rows, rowKey = 'id', emptyTitle = 'No records found', emptyDescription }) {
  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={`px-4 py-3 font-semibold ${column.className || ''}`}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row) => (
              <tr key={typeof rowKey === 'function' ? rowKey(row) : row[rowKey]} className="hover:bg-slate-50/80">
                {columns.map((column) => (
                  <td key={column.key} className={`px-4 py-3 align-middle ${column.cellClassName || ''}`}>
                    {column.render ? column.render(row) : row[column.key] || '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length ? (
        <div className="border-t border-slate-100">
          <EmptyState title={emptyTitle} description={emptyDescription} />
        </div>
      ) : null}
    </div>
  );
}
