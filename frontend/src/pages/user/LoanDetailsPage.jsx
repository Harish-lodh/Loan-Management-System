import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import RepaymentTable from '../../components/RepaymentTable';
import ScoreBreakdown from '../../components/ScoreBreakdown';
import StatusBadge from '../../components/StatusBadge';

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export default function LoanDetailsPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = () => {
    api
      .get(`/loans/${id}`)
      .then((response) => setData(response.data))
      .catch((err) => setError(errorMessage(err)));
  };

  useEffect(load, [id]);

  async function markPaid(repaymentId) {
    setBusyId(repaymentId);
    try {
      await api.post(`/repayments/${repaymentId}/mark-paid`);
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId('');
    }
  }

  async function submitDraft() {
    setBusyId(id);
    setError('');
    try {
      await api.post(`/loans/applications/${id}/submit`);
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId('');
    }
  }

  if (error) return <div className="panel p-6 text-sm text-rose-700">{error}</div>;
  if (!data) return <div className="panel p-6 text-sm text-slate-500">Loading details...</div>;

  const loan = data.loan || data.application?.loan;
  const application = data.application || data.loan?.application;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Loan details</h1>
          <p className="mt-1 text-sm text-slate-500">{application?.purpose}</p>
        </div>
        <StatusBadge status={loan?.status || application?.status} />
      </div>
      <section className="grid gap-4 md:grid-cols-4">
        <div className="panel p-4">
          <p className="text-sm text-slate-500">Amount</p>
          <p className="mt-2 text-xl font-semibold">{money.format(loan?.principal || application.amount)}</p>
        </div>
        <div className="panel p-4">
          <p className="text-sm text-slate-500">EMI</p>
          <p className="mt-2 text-xl font-semibold">{money.format(loan?.emi || application.emi)}</p>
        </div>
        <div className="panel p-4">
          <p className="text-sm text-slate-500">Risk score</p>
          <p className="mt-2 text-xl font-semibold">{application.riskScore}/100</p>
        </div>
        <div className="panel p-4">
          <p className="text-sm text-slate-500">Outstanding</p>
          <p className="mt-2 text-xl font-semibold">{loan ? money.format(loan.outstandingBalance) : 'Pending'}</p>
        </div>
      </section>
      <section className="panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Score explanation</h2>
          {application.status === 'DRAFT' ? (
            <button className="btn-primary" onClick={submitDraft} disabled={busyId === id}>
              Submit for review
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-slate-600">{application.riskExplanation}</p>
        <div className="mt-4">
          <ScoreBreakdown items={application.scoreBreakdown} />
        </div>
      </section>
      <section className="panel p-4">
        <h2 className="font-semibold">Workflow history</h2>
        <div className="mt-4 space-y-3">
          {(application.statusHistory || []).map((entry, index) => (
            <div key={`${entry.status}-${entry.changedAt}-${index}`} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0">
              <div>
                <p className="font-medium">{String(entry.status).replaceAll('_', ' ')}</p>
                <p className="text-sm text-slate-500">{entry.comment || 'Status changed'}</p>
              </div>
              <span className="text-xs text-slate-500">{new Date(entry.changedAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Repayment schedule</h2>
        <RepaymentTable repayments={loan?.repayments || []} onMarkPaid={loan ? markPaid : null} busyId={busyId} />
      </section>
    </div>
  );
}
