import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Handshake, PackagePlus, PlugZap, RefreshCcw, Save } from 'lucide-react';
import { api, errorMessage } from '../../api/client';
import StatusBadge from '../../components/StatusBadge';

const productTypes = ['PERSONAL_LOAN', 'BUSINESS_LOAN', 'SALARY_ADVANCE', 'MERCHANT_CASH_ADVANCE', 'CONSUMER_DURABLE_LOAN'];
const partnerTypes = ['LENDING_PARTNER', 'DSA', 'FINTECH_PLATFORM', 'MERCHANT', 'EMPLOYER'];
const providerTypes = ['ESIGN', 'ENACH', 'DISBURSEMENT', 'KYC', 'BANK_VERIFICATION'];

export default function AdminMastersPage() {
  const [data, setData] = useState({ organizations: [], products: [], partners: [], providers: [] });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [organization, setOrganization] = useState({
    organizationCode: 'FTLEND',
    name: 'Fintree Lending',
    legalName: 'Fintree Financial Services Private Limited',
    registeredAddress: 'Bengaluru, Karnataka',
  });
  const [product, setProduct] = useState({
    productCode: 'NEW_PRODUCT',
    name: 'New Loan Product',
    productType: 'PERSONAL_LOAN',
    minimumLoanAmount: 25000,
    maximumLoanAmount: 500000,
    minimumTenure: 6,
    maximumTenure: 36,
    minimumInterestRate: 10,
    maximumInterestRate: 24,
    defaultInterestRate: 14,
    processingFeeValue: 2,
    requiresKyc: true,
    requiresBankVerification: true,
    requiresAgreement: true,
    requiresManualApproval: true,
    requiresESign: true,
    requiresENach: true,
  });
  const [partner, setPartner] = useState({
    partnerCode: 'NEW_PARTNER',
    name: 'New Partner',
    legalName: 'New Partner Private Limited',
    partnerType: 'LENDING_PARTNER',
  });
  const [provider, setProvider] = useState({
    providerCode: 'MOCK_PROVIDER',
    providerName: 'Mock Provider',
    providerType: 'ESIGN',
    isSandbox: true,
    baseUrl: 'https://mock-provider.local',
  });
  const [field, setField] = useState({ productId: '', fieldKey: 'age', label: 'Age', fieldType: 'NUMBER', required: true, displayOrder: 10 });
  const [assign, setAssign] = useState({ partnerId: '', productId: '', requiresESign: true, requiresENach: true, requiresManualApproval: true });

  const organizationId = data.organizations[0]?.id;
  const selectedProduct = useMemo(() => data.products.find((item) => item.id === field.productId), [data.products, field.productId]);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setError('');
    try {
      const [organizations, products, partners, providers] = await Promise.all([
        api.get('/api/v1/organizations'),
        api.get('/api/v1/products'),
        api.get('/api/v1/partners'),
        api.get('/api/v1/service-providers'),
      ]);
      setData({
        organizations: organizations.data,
        products: products.data,
        partners: partners.data,
        providers: providers.data,
      });
      const firstProduct = products.data[0]?.id ?? '';
      const firstPartner = partners.data[0]?.id ?? '';
      setField((current) => ({ ...current, productId: current.productId || firstProduct }));
      setAssign((current) => ({ ...current, productId: current.productId || firstProduct, partnerId: current.partnerId || firstPartner }));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function run(action, success) {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(success);
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function withOrganization(payload) {
    if (!organizationId) return payload;
    return { organizationId, ...payload };
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Master data</h1>
          <p className="mt-1 text-sm text-slate-500">Products, partners, providers, and workflow configuration.</p>
        </div>
        <button className="btn-secondary" onClick={refresh} disabled={loading}>
          <RefreshCcw size={16} />
          Refresh
        </button>
      </div>

      {error ? <div className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
      {message ? <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Organization" icon={Building2}>
          <FormGrid>
            <TextInput label="Code" value={organization.organizationCode} onChange={(value) => setOrganization({ ...organization, organizationCode: value })} />
            <TextInput label="Name" value={organization.name} onChange={(value) => setOrganization({ ...organization, name: value })} />
            <TextInput label="Legal name" value={organization.legalName} onChange={(value) => setOrganization({ ...organization, legalName: value })} className="md:col-span-2" />
            <TextInput label="Registered address" value={organization.registeredAddress} onChange={(value) => setOrganization({ ...organization, registeredAddress: value })} className="md:col-span-2" />
          </FormGrid>
          <ActionRow>
            <button className="btn-primary" disabled={loading} onClick={() => run(() => api.post('/api/v1/organizations', organization), 'Organization saved')}>
              <Save size={16} />
              Save organization
            </button>
          </ActionRow>
        </Panel>

        <Panel title="Service provider" icon={PlugZap}>
          <FormGrid>
            <TextInput label="Code" value={provider.providerCode} onChange={(value) => setProvider({ ...provider, providerCode: value })} />
            <TextInput label="Name" value={provider.providerName} onChange={(value) => setProvider({ ...provider, providerName: value })} />
            <SelectInput label="Type" value={provider.providerType} options={providerTypes} onChange={(value) => setProvider({ ...provider, providerType: value })} />
            <TextInput label="Base URL" value={provider.baseUrl} onChange={(value) => setProvider({ ...provider, baseUrl: value })} />
          </FormGrid>
          <ActionRow>
            <button className="btn-primary" disabled={loading || !organizationId} onClick={() => run(() => api.post('/api/v1/service-providers', withOrganization(provider)), 'Provider saved')}>
              <Save size={16} />
              Save provider
            </button>
          </ActionRow>
        </Panel>

        <Panel title="Product builder" icon={PackagePlus}>
          <FormGrid>
            <TextInput label="Code" value={product.productCode} onChange={(value) => setProduct({ ...product, productCode: value })} />
            <TextInput label="Name" value={product.name} onChange={(value) => setProduct({ ...product, name: value })} />
            <SelectInput label="Type" value={product.productType} options={productTypes} onChange={(value) => setProduct({ ...product, productType: value })} />
            <NumberInput label="Minimum amount" value={product.minimumLoanAmount} onChange={(value) => setProduct({ ...product, minimumLoanAmount: value })} />
            <NumberInput label="Maximum amount" value={product.maximumLoanAmount} onChange={(value) => setProduct({ ...product, maximumLoanAmount: value })} />
            <NumberInput label="Minimum tenure" value={product.minimumTenure} onChange={(value) => setProduct({ ...product, minimumTenure: value })} />
            <NumberInput label="Maximum tenure" value={product.maximumTenure} onChange={(value) => setProduct({ ...product, maximumTenure: value })} />
            <NumberInput label="Default interest" value={product.defaultInterestRate} onChange={(value) => setProduct({ ...product, defaultInterestRate: value })} />
            <NumberInput label="Processing fee" value={product.processingFeeValue} onChange={(value) => setProduct({ ...product, processingFeeValue: value })} />
          </FormGrid>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {[
              ['requiresKyc', 'KYC'],
              ['requiresAgreement', 'Agreement'],
              ['requiresManualApproval', 'Manual approval'],
              ['requiresESign', 'eSign'],
              ['requiresENach', 'eNACH'],
              ['requiresBankVerification', 'Bank verification'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2">
                <input type="checkbox" className="h-4 w-4" checked={Boolean(product[key])} onChange={(event) => setProduct({ ...product, [key]: event.target.checked })} />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <ActionRow>
            <button className="btn-primary" disabled={loading || !organizationId} onClick={() => run(() => api.post('/api/v1/products', withOrganization({ ...product, minimumInterestRate: product.minimumInterestRate || 8, maximumInterestRate: product.maximumInterestRate || 30 })), 'Product created')}>
              <Save size={16} />
              Create product
            </button>
            {selectedProduct ? <StatusBadge status={selectedProduct.status} /> : null}
          </ActionRow>
        </Panel>

        <Panel title="Partner" icon={Handshake}>
          <FormGrid>
            <TextInput label="Code" value={partner.partnerCode} onChange={(value) => setPartner({ ...partner, partnerCode: value })} />
            <TextInput label="Name" value={partner.name} onChange={(value) => setPartner({ ...partner, name: value })} />
            <TextInput label="Legal name" value={partner.legalName} onChange={(value) => setPartner({ ...partner, legalName: value })} />
            <SelectInput label="Type" value={partner.partnerType} options={partnerTypes} onChange={(value) => setPartner({ ...partner, partnerType: value })} />
          </FormGrid>
          <ActionRow>
            <button className="btn-primary" disabled={loading || !organizationId} onClick={() => run(() => api.post('/api/v1/partners', withOrganization(partner)), 'Partner saved')}>
              <Save size={16} />
              Save partner
            </button>
          </ActionRow>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Application fields" icon={PackagePlus}>
          <FormGrid>
            <SelectInput label="Product" value={field.productId} options={data.products.map((item) => ({ label: item.name, value: item.id }))} onChange={(value) => setField({ ...field, productId: value })} />
            <TextInput label="Field key" value={field.fieldKey} onChange={(value) => setField({ ...field, fieldKey: value })} />
            <TextInput label="Label" value={field.label} onChange={(value) => setField({ ...field, label: value })} />
            <SelectInput label="Field type" value={field.fieldType} options={['TEXT', 'NUMBER', 'CURRENCY', 'SELECT', 'DATE']} onChange={(value) => setField({ ...field, fieldType: value })} />
          </FormGrid>
          <ActionRow>
            <button className="btn-secondary" disabled={loading || !field.productId} onClick={() => run(() => api.post(`/api/v1/products/${field.productId}/application-fields`, field), 'Field added')}>
              Add field
            </button>
            <button className="btn-secondary" disabled={loading || !field.productId} onClick={() => run(() => api.post(`/api/v1/products/${field.productId}/publish`), 'Product published')}>
              Publish product
            </button>
          </ActionRow>
        </Panel>

        <Panel title="Partner product" icon={Handshake}>
          <FormGrid>
            <SelectInput label="Partner" value={assign.partnerId} options={data.partners.map((item) => ({ label: item.name, value: item.id }))} onChange={(value) => setAssign({ ...assign, partnerId: value })} />
            <SelectInput label="Product" value={assign.productId} options={data.products.map((item) => ({ label: item.name, value: item.id }))} onChange={(value) => setAssign({ ...assign, productId: value })} />
          </FormGrid>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {[
              ['requiresManualApproval', 'Manual approval'],
              ['requiresESign', 'eSign'],
              ['requiresENach', 'eNACH'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2">
                <input type="checkbox" className="h-4 w-4" checked={Boolean(assign[key])} onChange={(event) => setAssign({ ...assign, [key]: event.target.checked })} />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <ActionRow>
            <button className="btn-primary" disabled={loading || !assign.partnerId || !assign.productId} onClick={() => run(() => api.post(`/api/v1/partners/${assign.partnerId}/products`, assign), 'Product assigned')}>
              Assign product
            </button>
          </ActionRow>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <List title="Organizations" items={data.organizations} primary="name" secondary="organizationCode" />
        <List title="Products" items={data.products} primary="name" secondary="productCode" status />
        <List title="Partners" items={data.partners} primary="name" secondary="partnerCode" status />
      </div>
    </div>
  );
}

function Panel({ title, icon: Icon, children }) {
  return (
    <section className="panel p-5">
      <div className="mb-4 flex items-center gap-2">
        <Icon size={18} className="text-bank" />
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function FormGrid({ children }) {
  return <div className="grid gap-3 md:grid-cols-2">{children}</div>;
}

function ActionRow({ children }) {
  return <div className="mt-4 flex flex-wrap items-center gap-3">{children}</div>;
}

function TextInput({ label, value, onChange, className = '' }) {
  return (
    <div className={className}>
      <label>{label}</label>
      <input value={value ?? ''} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function NumberInput({ label, value, onChange }) {
  return (
    <div>
      <label>{label}</label>
      <input type="number" value={value ?? ''} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}

function SelectInput({ label, value, options, onChange }) {
  const normalized = options.map((option) => (typeof option === 'string' ? { label: option.replaceAll('_', ' '), value: option } : option));
  return (
    <div>
      <label>{label}</label>
      <select value={value ?? ''} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select</option>
        {normalized.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}

function List({ title, items, primary, secondary, status = false }) {
  return (
    <section className="panel p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3 space-y-2">
        {items.length ? items.slice(0, 6).map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{item[primary]}</p>
              <p className="truncate text-xs text-slate-500">{item[secondary]}</p>
            </div>
            {status ? <StatusBadge status={item.status} /> : null}
          </div>
        )) : <p className="text-sm text-slate-500">No records</p>}
      </div>
    </section>
  );
}
