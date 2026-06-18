import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState';
import LoanCard from '../../components/LoanCard';
import StatusBadge from '../../components/StatusBadge';

const statuses = ['', 'DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED'];
const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export default function MyLoansPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api
      .get('/loans/my')
      .then((response) => setData(response.data))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState label="Loading loans..." />;

  const filteredApplications = data.applications.filter((application) => {
    const matchesStatus = status ? application.status === status : true;
    const matchesSearch = search
      ? `${application.purpose} ${application.id}`.toLowerCase().includes(search.toLowerCase())
      : true;
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">My loans</h1>
          <p className="mt-1 text-sm text-slate-500">Applications, approved loans, and repayment progress.</p>
        </div>
        <Link to="/apply" className="btn-primary">New application</Link>
      </div>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Loans</h2>
        {data.loans.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {data.loans.map((loan) => (
              <LoanCard key={loan.id} loan={loan} />
            ))}
          </div>
        ) : (
          <EmptyState title="No approved loans yet" description="Submitted applications will appear here after approval." />
        )}
      </section>
      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <h2 className="font-semibold">Loan applications</h2>
          <div className="flex flex-wrap gap-2">
            <input
              className="w-56"
              placeholder="Search purpose or ID"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select className="w-44" value={status} onChange={(event) => setStatus(event.target.value)}>
              {statuses.map((option) => (
                <option key={option} value={option}>{option ? option.replaceAll('_', ' ') : 'All statuses'}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Purpose</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Risk</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredApplications.map((application) => (
                <tr key={application.id}>
                  <td className="px-4 py-3">{application.purpose}</td>
                  <td className="px-4 py-3">{money.format(application.amount)}</td>
                  <td className="px-4 py-3">{application.riskScore}/100</td>
                  <td className="px-4 py-3"><StatusBadge status={application.status} /></td>
                  <td className="px-4 py-3">
                    <Link className="font-semibold text-bank" to={`/loans/${application.loan?.id || application.id}`}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filteredApplications.length ? (
          <div className="border-t border-slate-100 p-4 text-sm text-slate-500">No applications match the current filters.</div>
        ) : null}
      </section>
    </div>
  );
}
