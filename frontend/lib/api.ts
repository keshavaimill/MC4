import axios from 'axios';

/**
 * Base URL for API requests. Set NEXT_PUBLIC_API_BASE_URL in production
 * when the backend is on a different host (e.g. https://api.example.com).
 * When unset, requests are same-origin (/api/*) and rely on Next rewrites or reverse proxy.
 */
const baseURL =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_BASE_URL
    ? process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, '') // strip trailing slash
    : '';

export const api = axios.create({
  baseURL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});
