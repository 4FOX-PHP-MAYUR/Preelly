// API — in dev prefer Vite proxy (/api) so cookies and media share localhost:3002
const envApi = import.meta.env.VITE_API_URL
export const API_URL =
  envApi && !String(envApi).includes('localhost:5002')
    ? envApi
    : import.meta.env.DEV
      ? '/api'
      : envApi || 'http://localhost:5002/api'

export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5002')

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

