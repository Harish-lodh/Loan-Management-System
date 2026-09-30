import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { ErrorState, LoadingState } from '../../components/AsyncState';
import FormField from '../../components/FormField';
import FormSection from '../../components/FormSection';
import PageHeader from '../../components/PageHeader';
import PaginationControls from '../../components/PaginationControls';
import { ROLE_LABELS, useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/format';
import { showErrorToast, showSuccessToast } from '../../utils/toast';

// SUPER_ADMIN is intentionally absent: vendor accounts are created only by the tenant bootstrap script.
const ASSIGNABLE_ROLES = [
  { value: 'ADMIN', description: 'Full access including staff and configuration' },
  { value: 'CREDIT_OFFICER', description: 'Reviews, approves and rejects applications' },
  { value: 'OPERATIONS', description: 'Captures applications, agreements, eSign, eNACH, disbursement' },
  { value: 'COLLECTIONS', description: 'Repayments and payment links' },
  { value: 'VIEWER', description: 'Read-only access' },
];

const emptyStaffForm = { name: '', email: '', phone: '', password: '', role: 'OPERATIONS' };

export default function StaffUsersPage() {
  const { user: currentUser } = useAuth();
  const [data, setData] = useState({ items: [], meta: null });
  const [filters, setFilters] = useState({ search: '', page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [staffForm, setStaffForm] = useState(emptyStaffForm);
  const [creating, setCreating] = useState(false);

  function load() {
    setLoading(true);
    api
      .get('/admin/staff-users', {
        params: { page: filters.page, limit: 10, ...(filters.search ? { search: filters.search } : {}) },
      })
      .then((response) => setData(response.data))
      .catch((err) => setError(showErrorToast(err)))
      .finally(() => setLoading(false));
  }

  useEffect(load, [filters]);

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

  async function update(staff, changes, message) {
    try {
      await api.patch(`/admin/staff-users/${staff.id}`, changes);
      showSuccessToast(message);
      load();
    } catch (err) {
      showErrorToast(err);
    }
  }

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff users"
        description="Everyone who can sign in to this workspace. Each role only sees the screens and actions it needs."
        actions={
          <input
            className="w-64"
            placeholder="Search name, email, or phone"
            value={filters.search}
            onChange={(event) => setFilters({ search: event.target.value, page: 1 })}
          />
        }
      />

      <form onSubmit={createStaffUser}>
        <FormSection title="Create staff account" description="Share the temporary password with the staff member securely; they can change it from Profile.">
          <FormField label="Name">
            <input value={staffForm.name} onChange={(event) => setStaffForm({ ...staffForm, name: event.target.value })} required />
          </FormField>
          <FormField label="Email">
            <input type="email" value={staffForm.email} onChange={(event) => setStaffForm({ ...staffForm, email: event.target.value })} required />
          </FormField>
          <FormField label="Phone">
            <input value={staffForm.phone} onChange={(event) => setStaffForm({ ...staffForm, phone: event.target.value })} required />
          </FormField>
          <FormField label="Temporary password" hint="At least 8 characters with a letter and a number.">
            <input
              type="password"
              value={staffForm.password}
              onChange={(event) => setStaffForm({ ...staffForm, password: event.target.value })}
              required
            />
          </FormField>
          <FormField label="Role" hint={ASSIGNABLE_ROLES.find((role) => role.value === staffForm.role)?.description}>
            <select value={staffForm.role} onChange={(event) => setStaffForm({ ...staffForm, role: event.target.value })}>
              {ASSIGNABLE_ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {ROLE_LABELS[role.value]}
                </option>
              ))}
            </select>
          </FormField>
          <div className="flex items-end">
            <button className="btn-primary" disabled={creating}>
              {creating ? 'Creating...' : 'Create staff account'}
            </button>
          </div>
        </FormSection>
      </form>

      {loading ? (
        <LoadingState label="Loading staff..." />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Last login</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((staff) => {
                  const isSelf = staff.id === currentUser?.id;
                  const locked = isSelf || staff.role === 'SUPER_ADMIN';
                  return (
                    <tr key={staff.id}>
                      <td className="px-4 py-3 font-medium">
                        {staff.name}
                        {isSelf ? <span className="ml-2 text-xs text-slate-400">(you)</span> : null}
                      </td>
                      <td className="px-4 py-3">{staff.email}</td>
                      <td className="px-4 py-3">
                        {locked ? (
                          ROLE_LABELS[staff.role] ?? staff.role
                        ) : (
                          <select
                            className="w-44"
                            value={staff.role}
                            onChange={(event) => update(staff, { role: event.target.value }, 'Role updated')}
                          >
                            {ASSIGNABLE_ROLES.map((role) => (
                              <option key={role.value} value={role.value}>
                                {ROLE_LABELS[role.value]}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3">{formatDate(staff.lastLoginAt)}</td>
                      <td className="px-4 py-3">
                        {locked ? (
                          <span className={staff.isActive ? 'text-emerald-700' : 'text-slate-500'}>{staff.isActive ? 'Active' : 'Inactive'}</span>
                        ) : (
                          <button
                            className="font-semibold text-bank"
                            onClick={() => update(staff, { isActive: !staff.isActive }, staff.isActive ? 'Account deactivated' : 'Account activated')}
                          >
                            {staff.isActive ? 'Active (deactivate)' : 'Inactive (activate)'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!data.items.length ? <div className="p-4 text-sm text-slate-500">No staff match the search.</div> : null}
          <PaginationControls meta={data.meta} onPage={(page) => setFilters({ ...filters, page })} />
        </div>
      )}
    </div>
  );
}
