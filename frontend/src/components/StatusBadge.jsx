import React from 'react';
const tones = {
  DRAFT: 'bg-slate-100 text-slate-700 ring-slate-200',
  SUBMITTED: 'bg-sky-50 text-sky-700 ring-sky-200',
  IN_REVIEW: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  PENDING: 'bg-amber-50 text-amber-700 ring-amber-200',
  AUTO_REVIEWED: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-700 ring-rose-200',
  DISBURSED: 'bg-blue-50 text-blue-700 ring-blue-200',
  ACTIVE: 'bg-teal-50 text-teal-700 ring-teal-200',
  CLOSED: 'bg-slate-100 text-slate-700 ring-slate-200',
  DEFAULTED: 'bg-red-50 text-red-700 ring-red-200',
  PAID: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  OVERDUE: 'bg-red-50 text-red-700 ring-red-200',
  VALID: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  BROKEN: 'bg-red-50 text-red-700 ring-red-200',
};

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${tones[status] || tones.PENDING}`}>
      {String(status || 'UNKNOWN').replaceAll('_', ' ')}
    </span>
  );
}
