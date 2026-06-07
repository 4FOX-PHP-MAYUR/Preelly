// Format price with currency
export const formatPrice = (price, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(price)
}

// Format date
export const formatDate = (date) => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date))
}

// Truncate text
export const truncate = (text, length = 100) => {
  if (text.length <= length) return text
  return text.slice(0, length) + '...'
}

// Validate email
export const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Validate phone
export const isValidPhone = (phone) => {
  return /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/.test(phone)
}

// Get file extension
export const getFileExtension = (filename) => {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2)
}

// Format file size
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

// Get full media URL
export const getMediaUrl = (path) => {
  if (!path) return null
  // If already a full URL, return as is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  const baseUrl =
    import.meta.env.VITE_SOCKET_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5002')
  // If path starts with /, use it directly, otherwise prepend /uploads
  const mediaPath = path.startsWith('/') ? path : `/uploads/${path}`
  return `${baseUrl}${mediaPath}`
}

/** Category image/icon path from API → absolute URL for <img src> */
export const getCategoryImageUrl = (category) => {
  const path = category?.image || category?.icon
  if (!path || typeof path !== 'string') return null
  return getMediaUrl(path) || path
}

// Validate MongoDB ObjectId (24 hex chars)
export const isValidObjectId = (id) => {
  return typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id)
}

// OTP verification — email + phone confirmed (required to post ads, etc.)
export const isUserVerified = (user) => {
  if (!user) return false
  return user.isVerified === true
}

// Emirates ID identity verification — separate trust badge on profile/listings
export const isIdentityVerified = (user) => {
  if (!user) return false
  return user.identityVerificationStatus === 'approved'
}

// Fisher–Yates shuffle (random order, in place then return copy for immutability)
export function shuffleArray(arr) {
  if (!Array.isArray(arr) || arr.length <= 1) return [...arr]
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
