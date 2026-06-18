import React, { useEffect, useState } from 'react';
import { CalendarClock, ClipboardList, IndianRupee, WalletCards } from 'lucide-react';
import { api, errorMessage } from '../../api/client';
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState';
import LoanCard from '../../components/LoanCard';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export default function UserDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/loans/my')
      .then((response) => setData(response.data))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState label="Loading dashboard..." />;

  const activeLoans = data.loans.filter((loan) => loan.status === 'ACTIVE' || loan.status === 'DISBURSED');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Loan activity, upcoming dues, and repayment progress.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Active loans" value={data.summary.activeLoans} icon={WalletCards} />
        <StatCard title="Outstanding" value={money.format(data.summary.totalOutstanding)} icon={IndianRupee} />
        <StatCard
          title="Latest status"
          value={data.summary.latestApplicationStatus?.replaceAll('_', ' ') || 'None'}
          icon={ClipboardList}
        />
        <StatCard title="Overdue EMIs" value={data.summary.overdueRepayments} icon={CalendarClock} tone="text-red-600" />
        <StatCard
          title="Next due"
          value={data.summary.nextRepayment ? new Date(data.summary.nextRepayment.dueDate).toLocaleDateString() : 'None'}
          icon={CalendarClock}
        />
      </div>
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Active loans</h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {data.summary.unreadNotifications} unread
          </span>
        </div>
        {activeLoans.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {activeLoans.map((loan) => (
              <LoanCard key={loan.id} loan={loan} />
            ))}
          </div>
        ) : (
          <EmptyState title="No active loans yet" description="Approved loans and repayment progress will appear here." />
        )}
      </section>
      <section className="panel p-4">
        <h2 className="text-lg font-semibold">Applications</h2>
        <div className="mt-4 space-y-3">
          {data.applications.map((application) => (
            <div
              key={application.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0"
            >
              <div>
                <p className="font-medium">
                  {money.format(application.amount)} for {application.purpose}
                </p>
                <p className="text-sm text-slate-500">
                  Risk score {application.riskScore} - EMI {money.format(application.emi)}
                </p>
              </div>
              <StatusBadge status={application.status} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
