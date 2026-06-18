import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function PaginationControls({ meta, onPage }) {
  if (!meta || meta.totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm">
      <span className="text-slate-500">
        Page {meta.page} of {meta.totalPages} - {meta.total} records
      </span>
      <div className="flex gap-2">
        <button className="btn-secondary px-3 py-1.5" onClick={() => onPage(meta.page - 1)} disabled={meta.page <= 1}>
          <ChevronLeft size={16} />
          Prev
        </button>
        <button
          className="btn-secondary px-3 py-1.5"
          onClick={() => onPage(meta.page + 1)}
          disabled={meta.page >= meta.totalPages}
        >
          Next
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
