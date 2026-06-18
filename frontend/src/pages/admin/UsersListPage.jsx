import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import { ErrorState, LoadingState } from '../../components/AsyncState';
import PaginationControls from '../../components/PaginationControls';

export default function UsersListPage() {
  const [data, setData] = useState({ items: [], meta: null });
  const [filters, setFilters] = useState({ search: '', page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api
      .get('/admin/users', {
        params: {
          page: filters.page,
          limit: 10,
          ...(filters.search ? { search: filters.search } : {}),
        },
      })
      .then((response) => setData(response.data))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [filters]);

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Users</h1>
          <p className="mt-1 text-sm text-slate-500">Search customers and inspect their portfolio history.</p>
        </div>
        <input
          className="w-64"
          placeholder="Search name, email, or phone"
          value={filters.search}
          onChange={(event) => setFilters({ search: event.target.value, page: 1 })}
        />
      </div>
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
                    <td className="px-4 py-3">
                      <Link className="font-semibold text-bank" to={`/admin/users/${user.id}`}>
                        Open
                      </Link>
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
