'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface Toast {
  id: number;
  tone: 'success' | 'error' | 'info';
  message: string;
  details?: string[];
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string, details?: string[]) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list, { ...toast, id }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), toast.tone === 'error' ? 9000 : 5000);
  }, []);
  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push({ tone: 'success', message }),
      error: (message, details) => push({ tone: 'error', message, details }),
      info: (message) => push({ tone: 'info', message }),
    }),
    [push],
  );
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto rounded-md border px-4 py-3 text-sm shadow-lg ${
              t.tone === 'success' ? 'border-accent-100 bg-accent-50 text-accent-800' : t.tone === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-brand-200 bg-white text-brand-900'
            }`}
          >
            <p className="font-medium">{t.message}</p>
            {t.details && t.details.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-xs">
                {t.details.slice(0, 6).map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
            <button type="button" className="mt-1 text-xs underline" onClick={() => setToasts((list) => list.filter((x) => x.id !== t.id))}>
              Fermer
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast doit être utilisé dans <ToastProvider>');
  return context;
}
