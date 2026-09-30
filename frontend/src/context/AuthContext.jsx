import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearAuthSession, getAccessToken, setAuthSession } from '../api/client';

const AuthContext = createContext(null);

export const ROLE_LABELS = {
  SUPER_ADMIN: 'Platform Admin',
  ADMIN: 'Admin',
  CREDIT_OFFICER: 'Credit Officer',
  OPERATIONS: 'Operations',
  COLLECTIONS: 'Collections',
  VIEWER: 'Viewer',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('loan_app_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  function storeUser(nextUser) {
    localStorage.setItem('loan_app_user', JSON.stringify(nextUser));
    setUser(nextUser);
  }

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get('/auth/me')
      .then((response) => storeUser(response.data))
      .catch(() => {
        clearAuthSession();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(() => {
    // Permissions are computed by the backend from the staff role; the UI only hides what the API would refuse.
    const permissions = new Set(user?.effectivePermissions ?? []);
    return {
      user,
      loading,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN',
      isSuperAdmin: user?.role === 'SUPER_ADMIN',
      can: (permission) => permissions.has(permission),
      async login(email, password) {
        const response = await api.post('/auth/login', { email, password });
        setAuthSession(response.data);
        setUser(response.data.user);
        return response.data.user;
      },
      async refreshUser() {
        const response = await api.get('/auth/me');
        storeUser(response.data);
        return response.data;
      },
      async logout() {
        try {
          await api.post('/auth/logout');
        } catch {
          // The local session should still be cleared if the token is already expired.
        }
        clearAuthSession();
        setUser(null);
      },
    };
  }, [loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
