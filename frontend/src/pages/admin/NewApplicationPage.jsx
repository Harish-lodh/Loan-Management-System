import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { ErrorState, LoadingState } from '../../components/AsyncState';
import FormField from '../../components/FormField';
import FormSection from '../../components/FormSection';
import PageHeader from '../../components/PageHeader';
import { formatMoney } from '../../utils/format';
import { showErrorToast, showSuccessToast } from '../../utils/toast';
import { EMPLOYMENT_TYPES } from './CustomersPage';

const emptyApplicant = { monthlyIncome: '', existingMonthlyDebt: '0', employmentType: 'SALARIED', creditScore: '', purpose: '' };
const emptyWalkIn = { fullName: '', phone: '', email: '' };

function DynamicField({ field, value, onChange }) {
  const label = `${field.label}${field.required ? ' *' : ''}`;
  const options = Array.isArray(field.options) ? field.options : [];
  if (field.fieldType === 'CHECKBOX') {
    return (
      <FormField label={label} hint={field.helpText}>
        <input type="checkbox" className="h-4 w-4" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
      </FormField>
    );
  }
  if ((field.fieldType === 'SELECT' || field.fieldType === 'RADIO') && options.length) {
    return (
      <FormField label={label} hint={field.helpText}>
        <select value={value ?? ''} onChange={(event) => onChange(event.target.value)} required={field.required}>
          <option value="">Select</option>
          {options.map((option) => {
            const optionValue = typeof option === 'object' ? option.value : option;
            const optionLabel = typeof option === 'object' ? option.label ?? option.value : option;
            return (
              <option key={optionValue} value={optionValue}>
                {optionLabel}
              </option>
            );
          })}
        </select>
      </FormField>
    );
  }
  const numeric = field.fieldType === 'NUMBER' || field.fieldType === 'CURRENCY';
  return (
    <FormField label={label} hint={field.helpText}>
      <input
        type={numeric ? 'number' : field.fieldType === 'DATE' ? 'date' : 'text'}
        value={value ?? ''}
        placeholder={field.placeholder ?? ''}
        min={field.validationRules?.min}
        max={field.validationRules?.max}
        required={field.required}
        onChange={(event) => onChange(numeric && event.target.value !== '' ? Number(event.target.value) : event.target.value)}
      />
    </FormField>
  );
}

export default function NewApplicationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState(null);
  const [partners, setPartners] = useState([]);
  const [error, setError] = useState('');

  const [customer, setCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [walkIn, setWalkIn] = useState(null);

  const [productId, setProductId] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [schema, setSchema] = useState(null);
  const [amount, setAmount] = useState('');
  const [tenure, setTenure] = useState('');
  const [applicant, setApplicant] = useState(emptyApplicant);
  const [dynamicFields, setDynamicFields] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/api/v1/products'), api.get('/api/v1/partners')])
      .then(([productResponse, partnerResponse]) => {
        const list = productResponse.data.items ?? productResponse.data;
        setProducts(list.filter((product) => ['ACTIVE', 'PUBLISHED'].includes(product.status)));
        setPartners((partnerResponse.data.items ?? partnerResponse.data).filter((partner) => partner.status === 'ACTIVE'));
      })
      .catch((err) => setError(showErrorToast(err)));
  }, []);

  useEffect(() => {
    const customerId = searchParams.get('customerId');
    if (!customerId) return;
    api
      .get(`/api/v1/customers/${customerId}`)
      .then((response) => chooseCustomer(response.data))
      .catch((err) => showErrorToast(err));
  }, [searchParams]);

  useEffect(() => {
    if (customer || walkIn || customerSearch.trim().length < 2) {
      setCustomerResults([]);
      return undefined;
    }
    const timer = setTimeout(() => {
      api
        .get('/api/v1/customers', { params: { search: customerSearch.trim(), status: 'ACTIVE', limit: 8 } })
        .then((response) => setCustomerResults(response.data.items))
        .catch(() => setCustomerResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [customerSearch, customer, walkIn]);

  useEffect(() => {
    setSchema(null);
    setDynamicFields({});
    setPartnerId('');
    if (!productId) return;
    api
      .get(`/api/v1/products/${productId}/application-schema`)
      .then((response) => setSchema(response.data))
      .catch((err) => showErrorToast(err));
  }, [productId]);

  const product = schema?.product;
  const productPartners = useMemo(
    () => partners.filter((partner) => (partner.productMappings ?? []).some((mapping) => mapping.productId === productId && mapping.status === 'ACTIVE')),
    [partners, productId],
  );

  function chooseCustomer(selected) {
    setCustomer(selected);
    setWalkIn(null);
    setCustomerResults([]);
    setApplicant((current) => ({
      ...current,
      monthlyIncome: selected.monthlyIncome ? String(selected.monthlyIncome) : current.monthlyIncome,
      employmentType: selected.employmentType || current.employmentType,
    }));
  }

  async function submit(event, submitAfterSave) {
    event.preventDefault();
    if (!customer && !walkIn) {
      showErrorToast(new Error('Select a customer or add a new one'));
      return;
    }
    setSaving(true);
    try {
      const response = await api.post('/api/v1/loan-applications', {
        productId,
        ...(partnerId ? { partnerId } : {}),
        ...(customer ? { customerId: customer.id } : {}),
        requestedAmount: Number(amount),
        tenure: Number(tenure),
        applicant: {
          monthlyIncome: Number(applicant.monthlyIncome),
          existingMonthlyDebt: Number(applicant.existingMonthlyDebt || 0),
          employmentType: applicant.employmentType,
          creditScore: Number(applicant.creditScore),
          purpose: applicant.purpose,
          ...(walkIn ? { fullName: walkIn.fullName, phone: walkIn.phone, ...(walkIn.email ? { email: walkIn.email } : {}) } : {}),
        },
        dynamicFields,
      });
      const applicationId = response.data.application.id;
      if (submitAfterSave) {
        await api.post(`/api/v1/loan-applications/${applicationId}/submit`);
        showSuccessToast('Application submitted for review');
      } else {
        showSuccessToast('Draft saved');
      }
      navigate(`/admin/applications/${applicationId}`);
    } catch (err) {
      showErrorToast(err);
    } finally {
      setSaving(false);
    }
  }

  if (error) return <ErrorState message={error} />;
  if (!products) return <LoadingState label="Loading products..." />;

  const setApplicantField = (name) => (event) => setApplicant({ ...applicant, [name]: event.target.value });

  return (
    <form className="space-y-6" onSubmit={(event) => submit(event, true)}>
      <PageHeader title="New loan application" description="Capture an application on behalf of a customer. A different staff member must approve it." />

      <section className="panel space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-950">Customer</h2>
          {customer || walkIn ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setCustomer(null);
                setWalkIn(null);
                setCustomerSearch('');
              }}
            >
              Change
            </button>
          ) : null}
        </div>
        {customer ? (
          <div className="rounded-md border border-slate-200 p-3 text-sm">
            <p className="font-semibold">{customer.fullName}</p>
            <p className="text-slate-500">
              {customer.customerNumber} · {customer.phone}
              {customer.panMasked ? ` · PAN ${customer.panMasked}` : ''}
            </p>
          </div>
        ) : walkIn ? (
          <div className="grid gap-4 md:grid-cols-3">
            <FormField label="Full name *">
              <input value={walkIn.fullName} onChange={(event) => setWalkIn({ ...walkIn, fullName: event.target.value })} required />
            </FormField>
            <FormField label="Mobile *" hint="An existing customer with this mobile is reused.">
              <input value={walkIn.phone} onChange={(event) => setWalkIn({ ...walkIn, phone: event.target.value })} required />
            </FormField>
            <FormField label="Email">
              <input type="email" value={walkIn.email} onChange={(event) => setWalkIn({ ...walkIn, email: event.target.value })} />
            </FormField>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              placeholder="Search existing customer by name, mobile or customer no."
              value={customerSearch}
              onChange={(event) => setCustomerSearch(event.target.value)}
            />
            {customerResults.length ? (
              <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
                {customerResults.map((result) => (
                  <button
                    type="button"
                    key={result.id}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                    onClick={() => chooseCustomer(result)}
                  >
                    <span className="font-medium">{result.fullName}</span>
                    <span className="ml-2 text-slate-500">
                      {result.customerNumber} · {result.phone}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            <button type="button" className="text-sm font-semibold text-bank" onClick={() => setWalkIn(emptyWalkIn)}>
              + New customer (walk-in)
            </button>
          </div>
        )}
      </section>

      <FormSection title="Loan" description={product ? `${formatMoney(product.minimumLoanAmount)} – ${formatMoney(product.maximumLoanAmount)}, ${product.minimumTenure}–${product.maximumTenure} months` : 'Choose a product to see its limits.'}>
        <FormField label="Product *">
          <select value={productId} onChange={(event) => setProductId(event.target.value)} required>
            <option value="">Select product</option>
            {products.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Partner" hint={productPartners.length ? undefined : 'No partner is mapped to this product.'}>
          <select value={partnerId} onChange={(event) => setPartnerId(event.target.value)} disabled={!productPartners.length}>
            <option value="">Direct (no partner)</option>
            {productPartners.map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Requested amount (₹) *">
          <input type="number" min={product?.minimumLoanAmount} max={product?.maximumLoanAmount} value={amount} onChange={(event) => setAmount(event.target.value)} required />
        </FormField>
        <FormField label="Tenure (months) *">
          <input type="number" min={product?.minimumTenure} max={product?.maximumTenure} value={tenure} onChange={(event) => setTenure(event.target.value)} required />
        </FormField>
      </FormSection>

      <FormSection title="Applicant financials" description="Used by the product's eligibility rules and risk score.">
        <FormField label="Monthly income (₹) *">
          <input type="number" min="1000" value={applicant.monthlyIncome} onChange={setApplicantField('monthlyIncome')} required />
        </FormField>
        <FormField label="Existing monthly EMIs (₹)">
          <input type="number" min="0" value={applicant.existingMonthlyDebt} onChange={setApplicantField('existingMonthlyDebt')} />
        </FormField>
        <FormField label="Employment type *">
          <select value={applicant.employmentType} onChange={setApplicantField('employmentType')}>
            {EMPLOYMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Credit score *">
          <input type="number" min="300" max="900" value={applicant.creditScore} onChange={setApplicantField('creditScore')} required />
        </FormField>
        <FormField label="Purpose *" className="md:col-span-2">
          <input value={applicant.purpose} onChange={setApplicantField('purpose')} minLength={3} required />
        </FormField>
      </FormSection>

      {schema?.fields?.length ? (
        <FormSection title="Product details" description="Fields configured for this product.">
          {schema.fields.map((field) => (
            <DynamicField
              key={field.id}
              field={field}
              value={dynamicFields[field.fieldKey]}
              onChange={(value) => setDynamicFields((current) => ({ ...current, [field.fieldKey]: value }))}
            />
          ))}
        </FormSection>
      ) : null}

      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" className="btn-secondary" disabled={saving || !productId} onClick={(event) => submit(event, false)}>
          Save as draft
        </button>
        <button className="btn-primary" disabled={saving || !productId}>
          {saving ? 'Saving...' : 'Save & submit for review'}
        </button>
      </div>
    </form>
  );
}
