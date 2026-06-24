import { useEffect, useRef } from 'react'
import {
  Mic, MicOff, Phone, PhoneOff, Video, VideoOff,
} from 'lucide-react'

function Avatar({ name = '?' }) {
  return (
    <div
      className="flex h-24 w-24 items-center justify-center rounded-full text-4xl font-bold text-white select-none"
      style={{ background: 'linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%)' }}
    >
      {(name?.[0] ?? '?').toUpperCase()}
    </div>
  )
}

function VideoEl({ stream, muted = false, className = '', mirror = false }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream
  }, [stream])
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={className}
      style={mirror ? { transform: 'scaleX(-1)' } : undefined}
    />
  )
}

function Btn({ onClick, label, color = 'gray', children }) {
  const base =
    'flex flex-col items-center gap-1.5 focus:outline-none select-none'
  const circle =
    `flex h-14 w-14 items-center justify-center rounded-full transition active:scale-95 ${
      color === 'green'  ? 'bg-green-500 hover:bg-green-600 text-white' :
      color === 'red'    ? 'bg-red-500   hover:bg-red-600   text-white' :
      color === 'white'  ? 'bg-white     hover:bg-slate-100 text-slate-700' :
                           'bg-white/20  hover:bg-white/30  text-white'
    }`
  return (
    <button type="button" onClick={onClick} className={base} aria-label={label}>
      <span className={circle}>{children}</span>
      <span className="text-[11px] font-medium text-white/80">{label}</span>
    </button>
  )
}

// ── Incoming call screen ──────────────────────────────────────────────────────
function IncomingScreen({ remoteUser, callType, onAccept, onReject }) {
  return (
    <div className="flex flex-col items-center justify-between h-full py-16 px-8">
      <div className="flex flex-col items-center gap-4">
        {/* Pulse rings */}
        <div className="relative flex items-center justify-center">
          <span className="absolute h-36 w-36 rounded-full bg-purple-400/20 animate-ping" />
          <span className="absolute h-28 w-28 rounded-full bg-purple-400/30 animate-ping [animation-delay:0.3s]" />
          <Avatar name={remoteUser?.name} />
        </div>
        <div className="text-center mt-4">
          <p className="text-2xl font-bold text-white">{remoteUser?.name || 'Unknown'}</p>
          <p className="mt-1 text-sm text-white/60">
            Incoming {callType === 'video' ? 'video' : 'voice'} call…
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-14">
        <Btn onClick={onReject} label="Decline" color="red">
          <PhoneOff className="h-6 w-6" />
        </Btn>
        <Btn onClick={onAccept} label="Accept" color="green">
          <Phone className="h-6 w-6" />
        </Btn>
      </div>
    </div>
  )
}

// ── Outgoing call screen ──────────────────────────────────────────────────────
function OutgoingScreen({ remoteUser, callType, onEnd }) {
  return (
    <div className="flex flex-col items-center justify-between h-full py-16 px-8">
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex items-center justify-center">
          <span className="absolute h-36 w-36 rounded-full bg-purple-400/20 animate-ping" />
          <Avatar name={remoteUser?.name} />
        </div>
        <div className="text-center mt-4">
          <p className="text-2xl font-bold text-white">{remoteUser?.name || 'Unknown'}</p>
          <p className="mt-1 text-sm text-white/60 flex items-center gap-1">
            {callType === 'video' ? 'Video calling' : 'Calling'}
            <span className="inline-flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1 w-1 rounded-full bg-white/60 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </span>
          </p>
        </div>
      </div>

      <Btn onClick={onEnd} label="End" color="red">
        <PhoneOff className="h-6 w-6" />
      </Btn>
    </div>
  )
}

// ── Active call screen ────────────────────────────────────────────────────────
function ActiveScreen({
  remoteUser, callType,
  localStream, remoteStream,
  isMuted, isVideoOff,
  onEnd, onToggleMute, onToggleVideo,
}) {
  const hasVideo = callType === 'video'

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* Remote video / avatar */}
      <div className="flex-1 bg-black flex items-center justify-center overflow-hidden">
        {remoteStream && hasVideo ? (
          <VideoEl
            stream={remoteStream}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-4">
            <Avatar name={remoteUser?.name} />
            <p className="text-white font-semibold text-lg">{remoteUser?.name}</p>
            <p className="text-white/50 text-sm">
              {hasVideo ? 'Camera off' : 'Voice call connected'}
            </p>
          </div>
        )}
      </div>

      {/* Local PiP (video call) */}
      {hasVideo && localStream && (
        <div className="absolute top-4 right-4 h-32 w-24 overflow-hidden rounded-2xl border-2 border-white/30 shadow-xl bg-black">
          {!isVideoOff ? (
            <VideoEl
              stream={localStream}
              muted
              mirror
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-800">
              <VideoOff className="h-6 w-6 text-white/40" />
            </div>
          )}
        </div>
      )}

      {/* Remote name badge */}
      <div className="absolute top-4 left-4 flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 backdrop-blur-sm">
        <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-sm font-medium text-white">{remoteUser?.name}</span>
      </div>

      {/* Controls */}
      <div className="shrink-0 flex items-center justify-center gap-6 bg-black/70 px-6 py-5 backdrop-blur-sm">
        <Btn onClick={onToggleMute} label={isMuted ? 'Unmute' : 'Mute'}>
          {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Btn>

        {hasVideo && (
          <Btn onClick={onToggleVideo} label={isVideoOff ? 'Cam on' : 'Cam off'}>
            {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </Btn>
        )}

        <Btn onClick={onEnd} label="End call" color="red">
          <PhoneOff className="h-6 w-6" />
        </Btn>
      </div>
    </div>
  )
}

// ── Root modal ────────────────────────────────────────────────────────────────
export default function CallModal({
  callState, callType, remoteUser,
  localStream, remoteStream,
  isMuted, isVideoOff,
  onAccept, onReject, onEnd,
  onToggleMute, onToggleVideo,
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

      {/* Card */}
      <div
        className="relative w-full max-w-sm mx-4 overflow-hidden rounded-3xl shadow-2xl"
        style={{
          background: 'linear-gradient(160deg,#1e1b4b 0%,#2d1b69 50%,#0f172a 100%)',
          height: callState === 'active' ? 520 : 480,
        }}
      >
        {callState === 'incoming' && (
          <IncomingScreen
            remoteUser={remoteUser}
            callType={callType}
            onAccept={onAccept}
            onReject={onReject}
          />
        )}
        {callState === 'outgoing' && (
          <OutgoingScreen
            remoteUser={remoteUser}
            callType={callType}
            onEnd={onEnd}
          />
        )}
        {callState === 'active' && (
          <ActiveScreen
            remoteUser={remoteUser}
            callType={callType}
            localStream={localStream}
            remoteStream={remoteStream}
            isMuted={isMuted}
            isVideoOff={isVideoOff}
            onEnd={onEnd}
            onToggleMute={onToggleMute}
            onToggleVideo={onToggleVideo}
          />
        )}
      </div>
    </div>
  )
}
