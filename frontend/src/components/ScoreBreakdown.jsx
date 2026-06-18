import React from 'react';

const tones = {
  POSITIVE: 'bg-emerald-50 text-emerald-700',
  NEUTRAL: 'bg-amber-50 text-amber-700',
  NEGATIVE: 'bg-rose-50 text-rose-700',
};

export default function ScoreBreakdown({ items = [] }) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const width = item.maxPoints ? Math.max(0, Math.min(100, (item.points / item.maxPoints) * 100)) : 0;
        return (
          <div key={item.category} className="rounded-md border border-slate-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium text-slate-900">{item.category}</p>
                <p className="mt-1 text-sm text-slate-500">{item.message}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tones[item.impact] || tones.NEUTRAL}`}>
                {item.points}/{item.maxPoints}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-bank" style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
