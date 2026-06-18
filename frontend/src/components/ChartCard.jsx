import React from 'react';
export default function ChartCard({ title, children }) {
  return (
    <section className="panel p-4">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <div className="mt-4 h-72">{children}</div>
    </section>
  );
}
