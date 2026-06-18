import React from 'react';
export default function StatCard({ title, value, icon: Icon, tone = 'text-bank', helper }) {
  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
          {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
        </div>
        {Icon ? (
          <div className={`rounded-md bg-slate-50 p-2 ${tone}`}>
            <Icon size={20} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
