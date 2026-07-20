import { io } from 'socket.io-client'
import { SOCKET_URL } from '../utils/constants'

let socket = null

export const getSocket = () => {
  if (!socket) {
    const token = localStorage.getItem('token')

    // Diagnostic: shows exactly where the socket is dialing. If this logs a
    // localhost URL while the page is on a remote host, the build is stale.
    console.log('🔌 Connecting socket to', SOCKET_URL, '(page:', typeof window !== 'undefined' ? window.location.origin : 'n/a', ')')

    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
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
