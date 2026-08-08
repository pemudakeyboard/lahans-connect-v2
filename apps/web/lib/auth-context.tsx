'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { clearTokens, getAccessToken, setTokens } from './api';
import { loginRequest, meRequest, type MeResponse } from './lahans-api';

interface AuthContextValue {
  user: MeResponse | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (code: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    meRequest()
      .then(setUser)
      .catch(() => clearTokens())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const pair = await loginRequest(identifier, password);
    setTokens(pair);
    const me = await meRequest();
    setUser(me);
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  const hasPermission = useCallback(
    (code: string) => {
      if (!user) return false;
      // master.* wildcard: master.read grants generic gate; entity-level codes checked exactly
      if (user.permissions.includes(code)) return true;
      if (code === 'master.read' && user.permissions.some((p) => p.startsWith('master.')))
        return true;
      return false;
    },
    [user],
  );

  const value = useMemo(
    () => ({ user, loading, login, logout, hasPermission }),
    [user, loading, login, logout, hasPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>.');
  return ctx;
}
