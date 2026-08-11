// API — in dev prefer Vite proxy (/api) so cookies and media share localhost:8031
const envApi = import.meta.env.VITE_API_URL
export const API_URL =
  envApi && !String(envApi).includes('localhost:8029')
    ? envApi
    : import.meta.env.DEV
      ? '/api'
      : envApi || 'http://localhost:8029/api'

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

