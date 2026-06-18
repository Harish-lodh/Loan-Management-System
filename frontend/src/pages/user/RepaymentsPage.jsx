import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { LoadingState } from '../../components/AsyncState';
import RepaymentTable from '../../components/RepaymentTable';
import { showErrorToast, showSuccessToast } from '../../utils/toast';

export default function RepaymentsPage() {
  const [repayments, setRepayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = () => {
    api
      .get('/repayments/my')
      .then((response) => setRepayments(response.data))
      .catch((err) => setError(showErrorToast(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  async function markPaid(id) {
    setBusyId(id);
    setError('');
    try {
      await api.post(`/repayments/${id}/mark-paid`);
      showSuccessToast('Repayment marked as paid');
      load();
    } catch (err) {
      setError(showErrorToast(err));
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Repayments</h1>
        <p className="mt-1 text-sm text-slate-500">Track due dates and mark demo payments as received.</p>
      </div>
      {error ? <div className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
      {loading ? <LoadingState label="Loading repayments..." /> : <RepaymentTable repayments={repayments} onMarkPaid={markPaid} busyId={busyId} />}
    </div>
  );
}
