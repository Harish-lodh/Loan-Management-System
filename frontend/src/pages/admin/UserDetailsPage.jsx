import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import { ErrorState, LoadingState } from '../../components/AsyncState';
import StatusBadge from '../../components/StatusBadge';

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export default function UserDetailsPage() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/admin/users/${id}`)
      .then((response) => setUser(response.data))
      .catch((err) => setError(errorMessage(err)));
  }, [id]);

  if (error) return <ErrorState message={error} />;
  if (!user) return <LoadingState label="Loading user..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">{user.name}</h1>
        <p className="mt-1 text-sm text-slate-500">{user.email} - {user.phone}</p>
        <p className="mt-1 text-sm text-slate-500">
          {[user.occupation, user.address].filter(Boolean).join(' - ') || 'No profile details yet'}
        </p>
      </div>
      <section className="panel p-4">
        <h2 className="font-semibold">Loan history</h2>
        <div className="mt-4 space-y-3">
          {user.loans?.map((loan) => (
            <div
              key={loan.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0"
            >
              <div>
                <p className="font-medium">{money.format(loan.principal)}</p>
                <p className="text-sm text-slate-500">Outstanding {money.format(loan.outstandingBalance)}</p>
              </div>
              <StatusBadge status={loan.status} />
            </div>
          ))}
        </div>
      </section>
      <section className="panel p-4">
        <h2 className="font-semibold">Repayment history</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {user.repayments?.map((repayment) => (
            <div key={repayment.id} className="rounded-md border border-slate-200 p-3 text-sm">
              <div className="flex justify-between gap-2">
                <span>{new Date(repayment.dueDate).toLocaleDateString()}</span>
                <StatusBadge status={repayment.status} />
              </div>
              <p className="mt-2 font-semibold">{money.format(repayment.emiAmount)}</p>
              {repayment.daysOverdue ? <p className="mt-1 text-xs text-red-600">{repayment.daysOverdue} days overdue</p> : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
