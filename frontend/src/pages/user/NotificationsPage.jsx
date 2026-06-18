import React, { useEffect, useState } from 'react';
import { api, errorMessage } from '../../api/client';
import { ErrorState, LoadingState } from '../../components/AsyncState';
import NotificationList from '../../components/NotificationList';
import PaginationControls from '../../components/PaginationControls';

export default function NotificationsPage() {
  const [data, setData] = useState({ items: [], unreadCount: 0, meta: null });
  const [filters, setFilters] = useState({ search: '', unreadOnly: false, page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api
      .get('/notifications', {
        params: {
          page: filters.page,
          limit: 10,
          ...(filters.search ? { search: filters.search } : {}),
          ...(filters.unreadOnly ? { unreadOnly: true } : {}),
        },
      })
      .then((response) => setData(response.data))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, [filters]);

  async function markRead(id) {
    await api.patch(`/notifications/${id}/read`);
    load();
  }

  async function markAllRead() {
    await api.patch('/notifications/read-all');
    load();
  }

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500">{data.unreadCount} unread messages</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="w-56"
            placeholder="Search notifications"
            value={filters.search}
            onChange={(event) => setFilters({ ...filters, search: event.target.value, page: 1 })}
          />
          <label className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={filters.unreadOnly}
              onChange={(event) => setFilters({ ...filters, unreadOnly: event.target.checked, page: 1 })}
            />
            Unread
          </label>
          <button className="btn-secondary" onClick={markAllRead} disabled={!data.unreadCount}>
            Mark all read
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState label="Loading notifications..." />
      ) : (
        <>
          <NotificationList notifications={data.items} onRead={markRead} />
          <PaginationControls meta={data.meta} onPage={(page) => setFilters({ ...filters, page })} />
        </>
      )}
    </div>
  );
}
