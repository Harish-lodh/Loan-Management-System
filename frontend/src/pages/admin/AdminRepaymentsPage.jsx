import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { ErrorState, LoadingState } from '../../components/AsyncState';
import PaginationControls from '../../components/PaginationControls';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { formatDate, formatMoney } from '../../utils/format';
import { showErrorToast, showSuccessToast } from '../../utils/toast';

const statuses = ['', 'PENDING', 'PAID', 'OVERDUE'];

const ACTIONS = {
  bounce: {
    title: 'Mark debit as bounced',
    hint: "Adds the product's bounce charge to this EMI.",
    placeholder: 'e.g. eNACH returned: insufficient funds (bank MIS 30 Sep)',
    path: (id) => `/admin/repayments/${id}/bounce`,
    success: 'Bounce recorded',
    button: 'Record bounce',
  },
  waive: {
    title: 'Waive charges',
    hint: 'Removes the late fee and bounce charges on this EMI. The reason is stored in the audit log.',
    placeholder: 'e.g. Bank-side technical failure, customer not at fault',
    path: (id) => `/admin/repayments/${id}/waive-charges`,
    success: 'Charges waived',
    button: 'Waive charges',
  },
};

function charges(repayment) {
  return Number(repayment.lateFeeAmount || 0) + Number(repayment.bounceChargeAmount || 0);
}

function due(repayment) {
  return Math.max(0, Number(repayment.emiAmount) + charges(repayment) - Number(repayment.paidAmount || 0));
}

export default function AdminRepaymentsPage() {
  const { can } = useAuth();
  const [data, setData] = useState({ items: [], meta: null });
  const [filters, setFilters] = useState({ status: '', search: '', page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentLinks, setPaymentLinks] = useState({});
  const [collecting, setCollecting] = useState(null);
  const [action, setAction] = useState(null); // { id, type }
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

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
    try {
      await api.patch(`/admin/repayments/${id}/status`, { status: nextStatus });
      showSuccessToast(nextStatus === 'PAID' ? 'Payment recorded' : 'Repayment status updated');
      load();
    } catch (err) {
      showErrorToast(err);
    }
  }

  async function submitAction() {
    const config = ACTIONS[action.type];
    setBusy(true);
    try {
      await api.post(config.path(action.id), { reason });
      showSuccessToast(config.success);
      setAction(null);
      setReason('');
      setPaymentLinks((current) => ({ ...current, [action.id]: undefined }));
      load();
    } catch (err) {
      showErrorToast(err);
    } finally {
      setBusy(false);
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
          <p className="mt-1 text-sm text-slate-500">Track due, paid and overdue EMIs, record bounces and collect payments.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="w-56"
            placeholder="Search customer or loan no."
            value={filters.search}
            onChange={(event) => setFilters({ ...filters, search: event.target.value, page: 1 })}
          />
          <select className="w-44" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value, page: 1 })}>
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
                  <th className="px-4 py-3">Charges</th>
                  <th className="px-4 py-3">Amount due</th>
                  <th className="px-4 py-3">Overdue</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((repayment) => {
                  const unpaid = repayment.status !== 'PAID';
                  const open = action?.id === repayment.id;
                  return (
                    <React.Fragment key={repayment.id}>
                      <tr>
                        <td className="px-4 py-3">
                          <p className="font-medium">{repayment.customer?.fullName}</p>
                          <p className="text-xs text-slate-500">{repayment.loan?.loanAccountNumber || repayment.customer?.customerNumber}</p>
                        </td>
                        <td className="px-4 py-3">{formatDate(repayment.dueDate)}</td>
                        <td className="px-4 py-3">{formatMoney(repayment.emiAmount)}</td>
                        <td className="px-4 py-3">
                          {charges(repayment) ? (
                            <div className="text-xs">
                              {Number(repayment.lateFeeAmount) ? <p>Late fee {formatMoney(repayment.lateFeeAmount)}</p> : null}
                              {Number(repayment.bounceChargeAmount) ? (
                                <p>
                                  Bounce {formatMoney(repayment.bounceChargeAmount)} ({repayment.bounceCount}×)
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold">{unpaid ? formatMoney(due(repayment)) : '-'}</td>
                        <td className="px-4 py-3">{repayment.daysOverdue ? <span className="text-red-600">{repayment.daysOverdue} days</span> : '-'}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={repayment.status} />
                        </td>
                        <td className="px-4 py-3">
                          {unpaid ? (
                            <div className="flex flex-wrap items-center gap-2">
                              {can('repayment.update') ? (
                                <button className="btn-secondary px-3 py-1 text-xs" onClick={() => updateStatus(repayment.id, 'PAID')}>
                                  Mark paid
                                </button>
                              ) : null}
                              {can('payment.collect') ? (
                                paymentLinks[repayment.id] ? (
                                  <button className="text-xs font-semibold text-bank" onClick={() => copyLink(paymentLinks[repayment.id])}>
                                    Copy link
                                  </button>
                                ) : (
                                  <button
                                    className="btn-secondary px-3 py-1 text-xs"
                                    disabled={collecting === repayment.id}
                                    onClick={() => collectViaEasebuzz(repayment.id)}
                                  >
                                    {collecting === repayment.id ? 'Creating...' : 'Payment link'}
                                  </button>
                                )
                              ) : null}
                              {can('repayment.update') ? (
                                <button className="text-xs font-semibold text-slate-600 hover:text-slate-950" onClick={() => setAction({ id: repayment.id, type: 'bounce' })}>
                                  Bounced
                                </button>
                              ) : null}
                              {can('penalty.waive') && charges(repayment) ? (
                                <button className="text-xs font-semibold text-slate-600 hover:text-slate-950" onClick={() => setAction({ id: repayment.id, type: 'waive' })}>
                                  Waive
                                </button>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500">Paid {formatDate(repayment.paidAt)}</span>
                          )}
                        </td>
                      </tr>
                      {open ? (
                        <tr className="bg-slate-50">
                          <td colSpan={8} className="px-4 py-3">
                            <p className="text-sm font-semibold">{ACTIONS[action.type].title}</p>
                            <p className="text-xs text-slate-500">{ACTIONS[action.type].hint}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <input
                                className="min-w-[18rem] flex-1"
                                placeholder={ACTIONS[action.type].placeholder}
                                value={reason}
                                onChange={(event) => setReason(event.target.value)}
                              />
                              <button className="btn-primary" disabled={busy || reason.trim().length < 5} onClick={submitAction}>
                                {ACTIONS[action.type].button}
                              </button>
                              <button className="btn-secondary" onClick={() => setAction(null)}>
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })}
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
