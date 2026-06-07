import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { selectIsAuthenticated, selectUser } from '../../store/slices/authSlice'
import { getSocket } from '../../services/socket'
import { chatService } from '../../services/api'
import { useWebRTC } from './useWebRTC'
import { useRingtone } from './useRingtone'
import CallModal from './CallModal'

const CallContext = createContext(undefined)

// ── Browser notification helpers ──────────────────────────────────────────────
async function requestNotifPermission() {
  if (!('Notification' in window)) return
  if (Notification.permission === 'default') {
    await Notification.requestPermission()
  }
}

function showCallNotification(callerName, callType) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return null
  try {
    const notif = new Notification(
      `Incoming ${callType === 'video' ? 'Video' : 'Voice'} Call`,
      {
        body: `${callerName} is calling you`,
        icon: '/images/preelly-logo-blue.png',
        badge: '/images/preelly-logo-blue.png',
        tag: 'incoming-call',
        requireInteraction: true,
        silent: true, // we handle the audio ourselves
      },
    )
    notif.onclick = () => { window.focus(); notif.close() }
    return notif
  } catch { return null }
}

// callState: 'idle' | 'outgoing' | 'incoming' | 'active'
export function CallProvider({ children }) {
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const user            = useSelector(selectUser)
  const rtc             = useWebRTC()
  const ringtone        = useRingtone()

  const [callState,  setCallState]  = useState('idle')
  const [callType,   setCallType]   = useState('video')  // 'video' | 'audio'
  const [remoteUser, setRemoteUser] = useState(null)     // { id, name }
  const [threadId,   setThreadId]   = useState(null)

  // Refs so socket handlers always read fresh values without re-registering
  const callStateRef  = useRef(callState)
  const remoteUserRef = useRef(remoteUser)
  const threadIdRef   = useRef(threadId)
  const callTypeRef   = useRef(callType)
  const incomingOfferRef       = useRef(null)
  const pendingCandidatesRef   = useRef([])
  const notifRef               = useRef(null)   // active browser Notification
  const callStartTimeRef       = useRef(null)   // Date.now() when call became active

  useEffect(() => { callStateRef.current  = callState  }, [callState])
  useEffect(() => { remoteUserRef.current = remoteUser }, [remoteUser])
  useEffect(() => { threadIdRef.current   = threadId   }, [threadId])
  useEffect(() => { callTypeRef.current   = callType   }, [callType])

  // Track when call becomes active so we can compute duration
  useEffect(() => {
    if (callState === 'active') callStartTimeRef.current = Date.now()
  }, [callState])

  // Request notification permission once on mount
  useEffect(() => { requestNotifPermission() }, [])

  // Unlock Web Audio on first user gesture (browsers block audio until interaction)
  useEffect(() => {
    const unlock = () => {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        ctx.resume().then(() => ctx.close())
      } catch {}
      document.removeEventListener('click', unlock, true)
      document.removeEventListener('touchstart', unlock, true)
    }
    document.addEventListener('click', unlock, true)
    document.addEventListener('touchstart', unlock, true)
    return () => {
      document.removeEventListener('click', unlock, true)
      document.removeEventListener('touchstart', unlock, true)
    }
  }, [])

  const dismissNotif = useCallback(() => {
    try { notifRef.current?.close() } catch {}
    notifRef.current = null
  }, [])

  const saveEvent = useCallback((status) => {
    const tId = threadIdRef.current
    if (!tId) return
    const duration = callStartTimeRef.current
      ? Math.round((Date.now() - callStartTimeRef.current) / 1000)
      : 0
    chatService.saveCallEvent(tId, {
      callType: callTypeRef.current,
      status,
      duration,
    }).catch(() => {})
  }, [])

  const resetState = useCallback(() => {
    ringtone.stop()
    dismissNotif()
    rtc.cleanup()
    setCallState('idle')
    setRemoteUser(null)
    setThreadId(null)
    incomingOfferRef.current     = null
    pendingCandidatesRef.current = []
    callStartTimeRef.current     = null
  }, [rtc, ringtone, dismissNotif])

  // ── Socket signaling listeners ─────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return
    const socket = getSocket()

    // ─ Incoming call from remote ─
    const onIncoming = ({ from, fromName, threadId: tId, type, offer }) => {
      if (callStateRef.current !== 'idle') {
        socket.emit('call:reject', { to: from, threadId: tId })
        return
      }
      incomingOfferRef.current     = offer
      pendingCandidatesRef.current = []
      const callT = type || 'video'
      setCallType(callT)
      setRemoteUser({ id: from, name: fromName || 'Unknown' })
      setThreadId(tId)
      setCallState('incoming')

      // 🔔 Play ringtone
      ringtone.start('incoming')

      // 🔔 Browser notification (when tab is not focused)
      notifRef.current = showCallNotification(fromName || 'Unknown', callT)
    }

    // ─ Remote accepted our outgoing call ─
    const onAnswered = async ({ answer }) => {
      try {
        ringtone.stop()   // stop ringback tone
        await rtc.setRemoteAnswer(answer)
        setCallState('active')
        // Drain queued ICE candidates
        for (const c of pendingCandidatesRef.current) {
          await rtc.addIceCandidate(c)
        }
        pendingCandidatesRef.current = []
      } catch (e) {
        console.error('setRemoteAnswer error', e)
      }
    }

    // ─ ICE candidate from remote ─
    const onIce = async ({ candidate }) => {
      if (callStateRef.current === 'active') {
        await rtc.addIceCandidate(candidate)
      } else {
        pendingCandidatesRef.current.push(candidate)
      }
    }

    // ─ Remote ended the call ─ (they hung up; our endCall already saves on our side)
    const onEnd = () => resetState()

    // ─ Remote rejected our outgoing call ─
    const onRejected = () => {
      saveEvent('cancelled')
      resetState()
    }

    socket.on('call:incoming',     onIncoming)
    socket.on('call:answered',     onAnswered)
    socket.on('call:ice-candidate', onIce)
    socket.on('call:end',          onEnd)
    socket.on('call:rejected',     onRejected)

    return () => {
      socket.off('call:incoming',      onIncoming)
      socket.off('call:answered',      onAnswered)
      socket.off('call:ice-candidate', onIce)
      socket.off('call:end',           onEnd)
      socket.off('call:rejected',      onRejected)
    }
  }, [isAuthenticated, rtc, ringtone, resetState, saveEvent])

  // ── Start an outgoing call ─────────────────────────────────────────────────
  const startCall = useCallback(async (target, type = 'video', tId = null) => {
    if (callStateRef.current !== 'idle' || !target?.id) return
    const socket = getSocket()

    setCallType(type)
    setRemoteUser(target)
    setThreadId(tId)
    setCallState('outgoing')
    pendingCandidatesRef.current = []

    // 🔔 Play outgoing ringback tone
    ringtone.start('outgoing')

    try {
      await rtc.getLocalMedia(type === 'video')
      rtc.createPeerConnection(
        (candidate) => socket.emit('call:ice-candidate', { to: target.id, candidate }),
        () => {},
      )
      const offer = await rtc.createOffer()
      socket.emit('call:offer', {
        to: target.id,
        threadId: tId,
        type,
        offer,
        callerName: user?.displayName || user?.name || 'User',
      })
    } catch (e) {
      console.error('startCall error', e)
      resetState()
    }
  }, [rtc, ringtone, user, resetState])

  // ── Accept an incoming call ────────────────────────────────────────────────
  const acceptCall = useCallback(async () => {
    const offer  = incomingOfferRef.current
    const remote = remoteUserRef.current
    const tId    = threadIdRef.current
    const type   = callTypeRef.current
    if (!offer || !remote) return
    const socket = getSocket()

    // 🔔 Stop ring + dismiss notification
    ringtone.stop()
    dismissNotif()

    try {
      await rtc.getLocalMedia(type === 'video')
      rtc.createPeerConnection(
        (candidate) => socket.emit('call:ice-candidate', { to: remote.id, candidate }),
        () => {},
      )
      const answer = await rtc.createAnswer(offer)
      socket.emit('call:answer', { to: remote.id, threadId: tId, answer })
      setCallState('active')

      incomingOfferRef.current = null
      for (const c of pendingCandidatesRef.current) {
        await rtc.addIceCandidate(c)
      }
      pendingCandidatesRef.current = []
    } catch (e) {
      console.error('acceptCall error', e)
      resetState()
    }
  }, [rtc, ringtone, dismissNotif, resetState])

  // ── End / reject call ──────────────────────────────────────────────────────
  const endCall = useCallback(() => {
    const socket = getSocket()
    const remote = remoteUserRef.current
    const tId    = threadIdRef.current
    const state  = callStateRef.current
    if (remote?.id) socket.emit('call:end', { to: remote.id, threadId: tId })
    // Save completed call (or missed if we never connected)
    const status = state === 'active' ? 'completed' : 'missed'
    saveEvent(status)
    resetState()
  }, [resetState, saveEvent])

  const rejectCall = useCallback(() => {
    const socket = getSocket()
    const remote = remoteUserRef.current
    const tId    = threadIdRef.current
    if (remote?.id) socket.emit('call:reject', { to: remote.id, threadId: tId })
    saveEvent('rejected')
    resetState()
  }, [resetState, saveEvent])

  return (
    <CallContext.Provider value={{ startCall, callState }}>
      {children}

      {callState !== 'idle' && (
        <CallModal
          callState={callState}
          callType={callType}
          remoteUser={remoteUser}
          localStream={rtc.localStream}
          remoteStream={rtc.remoteStream}
          isMuted={rtc.isMuted}
          isVideoOff={rtc.isVideoOff}
          onAccept={acceptCall}
          onReject={rejectCall}
          onEnd={endCall}
          onToggleMute={rtc.toggleMute}
          onToggleVideo={rtc.toggleVideo}
        />
      )}
    </CallContext.Provider>
  )
}

export function useCall() {
  const ctx = useContext(CallContext)
  if (!ctx) throw new Error('useCall must be used within CallProvider')
  return ctx
}
