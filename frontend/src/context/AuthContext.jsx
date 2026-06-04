import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const api = axios.create({ baseURL: '/api', timeout: 10000, withCredentials: true });

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authority, setAuthority]   = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const checkSession = useCallback(async () => {
    try {
      const res = await api.get('/auth/session');
      setAuthority(res.data.authenticated ? res.data.authority : null);
    } catch {
      setAuthority(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => { checkSession(); }, [checkSession]);

  const login = useCallback(async (roleId) => {
    const res = await api.post('/auth/login', { roleId });
    setAuthority(res.data.authority);
    return res.data.authority;
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout');
    setAuthority(null);
  }, []);

  return (
    <AuthContext.Provider value={{ authority, authLoading, login, logout, checkSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export default AuthContext;
