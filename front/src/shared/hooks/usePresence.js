import { useEffect, useMemo, useState } from 'react'
import { getSocket } from '../services/socket'

/**
 * Live online/offline state for a set of user ids, backed by the socket presence
 * rooms in api/server.js.
 *
 * Returns a map of { [userId]: boolean }. Ids the server has not reported on are
 * simply absent — callers must treat "unknown" as offline rather than showing a
 * user as active on a guess.
 *
 * Subscriptions are not released on unmount: presence rooms are per-socket, so a
 * component leaving would otherwise unsubscribe a sibling still watching the same
 * user. The rooms are cheap, bounded by how many distinct people you open a chat
 * with in one session, and cleared by the server on disconnect.
 */
export default function usePresence(userIds) {
  // Join to a primitive so a fresh array literal each render doesn't resubscribe.
  const key = useMemo(() => {
    const list = Array.isArray(userIds) ? userIds : [userIds]
    return [...new Set(list.filter(Boolean).map(String))].sort().join(',')
  }, [userIds])

  const [online, setOnline] = useState({})

  useEffect(() => {
    if (!key) {
      setOnline({})
      return undefined
    }

    const ids = key.split(',')
    const socket = getSocket()
    let cancelled = false

    const subscribe = () => {
      socket.emit('presence:watch', ids, (snapshot) => {
        if (!cancelled && snapshot) setOnline(snapshot)
      })
    }

    const onChanged = ({ userId, online: isOnline }) => {
      if (cancelled || !userId) return
      setOnline((prev) => ({ ...prev, [String(userId)]: Boolean(isOnline) }))
    }

    socket.on('presence:changed', onChanged)
    // Re-subscribe after a reconnect — room membership dies with the old socket.
    socket.on('connect', subscribe)
    if (socket.connected) subscribe()

    return () => {
      cancelled = true
      socket.off('presence:changed', onChanged)
      socket.off('connect', subscribe)
    }
  }, [key])

  return online
}
