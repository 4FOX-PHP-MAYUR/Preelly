// API — in dev prefer Vite proxy (/api) so cookies and media share localhost:8031
const envApi = import.meta.env.VITE_API_URL
export const API_URL =
  envApi && !String(envApi).includes('localhost:8029')
    ? envApi
    : import.meta.env.DEV
      ? '/api'
      : envApi || 'http://localhost:8029/api'

/**
 * Absolute (or proxy-relative) URL for an API path — for full-page browser
 * navigations like OAuth start, where axios' baseURL doesn't apply. A hardcoded
 * "/api/..." here 404s on any deployment where the backend is mounted under a
 * sub-path (e.g. nginx /preelly-api) instead of the front's own origin.
 */
export const apiUrl = (path) =>
  `${String(API_URL).replace(/\/+$/, '')}/${String(path || '').replace(/^\/+/, '')}`

// Socket.IO — connect to the same origin the app is served from, so a reverse proxy
// forwards /socket.io to the backend exactly like it does /api. A VITE_SOCKET_URL
// pointing at localhost is only honored when the app itself runs on localhost; that
// way a dev value baked into a build (e.g. http://localhost:8029) doesn't break a
// remotely-hosted deployment by making every browser dial its OWN localhost.
const envSocket = import.meta.env.VITE_SOCKET_URL
const pageOrigin = typeof window !== 'undefined' ? window.location.origin : ''
const isLocalhost = (u) => /localhost|127\.0\.0\.1/.test(String(u || ''))
export const SOCKET_URL =
  envSocket && !(isLocalhost(envSocket) && pageOrigin && !isLocalhost(pageOrigin))
    ? envSocket
    : pageOrigin || 'http://localhost:8029'

// Absolute API/media origin — always the real backend, never the front's own
// dev-server origin. Comes from front/.env's VITE_BACKEND_URL (vite.config.js reads
// env from this folder only), so media URLs resolve correctly even outside the dev proxy.
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || SOCKET_URL

// Admin panel runs on a separate Vite app (default localhost:8031 in dev).
// Vite base is /admin/ — trailing slash is required in both origin and path forms.
export const ADMIN_URL = import.meta.env.VITE_ADMIN_URL || 'http://localhost:8031'
export const ADMIN_PANEL_URL = /\/admin\/?$/.test(ADMIN_URL)
  ? ADMIN_URL.replace(/\/?$/, '/')
  : `${ADMIN_URL.replace(/\/$/, '')}/admin/`

// Public base URL this app is served from — used to resolve bundled assets in
// public/images. VITE_SITE_URL from .env wins; otherwise the app's own Vite base is
// used, which is '/' for the front app and '/admin/' for the admin app. Without this,
// a root-relative "/images/x.png" 404s inside admin, whose base is /admin/.
export const SITE_URL =
  import.meta.env.VITE_SITE_URL || import.meta.env.BASE_URL || '/'

/** public/ asset path → URL that resolves under this app's base. */
export const assetUrl = (path) =>
  `${String(SITE_URL).replace(/\/+$/, '')}/${String(path || '').replace(/^\/+/, '')}`

// Mileage slider scale for the Kilometres filter, on both the listing page and
// advance search. Fixed rather than derived from the listing facets so the scale
// does not shift as inventory changes: 0 – 7 lakh km. A range left untouched is
// treated as "no filter", so listings above the top of the scale are not hidden.
export const KMS_FILTER_RANGE = { min: 0, max: 700000 }

// Sign in with Apple — WEB only. This is the web Services ID, matching the API's
// APPLE_WEB_CLIENT_ID (not the mobile app's Apple identifiers, which the browser
// must never use: Apple mints a browser token for the Services ID and the web route
// accepts nothing else). Public by design — it travels in the Apple auth URL; the
// private .p8 signing key stays on the server.
export const APPLE_WEB_CLIENT_ID = String(import.meta.env.VITE_APPLE_WEB_CLIENT_ID || '').trim()

// Return URL registered for this domain under that Services ID. Apple validates it
// even in popup mode (and only accepts https on a verified domain), so it must be
// set per environment rather than derived from window.location — no default here
// means "Apple sign in is off for this build", which is the correct state for
// localhost, where Apple refuses to register a domain at all.
export const APPLE_WEB_REDIRECT_URI = String(import.meta.env.VITE_APPLE_WEB_REDIRECT_URI || '').trim()

// Apple releases name + email only on the first authorization; requesting them
// again on later logins is harmless and returns nothing.
export const APPLE_WEB_SCOPE = 'name email'

// Product Conditions
export const PRODUCT_CONDITIONS = [
  'New',
  'Like New',
  'Good',
  'Fair',
  'Poor',
]

// File Upload Limits
export const MAX_VIDEO_SIZE = 500 * 1024 * 1024 // 500MB (increased from 50MB)
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB (increased from 5MB)
export const MAX_IMAGES = 20
export const MIN_IMAGES = 1

// Pagination
export const DEFAULT_PAGE_SIZE = 10

// Video Player Settings
export const VIDEO_AUTOPLAY = true
export const VIDEO_LOOP = true
export const VIDEO_MUTED = true

