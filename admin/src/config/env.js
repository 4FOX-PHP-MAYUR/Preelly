// Admin runtime configuration — all values are sourced from the admin project's
// own `.env` file (Vite loads it via `envDir` in admin/vite.config.js).
//
// API base URL: in dev we prefer the Vite proxy (`/api`) so auth cookies and media
// share the admin dev-server origin (localhost:8031). A non-localhost value (e.g. the
// production API URL) is always honored as-is.
const envApi = import.meta.env.VITE_API_URL
export const API_URL =
  envApi && !String(envApi).includes('localhost:8029')
    ? envApi
    : import.meta.env.DEV
      ? '/api'
      : envApi || 'http://localhost:8029/api'
