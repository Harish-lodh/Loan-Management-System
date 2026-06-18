import React from 'react';
import { Bell, Landmark, LogOut, Menu, UserCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ onMenu }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <button className="btn-secondary px-2 py-2 lg:hidden" onClick={onMenu} title="Open navigation">
            <Menu size={18} />
          </button>
          <Link to={user?.role === 'ADMIN' ? '/admin' : '/dashboard'} className="flex items-center gap-2 font-semibold">
            <span className="rounded-md bg-bank p-2 text-white">
              <Landmark size={18} />
            </span>
            LedgerLine
          </Link>
        </div>
        {user ? (
          <div className="flex items-center gap-3">
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
              Login
            </Link>
            <Link className="btn-primary" to="/register">
              Register
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
