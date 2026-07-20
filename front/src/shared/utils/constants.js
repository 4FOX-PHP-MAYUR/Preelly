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
// dev-server origin. Set explicitly by vite.config.js (define) from api/.env's
// BACKEND_URL, so media URLs resolve correctly even outside the Vite dev proxy.
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || SOCKET_URL

// Admin panel runs on a separate Vite app (default localhost:8031 in dev)
export const ADMIN_URL = import.meta.env.VITE_ADMIN_URL || 'http://localhost:8031'
export const ADMIN_PANEL_URL = `${ADMIN_URL}/admin`

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

