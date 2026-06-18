import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import { ErrorState, LoadingState } from '../../components/AsyncState';
import ScoreBreakdown from '../../components/ScoreBreakdown';
import StatusBadge from '../../components/StatusBadge';

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export default function LoanReviewDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = () => {
    api
      .get(`/admin/loan-applications/${id}`)
      .then((response) => setApplication(response.data))
      .catch((err) => setError(errorMessage(err)));
  };

  useEffect(load, [id]);

  async function approve() {
    setLoading(true);
    setError('');
    try {
      await api.patch(`/admin/loan-applications/${id}/approve`, { comment });
      navigate('/admin/applications');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function reject() {
    setLoading(true);
    setError('');
    try {
      await api.patch(`/admin/loan-applications/${id}/reject`, { comment });
      navigate('/admin/applications');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (error) return <ErrorState message={error} />;
  if (!application) return <LoadingState label="Loading application..." />;

  const reviewLocked = application.status === 'APPROVED' || application.status === 'REJECTED' || application.status === 'DRAFT';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Review application</h1>
          <p className="mt-1 text-sm text-slate-500">
            {application.user?.name} - {application.user?.email}
          </p>
        </div>
        <StatusBadge status={application.status} />
      </div>
      <section className="grid gap-4 md:grid-cols-4">
        <div className="panel p-4">
          <p className="text-sm text-slate-500">Requested amount</p>
          <p className="mt-2 text-xl font-semibold">{money.format(application.amount)}</p>
        </div>
        <div className="panel p-4">
          <p className="text-sm text-slate-500">EMI</p>
          <p className="mt-2 text-xl font-semibold">{money.format(application.emi)}</p>
        </div>
        <div className="panel p-4">
          <p className="text-sm text-slate-500">Risk score</p>
          <p className="mt-2 text-xl font-semibold">{application.riskScore}/100</p>
        </div>
        <div className="panel p-4">
          <p className="text-sm text-slate-500">Credit score</p>
          <p className="mt-2 text-xl font-semibold">{application.creditScore}</p>
        </div>
      </section>
      <section className="panel p-5">
        <h2 className="font-semibold">Decision reason</h2>
        <p className="mt-2 text-sm text-slate-600">{application.riskExplanation}</p>
        <div className="mt-4 grid gap-4 text-sm md:grid-cols-3">
          <div>
            <span className="text-slate-500">Income:</span> {money.format(application.monthlyIncome)}
          </div>
          <div>
            <span className="text-slate-500">Debt:</span> {money.format(application.existingMonthlyDebt)}
          </div>
          <div>
            <span className="text-slate-500">Employment:</span> {application.employmentType.replaceAll('_', ' ')}
          </div>
        </div>
        <div className="mt-5">
          <ScoreBreakdown items={application.scoreBreakdown} />
        </div>
      </section>
      <section className="panel p-5">
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
      <section className="panel p-5">
        <label>Admin comment</label>
        <textarea className="mt-2" rows={4} value={comment} onChange={(event) => setComment(event.target.value)} />
        {application.status === 'DRAFT' ? (
          <p className="mt-2 text-sm text-amber-700">Draft applications must be submitted by the customer before staff review.</p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="btn-primary" onClick={approve} disabled={loading || reviewLocked}>
            Approve loan
          </button>
          <button className="btn-secondary" onClick={reject} disabled={loading || comment.trim().length < 5 || reviewLocked}>
            Reject loan
          </button>
        </div>
      </section>
    </div>
  );
}
