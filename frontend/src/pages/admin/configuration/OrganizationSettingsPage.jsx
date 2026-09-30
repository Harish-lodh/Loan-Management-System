import React, { useEffect, useState } from 'react';
import { RefreshCcw, Save } from 'lucide-react';
import { organizationsApi } from '../../../api/masterData';
import { ErrorState, LoadingState } from '../../../components/AsyncState';
import FormField from '../../../components/FormField';
import FormSection from '../../../components/FormSection';
import PageHeader from '../../../components/PageHeader';
import StatusBadge from '../../../components/StatusBadge';
import { showErrorToast, showSuccessToast } from '../../../utils/toast';

const initialForm = {
  id: '',
  organizationCode: '',
  name: '',
  legalName: '',
  registeredAddress: '',
  logoUrl: '',
  defaultCurrency: 'INR',
  dateFormat: 'DD/MM/YYYY',
  contactEmail: '',
  contactPhone: '',
  grievanceContact: '',
  status: 'ACTIVE',
};

export default function OrganizationSettingsPage() {
  const [organizations, setOrganizations] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function hydrate(organization) {
    if (!organization) {
      setForm(initialForm);
      return;
    }
    setForm({
      id: organization.id,
      organizationCode: organization.organizationCode || '',
      name: organization.name || '',
      legalName: organization.legalName || '',
      registeredAddress: organization.registeredAddress || '',
      logoUrl: organization.logoUrl || '',
      defaultCurrency: organization.defaultCurrency || 'INR',
      dateFormat: organization.supportDetails?.dateFormat || 'DD/MM/YYYY',
      contactEmail: organization.supportDetails?.email || '',
      contactPhone: organization.supportDetails?.phone || '',
      grievanceContact: organization.supportDetails?.grievanceContact || '',
      status: organization.status || 'ACTIVE',
    });
  }

  function load() {
    setLoading(true);
    setError('');
    organizationsApi
      .list()
      .then((items) => {
        setOrganizations(items);
        hydrate(items[0]);
      })
      .catch((err) => setError(showErrorToast(err)))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function payload() {
    return {
      organizationCode: form.organizationCode,
      name: form.name,
      legalName: form.legalName,
      registeredAddress: form.registeredAddress || undefined,
      logoUrl: form.logoUrl || undefined,
      defaultCurrency: form.defaultCurrency || 'INR',
      status: form.status,
      supportDetails: {
        email: form.contactEmail || undefined,
        phone: form.contactPhone || undefined,
        dateFormat: form.dateFormat || undefined,
        grievanceContact: form.grievanceContact || undefined,
      },
    };
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      if (form.id) {
        await organizationsApi.update(form.id, payload());
      } else {
        await organizationsApi.create(payload());
      }
      showSuccessToast('Organization settings saved');
      load();
    } catch (err) {
      setError(showErrorToast(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organization Settings"
        description="Manage the organization identity and public contact details shown across loan operations."
        actions={
          <>
            {form.status ? <StatusBadge status={form.status} /> : null}
            <button className="btn-secondary" onClick={load} disabled={loading || saving}>
              <RefreshCcw size={16} />
              Refresh
            </button>
            <button className="btn-primary" onClick={save} disabled={loading || saving}>
              <Save size={16} />
              Save
            </button>
          </>
        }
      />

      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {loading ? <LoadingState label="Loading organization settings..." /> : null}

      {!loading ? (
        <>
          {organizations.length > 1 ? (
            <FormSection title="Select Organization" description="Choose the organization you want to edit.">
              <FormField label="Organization">
                <select
                  value={form.id}
                  onChange={(event) => hydrate(organizations.find((organization) => organization.id === event.target.value))}
                >
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </FormField>
            </FormSection>
          ) : null}

          <FormSection title="Organization Identity">
            <FormField label="Organization name">
              <input value={form.name} onChange={(event) => update('name', event.target.value)} />
            </FormField>
            <FormField label="Organization code">
              <input value={form.organizationCode} onChange={(event) => update('organizationCode', event.target.value.toUpperCase())} />
            </FormField>
            <FormField label="Legal name" className="md:col-span-2">
              <input value={form.legalName} onChange={(event) => update('legalName', event.target.value)} />
            </FormField>
            <FormField label="Address" className="md:col-span-2">
              <textarea rows={3} value={form.registeredAddress} onChange={(event) => update('registeredAddress', event.target.value)} />
            </FormField>
            <FormField label="Logo URL">
              <input value={form.logoUrl} onChange={(event) => update('logoUrl', event.target.value)} />
            </FormField>
            <FormField label="Currency">
              <select value={form.defaultCurrency} onChange={(event) => update('defaultCurrency', event.target.value)}>
                {['INR', 'USD', 'EUR', 'GBP'].map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </FormField>
          </FormSection>

          <FormSection title="Contact Details">
            <FormField label="Contact email">
              <input type="email" value={form.contactEmail} onChange={(event) => update('contactEmail', event.target.value)} />
            </FormField>
            <FormField label="Contact phone">
              <input value={form.contactPhone} onChange={(event) => update('contactPhone', event.target.value)} />
            </FormField>
            <FormField label="Date format">
              <select value={form.dateFormat} onChange={(event) => update('dateFormat', event.target.value)}>
                {['DD/MM/YYYY', 'DD-MM-YYYY', 'YYYY-MM-DD'].map((format) => (
                  <option key={format} value={format}>
                    {format}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Grievance contact">
              <input value={form.grievanceContact} onChange={(event) => update('grievanceContact', event.target.value)} />
            </FormField>
          </FormSection>
        </>
      ) : null}
    </div>
  );
}
