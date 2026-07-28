import { io } from 'socket.io-client'
import { SOCKET_URL, BACKEND_URL } from '../utils/constants'

let socket = null

/**
 * Split the backend target into a connection origin + engine.io `path`.
 *
 * socket.io-client interprets any path segment in the connection URL as a
 * NAMESPACE, not a mount path — so `io('https://host/preelly-api')` connects to
 * the "/preelly-api" namespace and still requests "/socket.io" at the root, which
 * a reverse proxy mounting the backend under /preelly-api never forwards. The fix
 * (per the working reference) is to connect to the ORIGIN and pass the sub-path
 * via `path`, e.g. io('https://beta.preelly.xyz', { path: '/preelly-api/socket.io' }).
 *
 * We derive the sub-path from SOCKET_URL, falling back to BACKEND_URL's path when
 * SOCKET_URL has none (e.g. it resolved to the bare page origin). In dev both
 * resolve to http://localhost:8029 with no sub-path → path '/socket.io'.
 */
function resolveSocketTarget() {
  const fallbackOrigin = typeof window !== 'undefined' ? window.location.origin : undefined
  try {
    const u = new URL(SOCKET_URL, fallbackOrigin)
    let base = u.pathname.replace(/\/+$/, '') // '' or e.g. '/preelly-api'
    if (!base && BACKEND_URL) {
      try { base = new URL(BACKEND_URL, u.origin).pathname.replace(/\/+$/, '') } catch { /* ignore */ }
    }
    return { url: u.origin, path: `${base}/socket.io` }
  } catch {
    return { url: SOCKET_URL, path: '/socket.io' }
  }
}

export const getSocket = () => {
  if (!socket) {
    const token = localStorage.getItem('token')
    const { url, path } = resolveSocketTarget()

    // Diagnostic: shows exactly where the socket is dialing (origin + engine path).
    console.log('🔌 Connecting socket to', url, 'path=', path, '(page:', typeof window !== 'undefined' ? window.location.origin : 'n/a', ')')

    socket = io(url, {
      // Mount engine.io at the backend's sub-path (nginx /preelly-api) instead of
      // letting the URL path become a namespace.
      path,
      // Polling first: connects even when the proxy lacks WebSocket upgrade headers,
      // then transparently upgrades to websocket once it succeeds.
      transports: ['polling', 'websocket'],
      upgrade: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
      reconnectionDelayMax: 5000,
      auth: token ? { token } : {},
    })

    socket.on('connect', () => {
      console.log('🔌 Socket connected:', socket.id)
      // Re-join user room on reconnect if we have userId stored
      const userId = socket.userId
      if (userId) {
        socket.emit('join-user', userId)
      }
    })

    socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason)
    })

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message)
    })

    socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Socket reconnected after', attemptNumber, 'attempts')
      const userId = socket.userId
      if (userId) {
        socket.emit('join-user', userId)
      }
    })
  }

  return socket
}

export const setSocketUserId = (userId) => {
  if (socket) {
    socket.userId = userId
  }
}

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
    console.log('🔌 Socket disconnected and cleaned up')
  }
}

export default getSocket
