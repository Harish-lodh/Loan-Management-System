import React, { useEffect, useState } from 'react';
import { Building2, Handshake, PackagePlus, PlugZap, RefreshCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getMasterDataSummary } from '../../../api/masterData';
import { EmptyState, ErrorState, LoadingState } from '../../../components/AsyncState';
import PageHeader from '../../../components/PageHeader';
import { showErrorToast } from '../../../utils/toast';

const cards = [
  {
    title: 'Organization Settings',
    description: 'Name, code, contact, currency, logo, and grievance details.',
    to: '/admin/configuration/organization',
    key: 'organizations',
    icon: Building2,
  },
  {
    title: 'Loan Products',
    description: 'Simple loan products with amount, tenure, interest, fees, eligibility, and documents.',
    to: '/admin/configuration/products',
    key: 'products',
    icon: PackagePlus,
  },
  {
    title: 'Partners',
    description: 'Sourcing and lending partners that bring applications into the platform.',
    to: '/admin/configuration/partners',
    key: 'partners',
    icon: Handshake,
  },
  {
    title: 'Providers',
    description: 'eSign, eNACH, disbursement, SMS, and email provider setup.',
    to: '/admin/configuration/providers',
    key: 'providers',
    icon: PlugZap,
  },
];

export default function ConfigurationOverviewPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    setError('');
    getMasterDataSummary()
      .then(setData)
      .catch((err) => setError(showErrorToast(err)))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuration"
        description="Keep master data separate and easy to maintain. Open only the section you need."
        actions={
          <button className="btn-secondary" onClick={load} disabled={loading}>
            <RefreshCcw size={16} />
            Refresh
          </button>
        }
      />

      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {loading ? <LoadingState label="Loading configuration..." /> : null}

      {!loading && !error && data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;
            const count = data[card.key]?.length ?? 0;
            return (
              <section key={card.title} className="panel flex min-h-56 flex-col p-5">
                <div className="flex items-start justify-between gap-4">
                  <span className="grid h-10 w-10 place-items-center rounded-md bg-mint text-bank">
                    <Icon size={20} />
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {count} {count === 1 ? 'record' : 'records'}
                  </span>
                </div>
                <div className="mt-5 flex-1">
                  <h2 className="text-lg font-semibold text-slate-950">{card.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{card.description}</p>
                </div>
                <Link className="btn-primary mt-5" to={card.to}>
                  Open
                </Link>
              </section>
            );
          })}
        </div>
      ) : null}

      {!loading && !error && data && cards.every((card) => !data[card.key]?.length) ? (
        <EmptyState title="No configuration records yet" description="Create the organization first, then add products, partners, and providers." />
      ) : null}
    </div>
  );
}
