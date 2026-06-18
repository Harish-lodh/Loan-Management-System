import React from 'react';
import {
  BarChart3,
  Bell,
  Calculator,
  ClipboardList,
  Cog,
  FileText,
  Gauge,
  History,
  Home,
  Receipt,
  UserCircle,
  Users,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const userLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: Gauge },
  { to: '/apply', label: 'Apply', icon: FileText },
  { to: '/calculator', label: 'EMI Calculator', icon: Calculator },
  { to: '/loans', label: 'My Loans', icon: ClipboardList },
  { to: '/repayments', label: 'Repayments', icon: Receipt },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/profile', label: 'Profile', icon: UserCircle },
];

const adminLinks = [
  { to: '/admin', label: 'Dashboard', icon: BarChart3 },
  { to: '/admin/masters', label: 'Master Data', icon: Cog },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/applications', label: 'Applications', icon: ClipboardList },
  { to: '/admin/repayments', label: 'Repayments', icon: Receipt },
  { to: '/admin/audit-logs', label: 'Audit Logs', icon: History },
];

export default function Sidebar({ open, onClose }) {
  const { isAdmin } = useAuth();
  const links = isAdmin ? adminLinks : userLinks;

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-72 border-r border-slate-200 bg-white p-4 transition lg:sticky lg:top-16 lg:z-10 lg:h-[calc(100vh-4rem)] ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-slate-500">
          <Home size={16} />
          {isAdmin ? 'Bank staff workspace' : 'Customer workspace'}
        </div>
        <nav className="space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/admin' || link.to === '/dashboard'}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${
                    isActive ? 'bg-mint text-bank' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                  }`
                }
              >
                <Icon size={18} />
                {link.label}
              </NavLink>
            );
          })}
        </nav>
      </aside>
      {open ? <button className="fixed inset-0 z-20 bg-slate-950/20 lg:hidden" onClick={onClose} aria-label="Close navigation" /> : null}
    </>
  );
}
