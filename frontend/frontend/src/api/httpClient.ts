import { fetchUtils } from 'react-admin';

export const API_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';

// JWT token for system authentication (configured via environment variable)
const JWT_TOKEN = import.meta.env.VITE_JWT_TOKEN || '';

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

  // Add JWT token to Authorization header for system authentication
  if (JWT_TOKEN) {
    opts.headers.set('Authorization', `Bearer ${JWT_TOKEN}`);
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

