import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { ErrorState, LoadingState } from '../../components/AsyncState';
import PaginationControls from '../../components/PaginationControls';
import StatusBadge from '../../components/StatusBadge';
import { showErrorToast } from '../../utils/toast';

const statuses = ['', 'DRAFT', 'SUBMITTED', 'IN_REVIEW', 'AUTO_REVIEWED', 'APPROVED', 'REJECTED'];
const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export default function LoanApplicationsPage() {
  const [data, setData] = useState({ items: [], meta: null });
  const [filters, setFilters] = useState({ status: '', search: '', page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api
      .get('/admin/loan-applications', {
        params: {
          page: filters.page,
          limit: 10,
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.search ? { search: filters.search } : {}),
        },
      })
      .then((response) => setData(response.data))
      .catch((err) => setError(showErrorToast(err)))
      .finally(() => setLoading(false));
  }, [filters]);

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Loan applications</h1>
          <p className="mt-1 text-sm text-slate-500">Search, filter, and review the origination queue.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="w-56"
            placeholder="Search customer, mobile or application no."
            value={filters.search}
            onChange={(event) => setFilters({ ...filters, search: event.target.value, page: 1 })}
          />
          <select
            className="w-48"
            value={filters.status}
            onChange={(event) => setFilters({ ...filters, status: event.target.value, page: 1 })}
          >
            {statuses.map((option) => (
              <option key={option} value={option}>
                {option ? option.replaceAll('_', ' ') : 'All statuses'}
              </option>
            ))}
          </select>
        </div>
      </div>
      {loading ? (
        <LoadingState label="Loading applications..." />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Applicant</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">EMI</th>
                  <th className="px-4 py-3">Risk</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((application) => (
                  <tr key={application.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{application.customer?.fullName}</p>
                      <p className="text-xs text-slate-500">{application.applicationNumber || application.customer?.customerNumber}</p>
                    </td>
                    <td className="px-4 py-3">{money.format(application.amount)}</td>
                    <td className="px-4 py-3">{money.format(application.emi)}</td>
                    <td className="px-4 py-3">{application.riskScore}/100</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={application.status} />
                    </td>
                    <td className="px-4 py-3">
                      <Link className="font-semibold text-bank" to={`/admin/applications/${application.id}`}>
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.items.length ? <div className="p-4 text-sm text-slate-500">No applications match the filters.</div> : null}
          <PaginationControls meta={data.meta} onPage={(page) => setFilters({ ...filters, page })} />
        </div>
      )}
    </div>
  );
}
