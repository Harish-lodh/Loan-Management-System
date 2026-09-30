import React from 'react';

export default function FormField({ label, children, hint, className = '' }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block">{label}</label>
      {children}
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
