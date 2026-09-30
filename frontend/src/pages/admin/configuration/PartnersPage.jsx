import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import { partnersApi } from '../../../api/masterData';
import { ErrorState, LoadingState } from '../../../components/AsyncState';
import DataTable from '../../../components/DataTable';
import FilterBar from '../../../components/FilterBar';
import PageHeader from '../../../components/PageHeader';
import SearchInput from '../../../components/SearchInput';
import StatusBadge from '../../../components/StatusBadge';
import { formatLabel } from '../../../utils/format';
import { showErrorToast } from '../../../utils/toast';

export default function PartnersPage() {
  const [partners, setPartners] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    setError('');
    partnersApi
      .list()
      .then(setPartners)
      .catch((err) => setError(showErrorToast(err)))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const filteredPartners = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return partners;
    return partners.filter((partner) =>
      [partner.name, partner.partnerCode, partner.email, partner.phone, partner.contactPerson?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [partners, search]);

  const columns = [
    {
      key: 'partner',
      header: 'Partner',
      render: (partner) => (
        <div>
          <p className="font-semibold text-slate-950">{partner.name}</p>
          <p className="text-xs text-slate-500">{partner.partnerCode}</p>
        </div>
      ),
    },
    { key: 'contact', header: 'Contact person', render: (partner) => partner.contactPerson?.name || '-' },
    { key: 'mobile', header: 'Mobile number', render: (partner) => partner.phone || '-' },
    { key: 'email', header: 'Email', render: (partner) => partner.email || '-' },
    {
      key: 'products',
      header: 'Assigned products',
      render: (partner) => partner.productMappings?.length ?? '-',
    },
    { key: 'type', header: 'Type', render: (partner) => formatLabel(partner.partnerType) },
    { key: 'status', header: 'Status', render: (partner) => <StatusBadge status={partner.status} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Partners"
        description="View lending, sourcing, and merchant partners without exposing payout or credential details."
        actions={
          <button className="btn-secondary" onClick={load} disabled={loading}>
            <RefreshCcw size={16} />
            Refresh
          </button>
        }
      />

      <FilterBar>
        <SearchInput className="w-full sm:w-80" value={search} onChange={setSearch} placeholder="Search partners" />
      </FilterBar>

      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {loading ? (
        <LoadingState label="Loading partners..." />
      ) : (
        <DataTable
          columns={columns}
          rows={filteredPartners}
          emptyTitle="No partners found"
          emptyDescription="Partners will appear here after they are added to master data."
        />
      )}
    </div>
  );
}
