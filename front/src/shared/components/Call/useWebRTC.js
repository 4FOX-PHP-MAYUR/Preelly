import { useCallback, useRef, useState } from 'react'

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
]

export function useWebRTC() {
  const pcRef             = useRef(null)
  const localStreamRef    = useRef(null)
  const [localStream,  setLocalStream]  = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [isMuted,      setIsMuted]      = useState(false)
  const [isVideoOff,   setIsVideoOff]   = useState(false)

  const getLocalMedia = useCallback(async (withVideo = true) => {
    // Release any previous stream
    localStreamRef.current?.getTracks().forEach((t) => t.stop())

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: withVideo ? { width: 640, height: 480, facingMode: 'user' } : false,
      })
    } catch {
      if (withVideo) {
        // Camera denied → fall back to audio-only
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } else {
        throw new Error('Microphone access denied')
      }
    }

    localStreamRef.current = stream
    setLocalStream(stream)
    setIsMuted(false)
    setIsVideoOff(!stream.getVideoTracks().length)
    return stream
  }, [])

  const createPeerConnection = useCallback((onIceCandidate, onRemoteStream) => {
    pcRef.current?.close()

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    pc.onicecandidate = (e) => {
      if (e.candidate) onIceCandidate(e.candidate)
    }

    pc.ontrack = (e) => {
      const [stream] = e.streams
      if (stream) {
        setRemoteStream(stream)
        onRemoteStream(stream)
      }
    }

    // Add local tracks to the connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) =>
        pc.addTrack(track, localStreamRef.current),
      )
    }

    pcRef.current = pc
    return pc
  }, [])

  const createOffer = useCallback(async () => {
    const offer = await pcRef.current.createOffer()
    await pcRef.current.setLocalDescription(offer)
    return offer
  }, [])

  const createAnswer = useCallback(async (offer) => {
    await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer))
    const answer = await pcRef.current.createAnswer()
    await pcRef.current.setLocalDescription(answer)
    return answer
  }, [])

  const setRemoteAnswer = useCallback(async (answer) => {
    if (pcRef.current?.signalingState === 'have-local-offer') {
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer))
    }
  }, [])

  const addIceCandidate = useCallback(async (candidate) => {
    try {
      if (pcRef.current?.remoteDescription) {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate))
      }
    } catch { /* ignore stale candidates */ }
  }, [])

  const toggleMute = useCallback(() => {
    const tracks = localStreamRef.current?.getAudioTracks() ?? []
    const nextEnabled = tracks.some((t) => !t.enabled)
    tracks.forEach((t) => { t.enabled = nextEnabled })
    setIsMuted(!nextEnabled)
    return !nextEnabled
  }, [])

  const toggleVideo = useCallback(() => {
    const tracks = localStreamRef.current?.getVideoTracks() ?? []
    const nextEnabled = tracks.some((t) => !t.enabled)
    tracks.forEach((t) => { t.enabled = nextEnabled })
    setIsVideoOff(!nextEnabled)
    return !nextEnabled
  }, [])

  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    pcRef.current?.close()
    pcRef.current        = null
    localStreamRef.current = null
    setLocalStream(null)
    setRemoteStream(null)
    setIsMuted(false)
    setIsVideoOff(false)
  }, [])

  return {
    localStream, remoteStream, isMuted, isVideoOff,
    getLocalMedia, createPeerConnection,
    createOffer, createAnswer, setRemoteAnswer,
    addIceCandidate, toggleMute, toggleVideo, cleanup,
  }
}
