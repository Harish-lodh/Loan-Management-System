import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminRoute() {
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return <div className="p-8 text-sm text-slate-500">Loading admin workspace...</div>;
  }

  if (!isAdmin) {
    return <Navigate to="/profile" replace />;
  }

  return <Outlet />;
}
