'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/client';

export interface SessionUser {
  id: string; name: string; email: string; role: string; permissions: string[];
}
interface AuthCtx {
  user: SessionUser | null;
  loading: boolean;
  can: (...perms: string[]) => boolean;
  refresh: () => Promise<SessionUser | null>;
  login: (email: string, password: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
}
const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user } = await api<{ user: SessionUser }>('/auth/me');
      setUser(user);
      return user;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const value = useMemo<AuthCtx>(() => ({
    user, loading, refresh,
    can: (...perms) => !!user && (user.permissions.includes('*') || perms.some((p) => user.permissions.includes(p))),
    login: async (email, password) => {
      await api('/auth/login', { body: { email, password } });
      const u = await refresh();
      if (!u) throw new Error('Could not start session');
      return u;
    },
    logout: async () => {
      await api('/auth/logout', { method: 'POST', body: {} }).catch(() => undefined);
      setUser(null);
    },
  }), [user, loading, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}
