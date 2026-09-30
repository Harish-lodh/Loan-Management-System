import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Guards a group of routes by permission. Without a permission it only requires a signed-in staff user.
export default function AdminRoute({ permission }) {
  const { can, loading } = useAuth();

  if (loading) {
    return <div className="p-8 text-sm text-slate-500">Loading workspace...</div>;
  }

  if (permission && !can(permission)) {
    const fallback = permission !== 'dashboard.view' && can('dashboard.view') ? '/admin' : '/profile';
    return <Navigate to={fallback} replace />;
  }

  return <Outlet />;
}
