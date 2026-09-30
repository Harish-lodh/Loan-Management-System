import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLocation, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { ErrorState, LoadingState } from '../../components/AsyncState';
import FormField from '../../components/FormField';
import FormSection from '../../components/FormSection';
import PaginationControls from '../../components/PaginationControls';
import { showErrorToast, showSuccessToast } from '../../utils/toast';

const emptyStaffForm = { name: '', email: '', phone: '', password: '', role: 'USER' };

export default function UsersListPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState({ items: [], meta: null });
  const [filters, setFilters] = useState({ search: searchParams.get('search') || '', page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [staffForm, setStaffForm] = useState(emptyStaffForm);
  const [creating, setCreating] = useState(false);
  const isStaffPage = location.pathname === '/admin/staff-users';
  const endpoint = isStaffPage ? '/admin/staff-users' : '/admin/users';

  useEffect(() => {
    const search = searchParams.get('search') || '';
    setFilters((current) => (current.search === search ? current : { search, page: 1 }));
  }, [searchParams]);

  function load() {
    setLoading(true);
    api
      .get(endpoint, {
        params: {
          page: filters.page,
          limit: 10,
          ...(filters.search ? { search: filters.search } : {}),
        },
      })
      .then((response) => setData(response.data))
      .catch((err) => setError(showErrorToast(err)))
      .finally(() => setLoading(false));
  }

  useEffect(load, [filters, endpoint]);

  async function createStaffUser(event) {
    event.preventDefault();
    setCreating(true);
    try {
      await api.post('/admin/staff-users', staffForm);
      showSuccessToast('Staff account created');
      setStaffForm(emptyStaffForm);
      load();
    } catch (err) {
      showErrorToast(err);
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(user) {
    try {
      await api.patch(`/admin/staff-users/${user.id}`, { isActive: !user.isActive });
      load();
    } catch (err) {
      showErrorToast(err);
    }
  }

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">{isStaffPage ? 'Staff users' : 'Customer list'}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isStaffPage
              ? 'Internal accounts that can sign in to this workspace.'
              : 'Borrower records created from loan applications. Customers never sign in directly.'}
          </p>
        </div>
        <input
          className="w-64"
          placeholder="Search name, email, or phone"
          value={filters.search}
          onChange={(event) => setFilters({ search: event.target.value, page: 1 })}
        />
      </div>

      {isStaffPage ? (
        <FormSection title="Create staff account" description="Internal ops/admin login. Share the password with the staff member out of band.">
          <form className="contents" onSubmit={createStaffUser}>
            <FormField label="Name">
              <input value={staffForm.name} onChange={(event) => setStaffForm({ ...staffForm, name: event.target.value })} required />
            </FormField>
            <FormField label="Email">
              <input type="email" value={staffForm.email} onChange={(event) => setStaffForm({ ...staffForm, email: event.target.value })} required />
            </FormField>
            <FormField label="Phone">
              <input value={staffForm.phone} onChange={(event) => setStaffForm({ ...staffForm, phone: event.target.value })} required />
            </FormField>
            <FormField label="Temporary password">
              <input
                type="password"
                value={staffForm.password}
                onChange={(event) => setStaffForm({ ...staffForm, password: event.target.value })}
                required
              />
            </FormField>
            <FormField label="Role">
              <select value={staffForm.role} onChange={(event) => setStaffForm({ ...staffForm, role: event.target.value })}>
                <option value="USER">Staff</option>
                <option value="ADMIN">Admin</option>
              </select>
            </FormField>
            <div className="flex items-end">
              <button className="btn-primary" disabled={creating}>
                {creating ? 'Creating...' : 'Create staff account'}
              </button>
            </div>
          </form>
        </FormSection>
      ) : null}

      {loading ? (
        <LoadingState label="Loading users..." />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Role</th>
                  {isStaffPage ? <th className="px-4 py-3">Status</th> : null}
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3 font-medium">{user.name}</td>
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3">{user.phone}</td>
                    <td className="px-4 py-3">{user.role}</td>
                    {isStaffPage ? (
                      <td className="px-4 py-3">
                        <button className="font-semibold text-bank" onClick={() => toggleActive(user)}>
                          {user.isActive ? 'Active (deactivate)' : 'Inactive (activate)'}
                        </button>
                      </td>
                    ) : null}
                    <td className="px-4 py-3">
                      {isStaffPage ? '—' : (
                        <Link className="font-semibold text-bank" to={`/admin/users/${user.id}`}>
                          Open
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.items.length ? <div className="p-4 text-sm text-slate-500">No users match the search.</div> : null}
          <PaginationControls meta={data.meta} onPage={(page) => setFilters({ ...filters, page })} />
        </div>
      )}
    </div>
  );
}
