import React, { useEffect, useMemo, useState } from 'react';
import { Send } from 'lucide-react';
import { api } from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import { showErrorToast, showSuccessToast } from '../../utils/toast';

const employmentOptions = ['SALARIED', 'SELF_EMPLOYED', 'BUSINESS_OWNER', 'CONTRACT', 'UNEMPLOYED'];
const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export default function ApplyLoanPage() {
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [schema, setSchema] = useState(null);
  const [form, setForm] = useState({
    requestedAmount: 250000,
    tenure: 24,
    monthlyIncome: 80000,
    employmentType: 'SALARIED',
    existingMonthlyDebt: 10000,
    creditScore: 740,
    purpose: 'Personal expenses',
    dynamicFields: {},
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const selectedProduct = useMemo(() => products.find((product) => product.id === productId), [products, productId]);

  useEffect(() => {
    api
      .get('/api/v1/products')
      .then((response) => {
        const active = response.data.filter((product) => ['ACTIVE', 'PUBLISHED'].includes(product.status));
        setProducts(active);
        setProductId(active[0]?.id ?? '');
      })
      .catch((err) => setError(showErrorToast(err)));
  }, []);

  useEffect(() => {
    if (!productId) {
      setSchema(null);
      return;
    }
    api
      .get(`/api/v1/products/${productId}/application-schema`)
      .then((response) => {
        setSchema(response.data);
        const product = response.data.product;
        setForm((current) => ({
          ...current,
          requestedAmount: Number(product.minimumLoanAmount || current.requestedAmount),
          tenure: Number(product.minimumTenure || current.tenure),
        }));
      })
      .catch((err) => setError(showErrorToast(err)));
  }, [productId]);

  function update(name, value) {
    setForm((current) => ({
      ...current,
      [name]: ['requestedAmount', 'tenure', 'monthlyIncome', 'existingMonthlyDebt', 'creditScore'].includes(name)
        ? Number(value)
        : value,
    }));
  }

  function updateDynamic(fieldKey, value) {
    setForm((current) => ({
      ...current,
      dynamicFields: {
        ...current.dynamicFields,
        [fieldKey]: value,
      },
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const payload = {
        productId,
        requestedAmount: form.requestedAmount,
        tenure: form.tenure,
        applicant: {
          monthlyIncome: form.monthlyIncome,
          employmentType: form.employmentType,
          existingMonthlyDebt: form.existingMonthlyDebt,
          creditScore: form.creditScore,
          purpose: form.purpose,
        },
        dynamicFields: form.dynamicFields,
      };
      const draft = await api.post('/api/v1/loan-applications', payload);
      const submitted = await api.post(`/api/v1/loan-applications/${draft.data.application.id}/submit`);
      setResult(submitted.data);
      showSuccessToast('Application submitted successfully');
    } catch (err) {
      setError(showErrorToast(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
      <section className="panel p-5">
        <h1 className="text-2xl font-semibold text-slate-950">Apply for a loan</h1>
        <p className="mt-1 text-sm text-slate-500">Product rules and workflow are loaded from configuration.</p>
        {error ? <div className="mt-4 rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
        <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={submit}>
          <div className="md:col-span-2">
            <label>Product</label>
            <select value={productId} onChange={(event) => setProductId(event.target.value)}>
              {products.map((product) => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </select>
          </div>
          {[
            ['requestedAmount', 'Requested amount', 'number'],
            ['tenure', 'Tenure', 'number'],
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
          {schema?.fields?.map((field) => (
            <DynamicField key={field.id} field={field} value={form.dynamicFields[field.fieldKey] ?? ''} onChange={(value) => updateDynamic(field.fieldKey, value)} />
          ))}
          <div className="md:col-span-2">
            <button className="btn-primary w-full" disabled={loading || !productId}>
              <Send size={18} />
              {loading ? 'Submitting...' : 'Submit application'}
            </button>
          </div>
        </form>
      </section>
      <aside className="panel p-5">
        <h2 className="text-lg font-semibold">Application journey</h2>
        {selectedProduct ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-md bg-slate-50 p-3">
              <p className="text-sm font-semibold">{selectedProduct.name}</p>
              <p className="text-xs text-slate-500">
                {money.format(Number(selectedProduct.minimumLoanAmount))} to {money.format(Number(selectedProduct.maximumLoanAmount))}
              </p>
            </div>
            <div className="space-y-2">
              {(schema?.workflow ?? []).map((step) => (
                <div key={step.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm">
                  <span>{step.label}</span>
                  <StatusBadge status={step.status} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">No active products available.</p>
        )}
        {result ? (
          <div className="mt-5 space-y-3 border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Status</span>
              <StatusBadge status={result.application.status} />
            </div>
            <div className="rounded-md bg-slate-50 p-3 text-sm">
              <p className="font-semibold">Eligibility</p>
              <p className="mt-1 text-slate-600">{result.ruleEvaluation.reason}</p>
            </div>
            <div className="rounded-md bg-slate-50 p-3 text-sm">
              <p className="font-semibold">Next actions</p>
              <p className="mt-1 text-slate-600">{result.nextActions.actions.length ? result.nextActions.actions.join(', ') : 'No customer action right now'}</p>
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function DynamicField({ field, value, onChange }) {
  const label = `${field.label}${field.required ? ' *' : ''}`;
  if (field.fieldType === 'SELECT' || field.fieldType === 'RADIO') {
    return (
      <div>
        <label>{label}</label>
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select</option>
          {(field.options ?? []).map((option) => (
            <option key={option.value ?? option.label} value={option.value ?? option.label}>{option.label ?? option.value}</option>
          ))}
        </select>
      </div>
    );
  }
  if (field.fieldType === 'CHECKBOX') {
    return (
      <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2">
        <input type="checkbox" className="h-4 w-4" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        <span>{label}</span>
      </label>
    );
  }
  return (
    <div>
      <label>{label}</label>
      <input
        type={['NUMBER', 'CURRENCY'].includes(field.fieldType) ? 'number' : field.fieldType === 'DATE' ? 'date' : 'text'}
        value={value}
        placeholder={field.placeholder ?? ''}
        onChange={(event) => onChange(['NUMBER', 'CURRENCY'].includes(field.fieldType) ? Number(event.target.value) : event.target.value)}
      />
    </div>
  );
}
