import React, { useState } from 'react';
import { Bell, LogOut, Menu, Search, UserCircle } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const titles = [
  ['/admin/configuration/products/new', 'Create Loan Product'],
  ['/admin/configuration/products', 'Loan Products'],
  ['/admin/configuration/organization', 'Organization Settings'],
  ['/admin/configuration/partners', 'Partners'],
  ['/admin/configuration/providers', 'Providers'],
  ['/admin/configuration', 'Configuration'],
  ['/admin/applications', 'Loan Applications'],
  ['/admin/repayments', 'Repayments'],
  ['/admin/audit-logs', 'Audit Logs'],
  ['/admin/users', 'Customer List'],
  ['/admin/staff-users', 'Staff Users'],
  ['/admin', 'Dashboard'],
  ['/notifications', 'Notifications'],
  ['/profile', 'Profile'],
  ['/calculator', 'EMI Calculator'],
];

export default function Navbar({ onMenu }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const pageTitle = titles.find(([path]) => location.pathname === path || (path !== '/admin' && location.pathname.startsWith(`${path}/`)))?.[1] || 'Workspace';

  function submitSearch(event) {
    event.preventDefault();
    const query = search.trim();
    if (!query) return;
    navigate(`/admin/users?search=${encodeURIComponent(query)}`);
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button className="btn-secondary px-2 py-2 lg:hidden" onClick={onMenu} title="Open navigation">
            <Menu size={18} />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950 sm:text-base">{pageTitle}</p>
            <p className="hidden text-xs text-slate-500 sm:block">Internal staff workspace</p>
          </div>
        </div>
        {user ? (
          <div className="flex items-center gap-3">
            <form className="relative hidden w-72 xl:block" onSubmit={submitSearch}>
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <span className="sr-only">Search workspace</span>
              <input
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search customers, loans, or applications"
              />
            </form>
            <Link className="btn-secondary px-2 py-2" to="/notifications" title="Notifications">
              <Bell size={18} />
            </Link>
            <Link className="btn-secondary px-2 py-2" to="/profile" title="Profile">
              <UserCircle size={18} />
            </Link>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold">{user.name}</p>
              <p className="text-xs text-slate-500">{user.role}</p>
            </div>
            <button
              className="btn-secondary px-2 py-2"
              title="Sign out"
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
            >
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link className="btn-secondary" to="/login">
              Staff login
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
