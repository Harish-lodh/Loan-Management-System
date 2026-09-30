import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { ErrorState, LoadingState } from '../../components/AsyncState';
import FormField from '../../components/FormField';
import FormSection from '../../components/FormSection';
import PageHeader from '../../components/PageHeader';
import PaginationControls from '../../components/PaginationControls';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { formatMoney } from '../../utils/format';
import { showErrorToast, showSuccessToast } from '../../utils/toast';

export const EMPLOYMENT_TYPES = ['SALARIED', 'SELF_EMPLOYED', 'BUSINESS_OWNER', 'CONTRACT', 'UNEMPLOYED'];

export const emptyCustomerForm = {
  fullName: '',
  phone: '',
  email: '',
  pan: '',
  dateOfBirth: '',
  addressLine: '',
  city: '',
  state: '',
  pincode: '',
  occupation: '',
  employmentType: '',
  monthlyIncome: '',
};

// Strips empty strings so optional fields are simply omitted from the request.
export function customerPayload(form) {
  const payload = {};
  for (const [key, value] of Object.entries(form)) {
    if (value === '' || value === null || value === undefined) continue;
    payload[key] = key === 'monthlyIncome' ? Number(value) : value;
  }
  return payload;
}

export function CustomerFormFields({ form, onChange }) {
  const set = (name) => (event) => onChange({ ...form, [name]: event.target.value });
  return (
    <>
      <FormField label="Full name *">
        <input value={form.fullName} onChange={set('fullName')} required minLength={2} />
      </FormField>
      <FormField label="Mobile *">
        <input value={form.phone} onChange={set('phone')} required placeholder="9876543210" />
      </FormField>
      <FormField label="Email">
        <input type="email" value={form.email} onChange={set('email')} />
      </FormField>
      <FormField label="PAN" hint="Stored encrypted; only the last 4 characters are shown.">
        <input value={form.pan} onChange={set('pan')} placeholder="ABCDE1234F" maxLength={10} className="uppercase" />
      </FormField>
      <FormField label="Date of birth">
        <input type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} />
      </FormField>
      <FormField label="Employment type">
        <select value={form.employmentType} onChange={set('employmentType')}>
          <option value="">Select</option>
          {EMPLOYMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Occupation">
        <input value={form.occupation} onChange={set('occupation')} />
      </FormField>
      <FormField label="Monthly income (₹)">
        <input type="number" min="0" value={form.monthlyIncome} onChange={set('monthlyIncome')} />
      </FormField>
      <FormField label="Address" className="md:col-span-2">
        <input value={form.addressLine} onChange={set('addressLine')} />
      </FormField>
      <FormField label="City">
        <input value={form.city} onChange={set('city')} />
      </FormField>
      <FormField label="State">
        <input value={form.state} onChange={set('state')} />
      </FormField>
      <FormField label="Pincode">
        <input value={form.pincode} onChange={set('pincode')} maxLength={6} />
      </FormField>
    </>
  );
}

export default function CustomersPage() {
  const { can } = useAuth();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState({ items: [], meta: null });
  const [filters, setFilters] = useState({ search: searchParams.get('search') || '', status: '', page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyCustomerForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const search = searchParams.get('search') || '';
    setFilters((current) => (current.search === search ? current : { ...current, search, page: 1 }));
  }, [searchParams]);

  function load() {
    setLoading(true);
    api
      .get('/api/v1/customers', {
        params: {
          page: filters.page,
          limit: 10,
          ...(filters.search ? { search: filters.search } : {}),
          ...(filters.status ? { status: filters.status } : {}),
        },
      })
      .then((response) => setData(response.data))
      .catch((err) => setError(showErrorToast(err)))
      .finally(() => setLoading(false));
  }

  useEffect(load, [filters]);

  async function createCustomer(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await api.post('/api/v1/customers', customerPayload(form));
      showSuccessToast(`Customer ${response.data.customerNumber} created`);
      setForm(emptyCustomerForm);
      setShowForm(false);
      load();
    } catch (err) {
      showErrorToast(err);
    } finally {
      setSaving(false);
    }
  }

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Borrower records maintained by your team. Customers do not have a login."
        actions={
          can('customer.manage') ? (
            <button className="btn-primary" onClick={() => setShowForm((value) => !value)}>
              {showForm ? 'Close' : 'Add customer'}
            </button>
          ) : null
        }
      />

      {showForm ? (
        <form onSubmit={createCustomer} className="space-y-3">
          <FormSection title="New customer" description="Mobile and PAN must be unique within your organization.">
            <CustomerFormFields form={form} onChange={setForm} />
          </FormSection>
          <div className="flex justify-end">
            <button className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Create customer'}
            </button>
          </div>
        </form>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <input
          className="w-72"
          placeholder="Search name, mobile, email or customer no."
          value={filters.search}
          onChange={(event) => setFilters({ ...filters, search: event.target.value, page: 1 })}
        />
        <select className="w-40" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value, page: 1 })}>
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="BLOCKED">Blocked</option>
        </select>
      </div>

      {loading ? (
        <LoadingState label="Loading customers..." />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Customer no.</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Mobile</th>
                  <th className="px-4 py-3">PAN</th>
                  <th className="px-4 py-3">Monthly income</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((customer) => (
                  <tr key={customer.id}>
                    <td className="px-4 py-3 font-mono text-xs">{customer.customerNumber}</td>
                    <td className="px-4 py-3 font-medium">{customer.fullName}</td>
                    <td className="px-4 py-3">{customer.phone}</td>
                    <td className="px-4 py-3 font-mono text-xs">{customer.panMasked || '-'}</td>
                    <td className="px-4 py-3">{customer.monthlyIncome ? formatMoney(customer.monthlyIncome) : '-'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={customer.status} />
                    </td>
                    <td className="px-4 py-3">
                      <Link className="font-semibold text-bank" to={`/admin/customers/${customer.id}`}>
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.items.length ? <div className="p-4 text-sm text-slate-500">No customers match the search.</div> : null}
          <PaginationControls meta={data.meta} onPage={(page) => setFilters({ ...filters, page })} />
        </div>
      )}
    </div>
  );
}
