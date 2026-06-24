import { useCallback, useRef } from 'react'

// Classic dual-tone phone ring using Web Audio API — no file needed.
// incoming: 480 Hz + 620 Hz (US telephone standard)
// outgoing: 440 Hz + 480 Hz (ringback tone)
const TONES = {
  incoming: [480, 620],
  outgoing: [440, 480],
}

// on/off cadence in ms
const CADENCE = {
  incoming: { on: 2000, off: 1000 },
  outgoing: { on: 1000, off: 2000 },
}

export function useRingtone() {
  const ctxRef    = useRef(null)
  const activeRef = useRef([])   // { oscs, gain }[]
  const timerRef  = useRef(null)

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume()
    return ctxRef.current
  }, [])

  const stopAll = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    activeRef.current.forEach(({ oscs, gain }) => {
      oscs.forEach(o => { try { o.stop() } catch {} })
      try { gain.disconnect() } catch {}
    })
    activeRef.current = []
  }, [])

  const playBurst = useCallback((type) => {
    try {
      const ctx  = getCtx()
      const gain = ctx.createGain()
      gain.connect(ctx.destination)
      gain.gain.value = 0

      const oscs = TONES[type].map(freq => {
        const o = ctx.createOscillator()
        o.type = 'sine'
        o.frequency.value = freq
        o.connect(gain)
        o.start()
        return o
      })

      const duration = CADENCE[type].on / 1000
      const now = ctx.currentTime
      // soft fade-in / fade-out to avoid clicks
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.25, now + 0.05)
      gain.gain.setValueAtTime(0.25, now + duration - 0.05)
      gain.gain.linearRampToValueAtTime(0, now + duration)

      const entry = { oscs, gain }
      activeRef.current.push(entry)

      setTimeout(() => {
        oscs.forEach(o => { try { o.stop() } catch {} })
        try { gain.disconnect() } catch {}
        activeRef.current = activeRef.current.filter(e => e !== entry)
      }, CADENCE[type].on + 100)
    } catch { /* ignore — AudioContext may be blocked until interaction */ }
  }, [getCtx])

  const start = useCallback((type = 'incoming') => {
    stopAll()
    playBurst(type)
    const cycle = CADENCE[type].on + CADENCE[type].off
    timerRef.current = setInterval(() => playBurst(type), cycle)
  }, [playBurst, stopAll])

  return { start, stop: stopAll }
}
