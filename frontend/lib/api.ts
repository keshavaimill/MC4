import axios from 'axios';

/**
 * Base URL for API requests. Set VITE_API_BASE_URL in production
 * when the backend is on a different host (e.g. https://api.example.com).
 * When unset, requests are same-origin (/api/*) and rely on reverse proxy.
 */
const baseURL = "https://mc4-forecasting-backend-hne0aufgdqdhf6a4.westus2-01.azurewebsites.net/";

export const api = axios.create({
  baseURL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});
