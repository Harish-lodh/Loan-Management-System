import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { ErrorState, LoadingState } from '../../components/AsyncState';
import PaginationControls from '../../components/PaginationControls';
import StatusBadge from '../../components/StatusBadge';
import { showErrorToast, showSuccessToast } from '../../utils/toast';

const statuses = ['', 'PENDING', 'PAID', 'OVERDUE'];
const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export default function AdminRepaymentsPage() {
  const [data, setData] = useState({ items: [], meta: null });
  const [filters, setFilters] = useState({ status: '', search: '', page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentLinks, setPaymentLinks] = useState({});
  const [collecting, setCollecting] = useState(null);

  const load = () => {
    setLoading(true);
    api
      .get('/admin/repayments', {
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
  };

  useEffect(load, [filters]);

  async function updateStatus(id, nextStatus) {
    setError('');
    try {
      await api.patch(`/admin/repayments/${id}/status`, { status: nextStatus });
      showSuccessToast('Repayment status updated');
      load();
    } catch (err) {
      setError(showErrorToast(err));
    }
  }

  async function collectViaEasebuzz(repaymentId) {
    setCollecting(repaymentId);
    try {
      const response = await api.post(`/api/v1/repayments/${repaymentId}/collect`);
      setPaymentLinks((current) => ({ ...current, [repaymentId]: response.data.paymentUrl }));
      showSuccessToast('Payment link created');
    } catch (err) {
      showErrorToast(err);
    } finally {
      setCollecting(null);
    }
  }

  async function copyLink(url) {
    try {
      await navigator.clipboard.writeText(url);
      showSuccessToast('Payment link copied');
    } catch {
      showErrorToast('Could not copy link');
    }
  }

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Repayment monitoring</h1>
          <p className="mt-1 text-sm text-slate-500">Track due, paid, and overdue EMIs across the portfolio.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="w-56"
            placeholder="Search customer or loan"
            value={filters.search}
            onChange={(event) => setFilters({ ...filters, search: event.target.value, page: 1 })}
          />
          <select
            className="w-44"
            value={filters.status}
            onChange={(event) => setFilters({ ...filters, status: event.target.value, page: 1 })}
          >
            {statuses.map((option) => (
              <option key={option} value={option}>
                {option || 'All statuses'}
              </option>
            ))}
          </select>
        </div>
      </div>
      {loading ? (
        <LoadingState label="Loading repayments..." />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Due date</th>
                  <th className="px-4 py-3">EMI</th>
                  <th className="px-4 py-3">Overdue</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Update</th>
                  <th className="px-4 py-3">Collect payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((repayment) => (
                  <tr key={repayment.id}>
                    <td className="px-4 py-3">{repayment.user?.name}</td>
                    <td className="px-4 py-3">{new Date(repayment.dueDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{money.format(repayment.emiAmount)}</td>
                    <td className="px-4 py-3">{repayment.daysOverdue ? `${repayment.daysOverdue} days` : '-'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={repayment.status} />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={repayment.status}
                        onChange={(event) => updateStatus(repayment.id, event.target.value)}
                        className="max-w-[11rem]"
                      >
                        {statuses.slice(1).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {repayment.status === 'PAID' ? (
                        '-'
                      ) : paymentLinks[repayment.id] ? (
                        <button className="font-semibold text-bank" onClick={() => copyLink(paymentLinks[repayment.id])}>
                          Copy link
                        </button>
                      ) : (
                        <button
                          className="btn-secondary px-3 py-1 text-xs"
                          disabled={collecting === repayment.id}
                          onClick={() => collectViaEasebuzz(repayment.id)}
                        >
                          {collecting === repayment.id ? 'Creating...' : 'Collect via Easebuzz'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.items.length ? <div className="p-4 text-sm text-slate-500">No repayments match the filters.</div> : null}
          <PaginationControls meta={data.meta} onPage={(page) => setFilters({ ...filters, page })} />
        </div>
      )}
    </div>
  );
}
