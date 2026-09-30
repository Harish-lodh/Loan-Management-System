import React from 'react';
import {
  BarChart3,
  Bell,
  ClipboardList,
  Building2,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Handshake,
  History,
  Landmark,
  PackagePlus,
  PlugZap,
  Receipt,
  Settings,
  Users,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const staffGroups = [
  {
    title: 'Dashboard',
    links: [{ to: '/admin', label: 'Overview', icon: BarChart3 }],
  },
  {
    title: 'Customers',
    links: [{ to: '/admin/users', label: 'Customer List', icon: Users }],
  },
  {
    title: 'Loans',
    links: [
      { to: '/admin/applications', label: 'Loan Applications', icon: ClipboardList },
      { to: '/admin/repayments', label: 'Repayments', icon: Receipt },
      { to: '/calculator', label: 'EMI Calculator', icon: Calculator },
    ],
  },
  {
    title: 'Configuration',
    links: [
      { to: '/admin/configuration', label: 'Overview', icon: Settings, end: true },
      { to: '/admin/configuration/products', label: 'Loan Products', icon: PackagePlus },
      { to: '/admin/configuration/partners', label: 'Partners', icon: Handshake },
      { to: '/admin/configuration/providers', label: 'Providers', icon: PlugZap },
      { to: '/admin/configuration/organization', label: 'Organization Settings', icon: Building2 },
    ],
  },
  {
    title: 'Administration',
    links: [
      { to: '/admin/staff-users', label: 'Staff Users', icon: Users },
      { to: '/notifications', label: 'Notifications', icon: Bell },
      { to: '/admin/audit-logs', label: 'Audit Logs', icon: History },
    ],
  },
];

const limitedStaffGroups = [
  {
    title: 'Account',
    links: [
      { to: '/calculator', label: 'EMI Calculator', icon: Calculator },
      { to: '/notifications', label: 'Notifications', icon: Bell },
    ],
  },
];

export default function Sidebar({ open, collapsed, onClose, onToggle }) {
  const { isAdmin } = useAuth();
  const groups = isAdmin ? staffGroups : limitedStaffGroups;
  const width = collapsed ? 'lg:w-20' : 'lg:w-72';

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-slate-200 bg-white transition duration-200 ${width} ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
          <NavLink to={isAdmin ? '/admin' : '/profile'} className="flex min-w-0 items-center gap-3" onClick={onClose}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-bank text-white">
              <Landmark size={19} />
            </span>
            <span className={`min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
              <span className="block truncate text-sm font-semibold text-slate-950">LedgerLine</span>
              <span className="block truncate text-xs text-slate-500">Loan management</span>
            </span>
          </NavLink>
          <button className="btn-secondary hidden px-2 py-2 lg:inline-flex" onClick={onToggle} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {groups.map((group) => (
            <div key={group.title}>
              <p className={`mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400 ${collapsed ? 'lg:sr-only' : ''}`}>
                {group.title}
              </p>
              <div className="space-y-1">
                {group.links.map((link) => {
                  const Icon = link.icon;
                  return (
                    <NavLink
                      key={`${group.title}-${link.to}-${link.label}`}
                      to={link.to}
                      end={link.end ?? link.to === '/admin'}
                      onClick={onClose}
                      title={collapsed ? link.label : undefined}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${
                          isActive ? 'bg-mint text-bank' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                        } ${collapsed ? 'lg:justify-center lg:px-2' : ''}`
                      }
                    >
                      <Icon size={18} className="shrink-0" />
                      <span className={`truncate ${collapsed ? 'lg:sr-only' : ''}`}>{link.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>
      {open ? <button className="fixed inset-0 z-20 bg-slate-950/20 lg:hidden" onClick={onClose} aria-label="Close navigation" /> : null}
    </>
  );
}
