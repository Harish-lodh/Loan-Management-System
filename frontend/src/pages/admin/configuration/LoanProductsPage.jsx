import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Plus, RefreshCcw } from 'lucide-react';
import { productsApi } from '../../../api/masterData';
import { ErrorState, LoadingState } from '../../../components/AsyncState';
import DataTable from '../../../components/DataTable';
import FilterBar from '../../../components/FilterBar';
import PageHeader from '../../../components/PageHeader';
import SearchInput from '../../../components/SearchInput';
import StatusBadge from '../../../components/StatusBadge';
import { formatLabel, formatMoney } from '../../../utils/format';
import { showErrorToast, showSuccessToast } from '../../../utils/toast';

const statuses = ['', 'DRAFT', 'PUBLISHED', 'ACTIVE', 'INACTIVE', 'ARCHIVED'];

export default function LoanProductsPage() {
  const [products, setProducts] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState('');

  function load() {
    setLoading(true);
    setError('');
    productsApi
      .list()
      .then(setProducts)
      .catch((err) => setError(showErrorToast(err)))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function publish(product) {
    setSavingId(product.id);
    setError('');
    try {
      await productsApi.publish(product.id);
      showSuccessToast('Product published');
      load();
    } catch (err) {
      setError(showErrorToast(err));
    } finally {
      setSavingId('');
    }
  }

  const filteredProducts = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch =
        !search ||
        [product.name, product.productCode, product.productType]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));
      const matchesStatus = !filters.status || product.status === filters.status;
      return matchesSearch && matchesStatus;
    });
  }, [filters, products]);

  const columns = [
    {
      key: 'product',
      header: 'Product',
      render: (product) => (
        <div>
          <p className="font-semibold text-slate-950">{product.name}</p>
          <p className="text-xs text-slate-500">{product.productCode}</p>
        </div>
      ),
    },
    { key: 'productType', header: 'Type', render: (product) => formatLabel(product.productType) },
    {
      key: 'amount',
      header: 'Amount',
      render: (product) => `${formatMoney(product.minimumLoanAmount)} - ${formatMoney(product.maximumLoanAmount)}`,
    },
    {
      key: 'tenure',
      header: 'Tenure',
      render: (product) => `${product.minimumTenure} - ${product.maximumTenure} ${formatLabel(product.tenureUnit || 'MONTHS')}`,
    },
    {
      key: 'interest',
      header: 'Interest',
      render: (product) => `${Number(product.defaultInterestRate || 0).toFixed(2)}%`,
    },
    { key: 'status', header: 'Status', render: (product) => <StatusBadge status={product.status} /> },
    {
      key: 'actions',
      header: 'Actions',
      render: (product) =>
        product.status === 'DRAFT' ? (
          <button className="btn-secondary px-3 py-1.5" onClick={() => publish(product)} disabled={savingId === product.id}>
            <CheckCircle2 size={15} />
            Publish
          </button>
        ) : (
          <span className="text-xs text-slate-500">No action</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loan Products"
        description="Create and publish simple loan products with clear amount, tenure, interest, eligibility, and document rules."
        actions={
          <>
            <button className="btn-secondary" onClick={load} disabled={loading}>
              <RefreshCcw size={16} />
              Refresh
            </button>
            <Link className="btn-primary" to="/admin/configuration/products/new">
              <Plus size={16} />
              Create Product
            </Link>
          </>
        }
      />

      <FilterBar>
        <SearchInput
          className="w-full sm:w-80"
          value={filters.search}
          onChange={(search) => setFilters((current) => ({ ...current, search }))}
          placeholder="Search products"
        />
        <select className="w-full sm:w-52" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
          {statuses.map((status) => (
            <option key={status || 'all'} value={status}>
              {status ? formatLabel(status) : 'All statuses'}
            </option>
          ))}
        </select>
      </FilterBar>

      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {loading ? (
        <LoadingState label="Loading products..." />
      ) : (
        <DataTable
          columns={columns}
          rows={filteredProducts}
          emptyTitle="No loan products found"
          emptyDescription="Create a product to start accepting applications for that loan type."
        />
      )}
    </div>
  );
}
