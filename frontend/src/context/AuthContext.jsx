import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearAuthSession, getAccessToken, setAuthSession } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('loan_app_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get('/auth/me')
      .then((response) => {
        setUser(response.data);
        localStorage.setItem('loan_app_user', JSON.stringify(response.data));
      })
      .catch(() => {
        clearAuthSession();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === 'ADMIN',
      async login(email, password) {
        const response = await api.post('/auth/login', { email, password });
        setAuthSession(response.data);
        setUser(response.data.user);
        return response.data.user;
      },
      async refreshUser() {
        const response = await api.get('/users/profile');
        localStorage.setItem('loan_app_user', JSON.stringify(response.data));
        setUser(response.data);
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
    }),
    [loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
