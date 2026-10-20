'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { MeResponse, SessionUser, Space } from '@empgt/contracts';
import { api, ApiError, onUnauthorized, setCsrfToken } from './api';

interface SessionState {
  user: SessionUser | null;
  unreadNotifications: number;
  loading: boolean;
  refresh: () => Promise<void>;
  setMe: (me: MeResponse) => void;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const setMe = useCallback((me: MeResponse) => {
    setCsrfToken(me.csrfToken);
    setUser(me.user);
    setUnread(me.unreadNotifications);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setMe(await api.get<MeResponse>('/auth/me'));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setUser(null);
    } finally {
      setLoading(false);
    }
  }, [setMe]);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
      setCsrfToken(null);
    }
  }, []);

  // Chargement initial : l'état n'est mis à jour que dans les callbacks de la requête.
  useEffect(() => {
    let cancelled = false;
    api.get<MeResponse>('/auth/me').then(
      (me) => {
        if (cancelled) return;
        setMe(me);
        setLoading(false);
      },
      () => {
        if (cancelled) return;
        setUser(null);
        setLoading(false);
      },
    );
    const unsubscribe = onUnauthorized(() => setUser(null));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [setMe]);

  const value = useMemo(
    () => ({ user, unreadNotifications: unread, loading, refresh, setMe, logout }),
    [user, unread, loading, refresh, setMe, logout],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession doit être utilisé dans <SessionProvider>');
  return context;
}

export const SPACE_HOME: Record<Space, string> = {
  company: '/entreprise',
  freelancer: '/freelance',
  admin: '/admin',
};
