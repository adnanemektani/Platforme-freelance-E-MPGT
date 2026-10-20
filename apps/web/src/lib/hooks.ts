'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from './api';
import { useToast } from '@/components/ui/toast';

export interface Resource<T> {
  data: T | undefined;
  error: ApiError | undefined;
  loading: boolean;
  reload: () => Promise<void>;
  setData: (value: T) => void;
}

function toApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError(0, 'Erreur inattendue');
}

interface State<T> {
  path: string | null;
  data?: T;
  error?: ApiError;
}

/** Chargement d'une ressource de l'API (null = ne rien charger). */
export function useApi<T>(path: string | null): Resource<T> {
  const [state, setState] = useState<State<T>>({ path: null });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    api.get<T>(path).then(
      (data) => {
        if (!cancelled) setState({ path, data });
      },
      (error: unknown) => {
        if (!cancelled) setState({ path, error: toApiError(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [path]);

  const reload = useCallback(async () => {
    if (!path) return;
    setRefreshing(true);
    try {
      const data = await api.get<T>(path);
      setState({ path, data });
    } catch (error) {
      setState((current) => ({ path, data: current.path === path ? current.data : undefined, error: toApiError(error) }));
    } finally {
      setRefreshing(false);
    }
  }, [path]);

  const setData = useCallback((value: T) => setState({ path, data: value }), [path]);
  const current = state.path === path;
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : undefined,
    loading: Boolean(path) && (!current || refreshing),
    reload,
    setData,
  };
}

/**
 * Action serveur (POST, PATCH…) avec état d'attente, message de confirmation et
 * affichage de l'erreur renvoyée par l'API (jamais de succès simulé côté interface).
 */
export function useAction() {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError>();

  const run = useCallback(
    async <T,>(fn: () => Promise<T>, options: { success?: string; silent?: boolean } = {}): Promise<T | undefined> => {
      setPending(true);
      setError(undefined);
      try {
        const result = await fn();
        if (options.success) toast.success(options.success);
        return result;
      } catch (e) {
        const err = toApiError(e);
        setError(err);
        if (!options.silent) toast.error(err.message, err.details);
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [toast],
  );

  return { run, pending, error, clearError: () => setError(undefined) };
}
