import React from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export default function LoanCard({ loan }) {
  const paidRatio = loan.totalPayable ? Math.max(0, Math.min(100, 100 - (loan.outstandingBalance / loan.principal) * 100)) : 0;

  return (
    <article className="panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Loan #{loan.id.slice(0, 8)}</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">{money.format(loan.principal)}</h3>
        </div>
        <StatusBadge status={loan.status} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-slate-500">Monthly EMI</p>
          <p className="font-semibold">{money.format(loan.emi)}</p>
        </div>
        <div>
          <p className="text-slate-500">Outstanding</p>
          <p className="font-semibold">{money.format(loan.outstandingBalance)}</p>
        </div>
      </div>
      <div className="mt-4">
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-bank" style={{ width: `${paidRatio}%` }} />
        </div>
        <p className="mt-2 text-xs text-slate-500">{Math.round(paidRatio)}% repaid</p>
      </div>
      <Link to={`/loans/${loan.id}`} className="btn-secondary mt-4 w-full">
        View details
      </Link>
    </article>
  );
}
