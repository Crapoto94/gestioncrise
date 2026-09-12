import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, setAuthToken } from '../services/api';
import type { AuthUser } from '../types';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Le JWT applicatif est gardé en sessionStorage (effacé à la fermeture de
// l'onglet) — jamais le mot de passe AD, seulement notre propre jeton de
// session (cf. GUIDE §3.2).
const STORAGE_KEY = 'pgc_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem(STORAGE_KEY);
    if (!token) { setLoading(false); return; }
    setAuthToken(token);
    api.get('/auth/me')
      .then((r) => setUser(r.data.user))
      .catch(() => { sessionStorage.removeItem(STORAGE_KEY); setAuthToken(null); })
      .finally(() => setLoading(false));
  }, []);

  async function login(username: string, password: string) {
    const { data } = await api.post('/auth/login', { username, password });
    sessionStorage.setItem(STORAGE_KEY, data.token);
    setAuthToken(data.token);
    setUser(data.user);
  }

  function logout() {
    sessionStorage.removeItem(STORAGE_KEY);
    setAuthToken(null);
    setUser(null);
  }

  function hasRole(...roles: string[]) {
    return !!user && user.roles.some((r) => roles.includes(r));
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider');
  return ctx;
}
