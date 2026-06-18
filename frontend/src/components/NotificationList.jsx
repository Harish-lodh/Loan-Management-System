import React from 'react';
import { Bell, Check } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NotificationList({ notifications = [], onRead }) {
  if (!notifications.length) {
    return <div className="panel p-6 text-sm text-slate-500">No notifications yet.</div>;
  }

  return (
    <div className="space-y-3">
      {notifications.map((notification) => (
        <article key={notification.id} className="panel p-4">
          <div className="flex items-start gap-3">
            <div className={`rounded-md p-2 ${notification.isRead ? 'bg-slate-100 text-slate-500' : 'bg-mint text-bank'}`}>
              <Bell size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-950">{notification.title}</h3>
                <span className="text-xs text-slate-500">{new Date(notification.createdAt).toLocaleString()}</span>
              </div>
              <p className="mt-1 text-sm text-slate-600">{notification.message}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {notification.priority || 'NORMAL'}
                </span>
                {notification.actionUrl ? (
                  <Link className="text-xs font-semibold text-bank" to={notification.actionUrl}>
                    Open related item
                  </Link>
                ) : null}
              </div>
            </div>
            {!notification.isRead && onRead ? (
              <button className="btn-secondary px-2 py-2" title="Mark as read" onClick={() => onRead(notification.id)}>
                <Check size={16} />
              </button>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
