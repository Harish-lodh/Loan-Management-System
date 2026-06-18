import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { ErrorState, LoadingState } from '../../components/AsyncState';
import PaginationControls from '../../components/PaginationControls';
import StatusBadge from '../../components/StatusBadge';
import { showErrorToast } from '../../utils/toast';

export default function AuditLogsPage() {
  const [data, setData] = useState({ items: [], meta: null });
  const [verification, setVerification] = useState(null);
  const [filters, setFilters] = useState({ search: '', page: 1 });
  const [expanded, setExpanded] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/audit-logs', {
        params: {
          page: filters.page,
          limit: 10,
          ...(filters.search ? { search: filters.search } : {}),
        },
      }),
      api.get('/audit-logs/verify'),
    ])
      .then(([logsResponse, verifyResponse]) => {
        setData(logsResponse.data);
        setVerification(verifyResponse.data);
      })
      .catch((err) => setError(showErrorToast(err)))
      .finally(() => setLoading(false));
  }, [filters]);

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Audit logs</h1>
          <p className="mt-1 text-sm text-slate-500">Tamper-evident chain of important platform actions.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="w-64"
            placeholder="Search action, entity, or actor"
            value={filters.search}
            onChange={(event) => setFilters({ search: event.target.value, page: 1 })}
          />
          {verification ? <StatusBadge status={verification.valid ? 'VALID' : 'BROKEN'} /> : null}
        </div>
      </div>
      {verification ? (
        <div className={`rounded-md p-4 text-sm ${verification.valid ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          {verification.message} Checked {verification.checked} records.
        </div>
      ) : null}
      {loading ? (
        <LoadingState label="Loading audit logs..." />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Seq</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Hash</th>
                  <th className="px-4 py-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr className="cursor-pointer hover:bg-slate-50" onClick={() => setExpanded(expanded === log.id ? '' : log.id)}>
                      <td className="px-4 py-3">{log.sequence}</td>
                      <td className="px-4 py-3 font-medium">{log.action}</td>
                      <td className="px-4 py-3">{log.entityType}</td>
                      <td className="px-4 py-3">{log.actor?.email || 'System'}</td>
                      <td className="max-w-xs truncate px-4 py-3 font-mono text-xs">{log.currentHash}</td>
                      <td className="px-4 py-3">{new Date(log.timestamp).toLocaleString()}</td>
                    </tr>
                    {expanded === log.id ? (
                      <tr>
                        <td colSpan={6} className="bg-slate-50 px-4 py-3">
                          <pre className="max-h-48 overflow-auto rounded-md bg-white p-3 text-xs text-slate-700">
                            {JSON.stringify({ metadata: log.metadata, previousHash: log.previousHash }, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {!data.items.length ? <div className="p-4 text-sm text-slate-500">No audit logs match the search.</div> : null}
          <PaginationControls meta={data.meta} onPage={(page) => setFilters({ ...filters, page })} />
        </div>
      )}
    </div>
  );
}
