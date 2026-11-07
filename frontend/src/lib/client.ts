'use client';

/** Browser API client: same-origin /api proxy, cookie auth, CSRF header, one silent refresh on 401. */
export class ApiClientError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: { path: string; message: string }[]) {
    super(message);
  }
}

const readCookie = (name: string) =>
  typeof document === 'undefined' ? '' : document.cookie.split('; ').find((c) => c.startsWith(`${name}=`))?.split('=')[1] ?? '';

let refreshing: Promise<boolean> | null = null;
async function refreshSession(): Promise<boolean> {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'include', headers: { 'X-CSRF-Token': readCookie('csrf_token') } })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => { setTimeout(() => (refreshing = null), 0); });
  return refreshing;
}

export interface ApiOptions { method?: string; body?: unknown; form?: FormData; signal?: AbortSignal }
export interface Paged<T> { items: T[]; meta: { page?: number; limit?: number; total?: number; unread?: number } }

async function raw(path: string, o: ApiOptions = {}, retry = true): Promise<Response> {
  const method = o.method ?? (o.body || o.form ? 'POST' : 'GET');
  const headers: Record<string, string> = {};
  if (method !== 'GET') headers['X-CSRF-Token'] = readCookie('csrf_token');
  let body: BodyInit | undefined;
  if (o.form) body = o.form;
  else if (o.body !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(o.body); }
  const res = await fetch(`/api${path}`, { method, headers, body, credentials: 'include', signal: o.signal });
  if (res.status === 401 && retry && !path.startsWith('/auth/') && (await refreshSession())) return raw(path, o, false);
  return res;
}

export async function apiFull<T = unknown>(path: string, o: ApiOptions = {}): Promise<{ data: T; meta?: Paged<T>['meta'] }> {
  const res = await raw(path, o);
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    const e = json?.error;
    throw new ApiClientError(res.status, e?.code ?? 'ERROR', e?.message ?? `Request failed (${res.status})`, Array.isArray(e?.details) ? e.details : undefined);
  }
  return { data: json.data as T, meta: json.meta };
}

export const api = async <T = unknown>(path: string, o?: ApiOptions) => (await apiFull<T>(path, o)).data;

/** Downloads a binary/CSV/PDF endpoint through the authenticated session. */
export async function download(path: string, filename: string) {
  const res = await raw(path);
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new ApiClientError(res.status, j?.error?.code ?? 'ERROR', j?.error?.message ?? 'Download failed');
  }
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const errorMessage = (e: unknown) =>
  e instanceof ApiClientError ? (e.details?.length ? `${e.message}: ${e.details.map((d) => `${d.path} ${d.message}`).join('; ')}` : e.message) : e instanceof Error ? e.message : 'Something went wrong';
