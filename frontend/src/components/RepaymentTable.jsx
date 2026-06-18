import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import StatusBadge from './StatusBadge';

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export default function RepaymentTable({ repayments = [], onMarkPaid, busyId }) {
  if (!repayments.length) {
    return <div className="panel p-6 text-sm text-slate-500">No repayments found.</div>;
  }

  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Due date</th>
              <th className="px-4 py-3">EMI</th>
              <th className="px-4 py-3">Paid</th>
              <th className="px-4 py-3">Overdue</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {repayments.map((repayment) => (
              <tr key={repayment.id}>
                <td className="px-4 py-3">{new Date(repayment.dueDate).toLocaleDateString()}</td>
                <td className="px-4 py-3 font-medium">{money.format(repayment.emiAmount)}</td>
                <td className="px-4 py-3">{money.format(repayment.paidAmount || 0)}</td>
                <td className="px-4 py-3">{repayment.daysOverdue ? `${repayment.daysOverdue} days` : '-'}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={repayment.status} />
                </td>
                <td className="px-4 py-3">
                  {onMarkPaid && repayment.status !== 'PAID' ? (
                    <button
                      className="btn-secondary px-3 py-1.5"
                      onClick={() => onMarkPaid(repayment.id)}
                      disabled={busyId === repayment.id}
                    >
                      <CheckCircle2 size={16} />
                      Mark paid
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">No action</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
