'use client';

import type { ApiErrorBody } from '@empgt/contracts';

// Client HTTP du navigateur : même origine (/api/v1), cookie de session HttpOnly,
// jeton CSRF transmis dans l'en-tête X-CSRF-Token pour toute requête modifiante.

export const API_BASE = '/api/v1';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details: string[] = [],
    readonly requestId?: string,
  ) {
    super(message);
  }
}

let csrfToken: string | null = null;
let csrfPromise: Promise<string> | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

async function ensureCsrf(): Promise<string> {
  if (csrfToken) return csrfToken;
  csrfPromise ??= fetch(`${API_BASE}/auth/csrf`, { credentials: 'same-origin', cache: 'no-store' })
    .then((r) => r.json() as Promise<{ csrfToken: string }>)
    .then((body) => {
      csrfToken = body.csrfToken;
      return body.csrfToken;
    })
    .finally(() => {
      csrfPromise = null;
    });
  return csrfPromise;
}

type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();
export function onUnauthorized(listener: Listener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

async function parse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const type = response.headers.get('content-type') ?? '';
  const body = type.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const error = (typeof body === 'object' ? body : { message: body }) as Partial<ApiErrorBody>;
    if (response.status === 401) unauthorizedListeners.forEach((l) => l());
    if (response.status === 403 && /CSRF/.test(error.message ?? '')) csrfToken = null;
    throw new ApiError(
      response.status,
      error.message || (response.status >= 500 ? 'Une erreur interne est survenue. Réessayez plus tard.' : 'La requête a échoué.'),
      error.details ?? [],
      error.requestId,
    );
  }
  return body as T;
}

async function request<T>(method: string, path: string, body?: unknown, retried = false): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (method !== 'GET') headers['x-csrf-token'] = await ensureCsrf();
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { method, headers, body: payload, credentials: 'same-origin', cache: 'no-store' });
  } catch {
    throw new ApiError(0, 'Connexion au serveur impossible. Vérifiez votre réseau puis réessayez.');
  }
  // Jeton CSRF expiré : un seul nouvel essai avec un jeton frais.
  if (response.status === 403 && method !== 'GET' && !retried) {
    const clone = response.clone();
    const text = await clone.text();
    if (text.includes('CSRF')) {
      csrfToken = null;
      return request<T>(method, path, body, true);
    }
  }
  return parse<T>(response);
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown = {}) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown = {}) => request<T>('PATCH', path, body),
  put: <T>(path: string, body: unknown = {}) => request<T>('PUT', path, body),
  delete: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
  /** Envoi multipart (fichier « file » + champs texte). */
  upload: <T>(path: string, file: File | null, fields: Record<string, string | number | null | undefined>) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      if (value !== null && value !== undefined && value !== '') form.append(key, String(value));
    }
    if (file) form.append('file', file);
    return request<T>('POST', path, form);
  },
};

/** URL de téléchargement d'un document (le contrôle d'accès est fait par l'API). */
export function documentUrl(id: string, inline = false): string {
  return `${API_BASE}/documents/${id}/download${inline ? '?inline=true' : ''}`;
}

/** Construit une chaîne de requête en ignorant les valeurs vides. */
export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}
