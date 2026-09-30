import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import { organizationsApi, providersApi } from '../../../api/masterData';
import { ErrorState, LoadingState } from '../../../components/AsyncState';
import DataTable from '../../../components/DataTable';
import FilterBar from '../../../components/FilterBar';
import FormField from '../../../components/FormField';
import FormSection from '../../../components/FormSection';
import PageHeader from '../../../components/PageHeader';
import SearchInput from '../../../components/SearchInput';
import StatusBadge from '../../../components/StatusBadge';
import { formatDate, formatLabel } from '../../../utils/format';
import { showErrorToast, showSuccessToast } from '../../../utils/toast';

const providerTypes = ['', 'ESIGN', 'ENACH', 'DISBURSEMENT', 'PAYMENT_GATEWAY', 'SMS', 'EMAIL'];

const emptyProviderForm = {
  organizationId: '',
  providerCode: '',
  providerName: '',
  providerType: 'PAYMENT_GATEWAY',
  isSandbox: true,
  baseUrl: '',
};

// Secret field names per known provider code, so the form asks for the right credentials.
// Unrecognized provider codes fall back to a single generic "apiKey" field.
function secretFieldsFor(providerCode) {
  const code = providerCode.trim().toUpperCase();
  if (code.includes('EASEBUZZ')) return ['apiKey', 'apiSalt'];
  if (code.includes('DIGIO')) return ['clientId', 'clientSecret'];
  if (code.includes('DOQUFY')) return ['apiKey'];
  if (code.startsWith('MOCK')) return [];
  return ['apiKey'];
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [filters, setFilters] = useState({ search: '', type: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyProviderForm);
  const [secrets, setSecrets] = useState({});
  const [creating, setCreating] = useState(false);
  const [rotatingId, setRotatingId] = useState(null);
  const [rotateSecrets, setRotateSecrets] = useState({});

  function load() {
    setLoading(true);
    setError('');
    Promise.all([providersApi.list(), organizationsApi.list()])
      .then(([providerList, organizationList]) => {
        setProviders(providerList);
        setOrganizations(organizationList);
      })
      .catch((err) => setError(showErrorToast(err)))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const filteredProviders = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return providers.filter((provider) => {
      const matchesSearch =
        !search ||
        [provider.providerName, provider.providerCode, provider.providerType]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));
      const matchesType = !filters.type || provider.providerType === filters.type;
      return matchesSearch && matchesType;
    });
  }, [filters, providers]);

  async function createProvider(event) {
    event.preventDefault();
    setCreating(true);
    try {
      const fields = secretFieldsFor(form.providerCode);
      const payload = { ...form };
      if (fields.length && fields.every((field) => secrets[field])) {
        payload.secrets = Object.fromEntries(fields.map((field) => [field, secrets[field]]));
      }
      await providersApi.create(payload);
      showSuccessToast('Provider created');
      setForm(emptyProviderForm);
      setSecrets({});
      load();
    } catch (err) {
      showErrorToast(err);
    } finally {
      setCreating(false);
    }
  }

  async function submitRotate(providerId) {
    try {
      await providersApi.updateSecrets(providerId, rotateSecrets);
      showSuccessToast('Provider secrets updated');
      setRotatingId(null);
      setRotateSecrets({});
    } catch (err) {
      showErrorToast(err);
    }
  }

  const createSecretFields = secretFieldsFor(form.providerCode);

  const columns = [
    {
      key: 'provider',
      header: 'Provider',
      render: (provider) => (
        <div>
          <p className="font-semibold text-slate-950">{provider.providerName}</p>
          <p className="text-xs text-slate-500">{provider.providerCode}</p>
        </div>
      ),
    },
    { key: 'type', header: 'Type', render: (provider) => formatLabel(provider.providerType) },
    { key: 'environment', header: 'Environment', render: (provider) => provider.configuration?.environment || (provider.isSandbox ? 'Sandbox' : 'Production') },
    { key: 'baseUrl', header: 'Base URL', render: (provider) => provider.baseUrl || '-' },
    { key: 'status', header: 'Status', render: (provider) => <StatusBadge status={provider.status} /> },
    { key: 'updatedAt', header: 'Last updated', render: (provider) => formatDate(provider.updatedAt) },
    {
      key: 'secrets',
      header: 'Credentials',
      render: (provider) =>
        rotatingId === provider.id ? (
          <div className="flex flex-wrap items-center gap-2">
            {secretFieldsFor(provider.providerCode).length
              ? secretFieldsFor(provider.providerCode).map((field) => (
                  <input
                    key={field}
                    className="w-32"
                    placeholder={field}
                    type="password"
                    value={rotateSecrets[field] || ''}
                    onChange={(event) => setRotateSecrets((current) => ({ ...current, [field]: event.target.value }))}
                  />
                ))
              : (
                <input
                  className="w-32"
                  placeholder="apiKey"
                  type="password"
                  value={rotateSecrets.apiKey || ''}
                  onChange={(event) => setRotateSecrets((current) => ({ ...current, apiKey: event.target.value }))}
                />
              )}
            <button className="btn-primary px-2 py-1 text-xs" onClick={() => submitRotate(provider.id)}>
              Save
            </button>
            <button className="btn-secondary px-2 py-1 text-xs" onClick={() => { setRotatingId(null); setRotateSecrets({}); }}>
              Cancel
            </button>
          </div>
        ) : (
          <button
            className="font-semibold text-bank"
            onClick={() => {
              setRotatingId(provider.id);
              setRotateSecrets({});
            }}
          >
            Rotate secrets
          </button>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Providers"
        description="Configure payment (Easebuzz) and eSign (Digio, Doqufy) providers by organization. Secrets are encrypted at rest and never displayed after saving."
        actions={
          <button className="btn-secondary" onClick={load} disabled={loading}>
            <RefreshCcw size={16} />
            Refresh
          </button>
        }
      />

      <FormSection title="Add provider" description="Create a new provider record. Leave credential fields blank to run in mock mode.">
        <form className="contents" onSubmit={createProvider}>
          <FormField label="Organization">
            <select value={form.organizationId} onChange={(event) => setForm({ ...form, organizationId: event.target.value })} required>
              <option value="">Select organization</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Provider type">
            <select value={form.providerType} onChange={(event) => setForm({ ...form, providerType: event.target.value })}>
              {providerTypes.filter(Boolean).map((type) => (
                <option key={type} value={type}>
                  {formatLabel(type)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Provider code" hint="e.g. EASEBUZZ, DIGIO, DOQUFY">
            <input value={form.providerCode} onChange={(event) => setForm({ ...form, providerCode: event.target.value })} required />
          </FormField>
          <FormField label="Provider name">
            <input value={form.providerName} onChange={(event) => setForm({ ...form, providerName: event.target.value })} required />
          </FormField>
          <FormField label="Base URL" hint="Optional; provider adapters use env-configured defaults if left blank">
            <input value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} />
          </FormField>
          <FormField label="Environment">
            <select value={form.isSandbox ? 'sandbox' : 'production'} onChange={(event) => setForm({ ...form, isSandbox: event.target.value === 'sandbox' })}>
              <option value="sandbox">Sandbox</option>
              <option value="production">Production</option>
            </select>
          </FormField>
          {createSecretFields.map((field) => (
            <FormField key={field} label={`Credential: ${field}`} hint="Leave blank to run this provider in mock mode">
              <input
                type="password"
                value={secrets[field] || ''}
                onChange={(event) => setSecrets((current) => ({ ...current, [field]: event.target.value }))}
              />
            </FormField>
          ))}
          <div className="flex items-end">
            <button className="btn-primary" disabled={creating}>
              {creating ? 'Creating...' : 'Create provider'}
            </button>
          </div>
        </form>
      </FormSection>

      <FilterBar>
        <SearchInput
          className="w-full sm:w-80"
          value={filters.search}
          onChange={(search) => setFilters((current) => ({ ...current, search }))}
          placeholder="Search providers"
        />
        <select className="w-full sm:w-48" value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}>
          {providerTypes.map((type) => (
            <option key={type || 'all'} value={type}>
              {type ? formatLabel(type) : 'All types'}
            </option>
          ))}
        </select>
      </FilterBar>

      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {loading ? (
        <LoadingState label="Loading providers..." />
      ) : (
        <DataTable
          columns={columns}
          rows={filteredProviders}
          emptyTitle="No providers found"
          emptyDescription="Provider records will appear here once they are configured on the backend."
        />
      )}
    </div>
  );
}
