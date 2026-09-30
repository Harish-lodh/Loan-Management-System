import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Save } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { organizationsApi, productsApi } from '../../../api/masterData';
import { EmptyState, ErrorState, LoadingState } from '../../../components/AsyncState';
import FormField from '../../../components/FormField';
import FormSection from '../../../components/FormSection';
import PageHeader from '../../../components/PageHeader';
import { formatLabel, formatMoney } from '../../../utils/format';
import { showErrorToast, showSuccessToast } from '../../../utils/toast';

const steps = [
  'Basic Information',
  'Loan Amount and Tenure',
  'Interest and Fees',
  'Eligibility Rules',
  'Required Documents',
  'Review and Save',
];

const productTypes = ['PERSONAL_LOAN', 'BUSINESS_LOAN', 'SALARY_ADVANCE', 'MERCHANT_CASH_ADVANCE', 'CONSUMER_DURABLE_LOAN'];
const frequencies = ['MONTHLY', 'WEEKLY', 'FORTNIGHTLY', 'QUARTERLY'];
const interestMethods = ['REDUCING_BALANCE', 'FLAT'];
const documents = [
  'Identity proof',
  'Address proof',
  'PAN',
  'Salary slips',
  'Bank statements',
  'Business documents',
];

const initialForm = {
  organizationId: '',
  productName: '',
  productCode: '',
  description: '',
  productType: 'PERSONAL_LOAN',
  status: 'DRAFT',
  minimumLoanAmount: '',
  maximumLoanAmount: '',
  minimumTenure: '',
  maximumTenure: '',
  repaymentFrequency: 'MONTHLY',
  interestRate: '',
  interestCalculationMethod: 'REDUCING_BALANCE',
  processingFeeValue: '',
  latePaymentFee: '',
  bounceCharge: '',
  gracePeriodDays: '3',
  minimumAge: '',
  maximumAge: '',
  minimumIncome: '',
  requiredCreditScore: '',
  maximumExistingEmiRatio: '',
  requiredDocuments: [],
};

export default function ProductWizardPage() {
  const [organizations, setOrganizations] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [validation, setValidation] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    organizationsApi
      .list()
      .then((items) => {
        setOrganizations(items);
        setForm((current) => ({ ...current, organizationId: current.organizationId || items[0]?.id || '' }));
      })
      .catch((err) => setError(showErrorToast(err)))
      .finally(() => setLoading(false));
  }, []);

  const organizationName = useMemo(
    () => organizations.find((organization) => organization.id === form.organizationId)?.name || '-',
    [form.organizationId, organizations],
  );

  function update(key, value) {
    setValidation('');
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleDocument(documentName) {
    setValidation('');
    setForm((current) => ({
      ...current,
      requiredDocuments: current.requiredDocuments.includes(documentName)
        ? current.requiredDocuments.filter((item) => item !== documentName)
        : [...current.requiredDocuments, documentName],
    }));
  }

  function validateStep(targetStep = step) {
    const requiredByStep = {
      0: [
        ['organizationId', 'Organization is required'],
        ['productName', 'Product name is required'],
        ['productCode', 'Product code is required'],
        ['productType', 'Product type is required'],
      ],
      1: [
        ['minimumLoanAmount', 'Minimum loan amount is required'],
        ['maximumLoanAmount', 'Maximum loan amount is required'],
        ['minimumTenure', 'Minimum tenure is required'],
        ['maximumTenure', 'Maximum tenure is required'],
      ],
      2: [['interestRate', 'Interest rate is required']],
    };
    const missing = requiredByStep[targetStep]?.find(([key]) => !String(form[key] ?? '').trim());
    if (missing) {
      setValidation(missing[1]);
      return false;
    }
    if (targetStep === 1 && Number(form.minimumLoanAmount) > Number(form.maximumLoanAmount)) {
      setValidation('Minimum loan amount cannot exceed maximum loan amount');
      return false;
    }
    if (targetStep === 1 && Number(form.minimumTenure) > Number(form.maximumTenure)) {
      setValidation('Minimum tenure cannot exceed maximum tenure');
      return false;
    }
    if (targetStep === 4 && !form.requiredDocuments.length) {
      setValidation('Select at least one required document');
      return false;
    }
    return true;
  }

  function next() {
    if (!validateStep()) return;
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function back() {
    setValidation('');
    setStep((current) => Math.max(current - 1, 0));
  }

  function numberValue(value) {
    return value === '' ? undefined : Number(value);
  }

  function payload() {
    const interestRate = Number(form.interestRate);
    return {
      organizationId: form.organizationId,
      productCode: form.productCode,
      name: form.productName,
      description: form.description || undefined,
      productType: form.productType,
      status: form.status,
      currency: 'INR',
      minimumLoanAmount: Number(form.minimumLoanAmount),
      maximumLoanAmount: Number(form.maximumLoanAmount),
      minimumTenure: Number(form.minimumTenure),
      maximumTenure: Number(form.maximumTenure),
      tenureUnit: 'MONTHS',
      repaymentFrequency: form.repaymentFrequency,
      interestType: 'FIXED',
      interestCalculationMethod: form.interestCalculationMethod,
      minimumInterestRate: interestRate,
      maximumInterestRate: interestRate,
      defaultInterestRate: interestRate,
      processingFeeType: 'PERCENTAGE',
      processingFeeValue: numberValue(form.processingFeeValue) ?? 0,
      // Flat charges only, per RBI's penal charges rules (no penal interest added to the rate).
      lateFeeConfiguration:
        form.latePaymentFee || form.bounceCharge
          ? { type: 'FIXED', amount: Number(form.latePaymentFee || 0), bounceCharge: Number(form.bounceCharge || 0) }
          : undefined,
      gracePeriodDays: numberValue(form.gracePeriodDays) ?? 0,
      minimumAge: numberValue(form.minimumAge),
      maximumAge: numberValue(form.maximumAge),
      minimumIncome: numberValue(form.minimumIncome),
      requiredCreditScore: numberValue(form.requiredCreditScore),
      requiresKyc: form.requiredDocuments.some((item) => ['Identity proof', 'Address proof', 'PAN'].includes(item)),
      requiresBankVerification: form.requiredDocuments.includes('Bank statements'),
      requiresAgreement: true,
      requiresManualApproval: true,
      metadata: {
        maximumExistingEmiRatio: numberValue(form.maximumExistingEmiRatio),
        requiredDocuments: form.requiredDocuments,
      },
    };
  }

  async function save() {
    for (let index = 0; index < steps.length - 1; index += 1) {
      if (!validateStep(index)) {
        setStep(index);
        return;
      }
    }
    setSaving(true);
    setError('');
    try {
      await productsApi.create(payload());
      showSuccessToast('Product created');
      navigate('/admin/configuration/products');
    } catch (err) {
      setError(showErrorToast(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Loan Product"
        description="Build a simple product in clear steps. Financial calculations continue to run on the backend."
        actions={
          <Link className="btn-secondary" to="/admin/configuration/products">
            <ArrowLeft size={16} />
            Back to Products
          </Link>
        }
      />

      {loading ? <LoadingState label="Loading organizations..." /> : null}
      {error ? <ErrorState message={error} /> : null}
      {!loading && !organizations.length ? (
        <EmptyState title="Create an organization first" description="A product must belong to an organization before it can be saved." />
      ) : null}

      {!loading && organizations.length ? (
        <>
          <div className="panel p-3">
            <div className="grid gap-2 md:grid-cols-6">
              {steps.map((item, index) => (
                <button
                  key={item}
                  className={`flex min-h-12 items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-semibold transition ${
                    index === step ? 'bg-bank text-white' : index < step ? 'bg-mint text-bank' : 'bg-slate-50 text-slate-500'
                  }`}
                  onClick={() => {
                    if (index <= step || validateStep()) setStep(index);
                  }}
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/20 ring-1 ring-current">
                    {index < step ? <Check size={14} /> : index + 1}
                  </span>
                  <span>{item}</span>
                </button>
              ))}
            </div>
          </div>

          {validation ? <div className="rounded-md bg-amber-50 p-3 text-sm font-medium text-amber-800">{validation}</div> : null}

          {step === 0 ? (
            <FormSection title="Basic Information" description="Name the product and choose the product type staff will see.">
              <FormField label="Organization">
                <select value={form.organizationId} onChange={(event) => update('organizationId', event.target.value)}>
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Product status">
                <select value={form.status} onChange={(event) => update('status', event.target.value)}>
                  {['DRAFT', 'ACTIVE', 'INACTIVE'].map((status) => (
                    <option key={status} value={status}>
                      {formatLabel(status)}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Product name">
                <input value={form.productName} onChange={(event) => update('productName', event.target.value)} />
              </FormField>
              <FormField label="Product code">
                <input value={form.productCode} onChange={(event) => update('productCode', event.target.value.toUpperCase())} />
              </FormField>
              <FormField label="Product type">
                <select value={form.productType} onChange={(event) => update('productType', event.target.value)}>
                  {productTypes.map((type) => (
                    <option key={type} value={type}>
                      {formatLabel(type)}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Description" className="md:col-span-2">
                <textarea rows={3} value={form.description} onChange={(event) => update('description', event.target.value)} />
              </FormField>
            </FormSection>
          ) : null}

          {step === 1 ? (
            <FormSection title="Loan Amount and Tenure" description="Set the allowed amount and tenure range.">
              <FormField label="Minimum loan amount">
                <input type="number" min="1" value={form.minimumLoanAmount} onChange={(event) => update('minimumLoanAmount', event.target.value)} />
              </FormField>
              <FormField label="Maximum loan amount">
                <input type="number" min="1" value={form.maximumLoanAmount} onChange={(event) => update('maximumLoanAmount', event.target.value)} />
              </FormField>
              <FormField label="Minimum tenure">
                <input type="number" min="1" value={form.minimumTenure} onChange={(event) => update('minimumTenure', event.target.value)} />
              </FormField>
              <FormField label="Maximum tenure">
                <input type="number" min="1" value={form.maximumTenure} onChange={(event) => update('maximumTenure', event.target.value)} />
              </FormField>
              <FormField label="Repayment frequency">
                <select value={form.repaymentFrequency} onChange={(event) => update('repaymentFrequency', event.target.value)}>
                  {frequencies.map((frequency) => (
                    <option key={frequency} value={frequency}>
                      {formatLabel(frequency)}
                    </option>
                  ))}
                </select>
              </FormField>
            </FormSection>
          ) : null}

          {step === 2 ? (
            <FormSection title="Interest and Fees" description="Keep pricing simple and transparent.">
              <FormField label="Interest rate">
                <input type="number" min="0" step="0.01" value={form.interestRate} onChange={(event) => update('interestRate', event.target.value)} />
              </FormField>
              <FormField label="Interest method">
                <select value={form.interestCalculationMethod} onChange={(event) => update('interestCalculationMethod', event.target.value)}>
                  {interestMethods.map((method) => (
                    <option key={method} value={method}>
                      {formatLabel(method)}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Processing fee">
                <input type="number" min="0" step="0.01" value={form.processingFeeValue} onChange={(event) => update('processingFeeValue', event.target.value)} />
              </FormField>
              <FormField label="Late payment fee (₹, flat per missed EMI)" hint="Charged once when an EMI is overdue beyond the grace period.">
                <input type="number" min="0" step="0.01" value={form.latePaymentFee} onChange={(event) => update('latePaymentFee', event.target.value)} />
              </FormField>
              <FormField label="Grace period (days)">
                <input type="number" min="0" max="30" value={form.gracePeriodDays} onChange={(event) => update('gracePeriodDays', event.target.value)} />
              </FormField>
              <FormField label="Bounce charge (₹, per bounced debit)">
                <input type="number" min="0" step="0.01" value={form.bounceCharge} onChange={(event) => update('bounceCharge', event.target.value)} />
              </FormField>
            </FormSection>
          ) : null}

          {step === 3 ? (
            <FormSection title="Eligibility Rules" description="Capture the simple policy checks required for this product.">
              <FormField label="Minimum age">
                <input type="number" min="18" value={form.minimumAge} onChange={(event) => update('minimumAge', event.target.value)} />
              </FormField>
              <FormField label="Maximum age">
                <input type="number" min="18" value={form.maximumAge} onChange={(event) => update('maximumAge', event.target.value)} />
              </FormField>
              <FormField label="Minimum income">
                <input type="number" min="0" value={form.minimumIncome} onChange={(event) => update('minimumIncome', event.target.value)} />
              </FormField>
              <FormField label="Minimum credit score">
                <input type="number" min="300" max="900" value={form.requiredCreditScore} onChange={(event) => update('requiredCreditScore', event.target.value)} />
              </FormField>
              <FormField label="Maximum existing EMI ratio">
                <input type="number" min="0" max="100" value={form.maximumExistingEmiRatio} onChange={(event) => update('maximumExistingEmiRatio', event.target.value)} />
              </FormField>
            </FormSection>
          ) : null}

          {step === 4 ? (
            <FormSection title="Required Documents" description="Select the documents customers must provide.">
              <div className="md:col-span-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {documents.map((documentName) => (
                  <label key={documentName} className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-3 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={form.requiredDocuments.includes(documentName)}
                      onChange={() => toggleDocument(documentName)}
                    />
                    <span>{documentName}</span>
                  </label>
                ))}
              </div>
            </FormSection>
          ) : null}

          {step === 5 ? (
            <section className="panel p-5">
              <h2 className="text-base font-semibold text-slate-950">Review and Save</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <ReviewItem label="Organization" value={organizationName} />
                <ReviewItem label="Product" value={`${form.productName || '-'} (${form.productCode || '-'})`} />
                <ReviewItem label="Type" value={formatLabel(form.productType)} />
                <ReviewItem label="Amount" value={`${formatMoney(form.minimumLoanAmount)} - ${formatMoney(form.maximumLoanAmount)}`} />
                <ReviewItem label="Tenure" value={`${form.minimumTenure || '-'} - ${form.maximumTenure || '-'} months`} />
                <ReviewItem label="Repayment frequency" value={formatLabel(form.repaymentFrequency)} />
                <ReviewItem label="Interest" value={`${form.interestRate || 0}% ${formatLabel(form.interestCalculationMethod)}`} />
                <ReviewItem label="Processing fee" value={`${form.processingFeeValue || 0}%`} />
                <ReviewItem label="Late fee" value={form.latePaymentFee ? formatMoney(form.latePaymentFee) : '-'} />
                <ReviewItem label="Bounce charge" value={form.bounceCharge ? formatMoney(form.bounceCharge) : '-'} />
                <ReviewItem label="Grace period" value={`${form.gracePeriodDays || 0} days`} />
                <ReviewItem label="Eligibility" value={`Age ${form.minimumAge || '-'} to ${form.maximumAge || '-'}, score ${form.requiredCreditScore || '-'}`} />
                <ReviewItem label="Documents" value={form.requiredDocuments.join(', ') || '-'} className="md:col-span-2" />
              </div>
            </section>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button className="btn-secondary" onClick={back} disabled={step === 0 || saving}>
              <ArrowLeft size={16} />
              Back
            </button>
            {step < steps.length - 1 ? (
              <button className="btn-primary" onClick={next}>
                Next
                <ArrowRight size={16} />
              </button>
            ) : (
              <button className="btn-primary" onClick={save} disabled={saving}>
                <Save size={16} />
                Save Product
              </button>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function ReviewItem({ label, value, className = '' }) {
  return (
    <div className={`rounded-md border border-slate-200 bg-slate-50 px-3 py-3 ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}
