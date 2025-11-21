import { fetchUtils } from 'react-admin';

export const API_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3000/api';

const normalizeBearerPrefix = (token: string) => {
  if (!token?.trim()) {
    return '';
  }
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
};

const resolveJwtToken = () => {
  const envToken = import.meta.env.VITE_JWT_TOKEN?.trim();
  if (envToken) {
    return envToken;
  }

  if (typeof window === 'undefined') {
    return '';
  }

  try {
    const storedToken =
      window.localStorage.getItem('authToken') ??
      window.sessionStorage.getItem('authToken');
    return storedToken ?? '';
  } catch (error) {
    console.warn('Unable to read auth token from storage:', error);
    return '';
  }
};

export const httpClient = (
  url: string,
  options: fetchUtils.Options = {},
) => {
  const opts = {
    ...options,
    headers: new Headers(options.headers || { Accept: 'application/json' }),
  };

  if (!opts.headers.has('Content-Type') && opts.method && opts.method !== 'GET') {
    opts.headers.set('Content-Type', 'application/json');
  }

  const token = resolveJwtToken();
  if (token) {
    opts.headers.set('Authorization', normalizeBearerPrefix(token));
  }

  return fetchUtils.fetchJson(url, opts);
};

export const buildQueryString = (params: Record<string, string | number>) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      qs.set(key, String(value));
    }
  });
  const query = qs.toString();
  return query ? `?${query}` : '';
};

