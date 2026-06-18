import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { api, errorMessage } from '../../api/client';
import ScoreBreakdown from '../../components/ScoreBreakdown';
import StatusBadge from '../../components/StatusBadge';

const employmentOptions = ['SALARIED', 'SELF_EMPLOYED', 'BUSINESS_OWNER', 'CONTRACT', 'UNEMPLOYED'];
const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export default function ApplyLoanPage() {
  const [form, setForm] = useState({
    amount: 250000,
    tenureMonths: 24,
    monthlyIncome: 80000,
    employmentType: 'SALARIED',
    existingMonthlyDebt: 10000,
    creditScore: 740,
    purpose: 'Personal expenses',
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(name, value) {
    setForm((current) => ({
      ...current,
      [name]: ['amount', 'tenureMonths', 'monthlyIncome', 'existingMonthlyDebt', 'creditScore'].includes(name)
        ? Number(value)
        : value,
    }));
  }

  async function submit(event) {
    event.preventDefault();
    await sendApplication('/loans/apply');
  }

  async function saveDraft() {
    await sendApplication('/loans/drafts');
  }

  async function sendApplication(url) {
    setLoading(true);
    setError('');
    try {
      const response = await api.post(url, form);
      setResult(response.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
      <section className="panel p-5">
        <h1 className="text-2xl font-semibold text-slate-950">Apply for a loan</h1>
        <p className="mt-1 text-sm text-slate-500">The decision preview is generated from transparent rules.</p>
        {error ? <div className="mt-4 rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
        <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={submit}>
          {[
            ['amount', 'Loan amount', 'number'],
            ['tenureMonths', 'Tenure in months', 'number'],
            ['monthlyIncome', 'Monthly income', 'number'],
            ['existingMonthlyDebt', 'Existing monthly debt', 'number'],
            ['creditScore', 'Credit score', 'number'],
          ].map(([name, label, type]) => (
            <div key={name}>
              <label>{label}</label>
              <input type={type} value={form[name]} onChange={(event) => update(name, event.target.value)} />
            </div>
          ))}
          <div>
            <label>Employment type</label>
            <select value={form.employmentType} onChange={(event) => update('employmentType', event.target.value)}>
              {employmentOptions.map((option) => (
                <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label>Purpose</label>
            <textarea value={form.purpose} onChange={(event) => update('purpose', event.target.value)} rows={3} />
          </div>
          <div className="flex flex-wrap gap-3 md:col-span-2">
            <button type="button" className="btn-secondary flex-1" disabled={loading} onClick={saveDraft}>
              Save draft
            </button>
            <button className="btn-primary flex-1" disabled={loading}>
              <Send size={18} />
              {loading ? 'Working...' : 'Submit for review'}
            </button>
          </div>
        </form>
      </section>
      <aside className="panel p-5">
        <h2 className="text-lg font-semibold">Decision preview</h2>
        {result ? (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Application status</span>
              <StatusBadge status={result.application.status} />
            </div>
            <div className="rounded-md bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Risk score</p>
              <p className="mt-1 text-3xl font-semibold">{result.risk.riskScore}/100</p>
            </div>
            <p className="text-sm text-slate-700">{result.risk.riskExplanation}</p>
            <ScoreBreakdown items={result.risk.scoreBreakdown} />
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md bg-slate-50 p-3">
                <p className="text-slate-500">EMI</p>
                <p className="font-semibold">{money.format(result.emi.monthlyEmi)}</p>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <p className="text-slate-500">Total interest</p>
                <p className="font-semibold">{money.format(result.emi.totalInterest)}</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">Submit an application to see EMI, score, and explanation.</p>
        )}
      </aside>
    </div>
  );
}
