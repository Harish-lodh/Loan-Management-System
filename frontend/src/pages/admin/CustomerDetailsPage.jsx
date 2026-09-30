import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { ErrorState, LoadingState } from '../../components/AsyncState';
import FormSection from '../../components/FormSection';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { formatDate, formatMoney } from '../../utils/format';
import { showErrorToast, showSuccessToast } from '../../utils/toast';
import { CustomerFormFields, customerPayload, emptyCustomerForm } from './CustomersPage';

function toForm(customer) {
  const form = { ...emptyCustomerForm };
  for (const key of Object.keys(form)) {
    if (key !== 'pan' && customer[key] !== null && customer[key] !== undefined) {
      form[key] = String(customer[key]);
    }
  }
  return form;
}

export default function CustomerDetailsPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const [customer, setCustomer] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(emptyCustomerForm);
  const [saving, setSaving] = useState(false);

  function load() {
    api
      .get(`/api/v1/customers/${id}`)
      .then((response) => {
        setCustomer(response.data);
        setForm(toForm(response.data));
      })
      .catch((err) => setError(showErrorToast(err)));
  }

  useEffect(load, [id]);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/api/v1/customers/${id}`, customerPayload(form));
      showSuccessToast('Customer updated');
      setEditing(false);
      load();
    } catch (err) {
      showErrorToast(err);
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(status) {
    try {
      await api.patch(`/api/v1/customers/${id}`, { status });
      showSuccessToast(`Customer marked ${status.toLowerCase()}`);
      load();
    } catch (err) {
      showErrorToast(err);
    }
  }

  if (error) return <ErrorState message={error} />;
  if (!customer) return <LoadingState label="Loading customer..." />;

  const address = [customer.addressLine, customer.city, customer.state, customer.pincode].filter(Boolean).join(', ');

  return (
    <div className="space-y-6">
      <PageHeader
        title={customer.fullName}
        description={`${customer.customerNumber} · ${customer.phone}${customer.email ? ` · ${customer.email}` : ''}`}
        actions={
          <>
            <StatusBadge status={customer.status} />
            {can('application.create') && customer.status === 'ACTIVE' ? (
              <Link className="btn-primary" to={`/admin/applications/new?customerId=${customer.id}`}>
                New application
              </Link>
            ) : null}
            {can('customer.manage') ? (
              <button className="btn-secondary" onClick={() => setEditing((value) => !value)}>
                {editing ? 'Cancel' : 'Edit'}
              </button>
            ) : null}
          </>
        }
      />

      {editing ? (
        <form onSubmit={save} className="space-y-3">
          <FormSection title="Edit customer" description="Leave PAN empty to keep the current one.">
            <CustomerFormFields form={form} onChange={setForm} />
          </FormSection>
          <div className="flex flex-wrap justify-between gap-2">
            <div className="flex gap-2">
              {customer.status !== 'ACTIVE' ? (
                <button type="button" className="btn-secondary" onClick={() => setStatus('ACTIVE')}>
                  Activate
                </button>
              ) : null}
              {customer.status !== 'BLOCKED' ? (
                <button type="button" className="btn-secondary text-rose-700" onClick={() => setStatus('BLOCKED')}>
                  Block
                </button>
              ) : null}
            </div>
            <button className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      ) : (
        <section className="panel grid gap-4 p-5 text-sm md:grid-cols-3">
          <div>
            <p className="text-slate-500">PAN</p>
            <p className="font-mono">{customer.panMasked || '-'}</p>
          </div>
          <div>
            <p className="text-slate-500">Date of birth</p>
            <p>{formatDate(customer.dateOfBirth)}</p>
          </div>
          <div>
            <p className="text-slate-500">Employment</p>
            <p>{customer.employmentType ? customer.employmentType.replaceAll('_', ' ') : '-'}</p>
          </div>
          <div>
            <p className="text-slate-500">Occupation</p>
            <p>{customer.occupation || '-'}</p>
          </div>
          <div>
            <p className="text-slate-500">Monthly income</p>
            <p>{customer.monthlyIncome ? formatMoney(customer.monthlyIncome) : '-'}</p>
          </div>
          <div>
            <p className="text-slate-500">Address</p>
            <p>{address || '-'}</p>
          </div>
        </section>
      )}

      <section className="panel p-4">
        <h2 className="font-semibold">Applications</h2>
        <div className="mt-4 space-y-3">
          {customer.loanApplications?.length ? (
            customer.loanApplications.map((application) => (
              <Link
                key={application.id}
                to={`/admin/applications/${application.id}`}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 hover:text-bank"
              >
                <div>
                  <p className="font-medium">{formatMoney(application.amount)} · {application.tenureMonths} months</p>
                  <p className="text-sm text-slate-500">{application.applicationNumber || application.id} · {formatDate(application.createdAt)}</p>
                </div>
                <StatusBadge status={application.status} />
              </Link>
            ))
          ) : (
            <p className="text-sm text-slate-500">No applications yet.</p>
          )}
        </div>
      </section>

      <section className="panel p-4">
        <h2 className="font-semibold">Loans</h2>
        <div className="mt-4 space-y-3">
          {customer.loans?.length ? (
            customer.loans.map((loan) => (
              <div key={loan.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0">
                <div>
                  <p className="font-medium">{formatMoney(loan.principal)}</p>
                  <p className="text-sm text-slate-500">
                    {loan.loanAccountNumber || loan.id} · Outstanding {formatMoney(loan.outstandingBalance)}
                    {loan.dpd ? ` · ${loan.dpd} DPD` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  {loan.assetClassification && loan.status !== 'CLOSED' ? <StatusBadge status={loan.assetClassification} /> : null}
                  <StatusBadge status={loan.status} />
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">No loans yet.</p>
          )}
        </div>
      </section>

      <section className="panel p-4">
        <h2 className="font-semibold">Repayment history</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {customer.repayments?.length ? (
            customer.repayments.map((repayment) => (
              <div key={repayment.id} className="rounded-md border border-slate-200 p-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span>{formatDate(repayment.dueDate)}</span>
                  <StatusBadge status={repayment.status} />
                </div>
                <p className="mt-2 font-semibold">{formatMoney(repayment.emiAmount)}</p>
                {repayment.daysOverdue ? <p className="mt-1 text-xs text-red-600">{repayment.daysOverdue} days overdue</p> : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">No repayments scheduled.</p>
          )}
        </div>
      </section>
    </div>
  );
}
