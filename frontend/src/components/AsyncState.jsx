import React from 'react';
import { AlertCircle, Inbox, Loader2 } from 'lucide-react';

export function LoadingState({ label = 'Loading...' }) {
  return (
    <div className="panel flex items-center gap-3 p-6 text-sm text-slate-500">
      <Loader2 className="animate-spin text-bank" size={18} />
      {label}
    </div>
  );
}

export function ErrorState({ message }) {
  return (
    <div className="panel flex items-start gap-3 bg-rose-50 p-6 text-sm text-rose-700">
      <AlertCircle size={18} />
      <span>{message}</span>
    </div>
  );
}

export function EmptyState({ title = 'Nothing here yet', description }) {
  return (
    <div className="panel flex items-start gap-3 p-6 text-sm text-slate-500">
      <Inbox className="text-slate-400" size={20} />
      <div>
        <p className="font-semibold text-slate-700">{title}</p>
        {description ? <p className="mt-1">{description}</p> : null}
      </div>
    </div>
  );
}
