import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  ArrowLeft, Bookmark, Briefcase, Building2, Car, Check, CheckCheck,
  FileText, Image as ImageIcon, LayoutGrid, MessageCircle, Mic, Paperclip, Phone, Plus,
  Search, Send, Settings, Shirt, Smartphone, Sofa, Square, Video, X,
} from 'lucide-react'
import { selectUser, selectIsAuthenticated } from '@shared/store/slices/authSlice'
import { fetchRootCategories } from '@shared/store/slices/categorySlice'
import BrandLogo from '@shared/components/BrandLogo'
import MarketplaceTopBar from '../components/Layout/MarketplaceTopBar'
import MarketplaceLogoBlock from '../components/Layout/MarketplaceLogoBlock'
import { MARKETPLACE_LOGO_CELL } from '../components/Layout/marketplaceLayoutStyles'
import { cartService } from '@shared/services/api'
import { useChat } from '@shared/components/Chat/ChatContext'
import { useCall } from '@shared/components/Call/CallContext'
import { getMediaUrl } from '@shared/utils/helpers'
import toast from 'react-hot-toast'

// ─────────────────────────────────────────────────────────────────────────────
const TABS = ['All', 'Buying', 'Selling', 'Unread']

const QUICK_REPLIES = [
  'Hello',
  'Is it available',
  'when can i call you?',
  'what is your location',
  'what is the final price?',
  'Make an offer',
]

// ── helpers ───────────────────────────────────────────────────────────────────
function fmtTime(val) {
  if (!val) return ''
  const d   = new Date(val)
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diff === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diff === 1) return 'Yesterday'
  if (diff < 7)   return `${diff} Days Ago`
  return d.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtMsgTime(val) {
  if (!val) return ''
  return new Date(val).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function dayLabel(dateStr) {
  const d   = new Date(dateStr)
  const now = new Date()
  const yest = new Date(now); yest.setDate(now.getDate() - 1)
  if (d.toDateString() === now.toDateString())  return 'Today'
  if (d.toDateString() === yest.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function groupMsgs(messages) {
  const out = []; let lastDay = ''
  for (const m of messages) {
    const day = new Date(m.createdAt).toDateString()
    if (day !== lastDay) { lastDay = day; out.push({ label: dayLabel(m.createdAt), msgs: [] }) }
    out[out.length - 1].msgs.push(m)
  }
  return out
}

function safeUrl(src) {
  if (!src) return null
  return typeof src === 'string' && src.startsWith('http') ? src : getMediaUrl(src)
}

function fmtCompactCount(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return String(n)
}

const categoryIconMap = [
  { pattern: /\b(motor|vehicle|car|auto)\b/i,               icon: Car },
  { pattern: /\b(property|real estate|villa|apartment|home)\b/i, icon: Building2 },
  { pattern: /\b(job|career|work)\b/i,                      icon: Briefcase },
  { pattern: /\b(fashion|clothing|accessories)\b/i,          icon: Shirt },
  { pattern: /\b(furniture|garden|home decor)\b/i,           icon: Sofa },
  { pattern: /\b(electronics|mobile|phone|laptop|gaming)\b/i, icon: Smartphone },
]
function getCategoryIcon(name) {
  return categoryIconMap.find(({ pattern }) => pattern.test(name || ''))?.icon ?? LayoutGrid
}

// ── Call duration formatter ───────────────────────────────────────────────────
function fmtDuration(secs) {
  if (!secs || secs <= 0) return ''
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
}

// ── Call message bubble ───────────────────────────────────────────────────────
function CallBubble({ message, isSelf }) {
  const { callMeta } = message
  const isVideo  = callMeta?.callType === 'video'
  const status   = callMeta?.status
  const duration = callMeta?.duration || 0
  const missed   = status === 'missed' || status === 'rejected' || status === 'cancelled'

  const label = {
    completed: `${isVideo ? 'Video' : 'Voice'} call${fmtDuration(duration) ? ` · ${fmtDuration(duration)}` : ''}`,
    missed:    `Missed ${isVideo ? 'video' : 'voice'} call`,
    rejected:  `Declined ${isVideo ? 'video' : 'voice'} call`,
    cancelled: `Cancelled ${isVideo ? 'video' : 'voice'} call`,
  }[status] ?? (isVideo ? 'Video call' : 'Voice call')

  return (
    <div className={`inline-flex items-center gap-3 px-4 py-2.5 rounded-2xl border shadow-sm ${
      isSelf ? 'rounded-br-sm' : 'rounded-bl-sm'
    } bg-white border-gray-200`}>
      <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center ${
        missed ? 'bg-red-100' : 'bg-green-100'
      }`}>
        {isVideo
          ? <Video className={`h-4 w-4 ${missed ? 'text-red-500' : 'text-green-600'}`} />
          : <Phone className={`h-4 w-4 ${missed ? 'text-red-500' : 'text-green-600'}`} />
        }
      </div>
      <span className={`text-sm font-medium ${missed ? 'text-red-600' : 'text-gray-800'}`}>
        {label}
      </span>
    </div>
  )
}

// ── Offer message ─────────────────────────────────────────────────────────────
// Offers are sent as plain text `💰 Offer: AED 55,000` so they persist and sync
// like any message; here we detect that shape and render the negotiation card.
const OFFER_RE = /^💰\s*Offer:\s*AED\s*([\d,.]+)/
export function parseOfferAmount(text) {
  const m = OFFER_RE.exec(String(text || '').trim())
  return m ? m[1] : null
}

function OfferBubble({ amount, isSelf, senderName, senderAvatar, onAccept, onReject, onCounter }) {
  const [counter, setCounter] = useState('')
  const [done, setDone] = useState(null) // 'accepted' | 'rejected' | 'countered'

  // The person who made the offer sees a compact read-only summary.
  if (isSelf) {
    return (
      <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl rounded-br-sm border border-violet-200 bg-violet-50 shadow-sm">
        <span className="text-sm text-gray-700">You offered</span>
        <span className="text-sm font-bold text-violet-700">AED {amount}</span>
      </div>
    )
  }

  const submitCounter = () => {
    const val = Number(String(counter).replace(/[^0-9.]/g, ''))
    if (!val || val <= 0) { toast.error('Enter a valid counter offer'); return }
    onCounter(val)
    setDone('countered')
  }

  return (
    <div className="w-[300px] max-w-full rounded-2xl rounded-bl-sm border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 pt-3 pb-2 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-500">Offer For Your Ad</p>
        <div className="flex items-center gap-2 mt-2">
          <Ava src={senderAvatar} name={senderName} size={28} />
          <span className="text-sm font-medium text-gray-800">{senderName || 'Buyer'}</span>
        </div>
      </div>

      <div className="px-4 py-3">
        <p className="text-sm text-gray-700">
          You have got an offer of{' '}
          <span className="font-bold text-blue-600">AED {amount}</span>
        </p>

        {done === 'accepted' ? (
          <p className="mt-3 text-sm font-medium text-green-600">You accepted this offer</p>
        ) : done === 'rejected' ? (
          <p className="mt-3 text-sm font-medium text-red-500">You rejected this offer</p>
        ) : done === 'countered' ? (
          <p className="mt-3 text-sm font-medium text-violet-600">Counter offer sent</p>
        ) : (
          <>
            <input
              type="text"
              inputMode="numeric"
              value={counter}
              onChange={e => setCounter(e.target.value)}
              placeholder="Enter your counter offer"
              className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
            <button
              type="button"
              onClick={() => { onAccept(); setDone('accepted') }}
              className="mt-3 w-full rounded-lg bg-green-600 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              Accept
            </button>
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => { onReject(); setDone('rejected') }}
                className="flex-1 rounded-lg bg-violet-100 py-2 text-sm font-medium text-violet-700 hover:bg-violet-200"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={submitCounter}
                className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Send Counter offer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Ava({ src, name = '?', size = 40, online = false }) {
  const s = size
  return (
    <div className="relative shrink-0" style={{ width: s, height: s }}>
      {src ? (
        <img src={safeUrl(src)} alt={name}
          className="rounded-full object-cover w-full h-full" />
      ) : (
        <div
          className="rounded-full flex items-center justify-center text-white font-bold select-none"
          style={{
            width: s, height: s, fontSize: Math.round(s * 0.38),
            background: 'linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%)',
          }}
        >
          {(name?.[0] ?? '?').toUpperCase()}
        </div>
      )}
      {online && (
        <span
          className="absolute rounded-full bg-green-500 border-2 border-white"
          style={{ width: Math.max(8, s * 0.24), height: Math.max(8, s * 0.24), bottom: 0, right: 0 }}
        />
      )}
    </div>
  )
}

// ── Attachment grid (WhatsApp-style) ─────────────────────────────────────────
async function openWithApp(fileUrl, name) {
  try {
    const res = await fetch(fileUrl)
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const el = document.createElement('a')
    el.href = blobUrl
    el.download = name || 'file'
    document.body.appendChild(el)
    el.click()
    document.body.removeChild(el)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000)
  } catch {
    // fallback: let browser decide
    const el = document.createElement('a')
    el.href = fileUrl
    el.download = name || 'file'
    el.click()
  }
}

function AttachGrid({ attachments, isTemp }) {
  const imgs = attachments.filter(a => a.mimeType?.startsWith('image/'))
  const auds = attachments.filter(a => a.mimeType?.startsWith('audio/'))
  const docs = attachments.filter(a => !a.mimeType?.startsWith('image/') && !a.mimeType?.startsWith('audio/'))
  const MAX = 4
  const extra = Math.max(0, imgs.length - MAX)
  const shown = imgs.slice(0, MAX)
  const url = (a) => a._local ? a.url : getMediaUrl(a.url)

  const handleClick = (a) => {
    if (a._local) return // temp preview — not yet uploaded
    openWithApp(url(a), a.name)
  }

  const gridStyle = {
    display: 'grid',
    gap: 2,
    width: 244,
    gridTemplateColumns: shown.length === 1 ? '1fr' : '1fr 1fr',
  }
  const cellH = shown.length === 1 ? 220 : 120

  return (
    <div className={isTemp ? 'opacity-60' : ''}>
      {shown.length > 0 && (
        <div style={gridStyle} className="overflow-hidden rounded-2xl">
          {shown.map((a, i) => {
            const isLast = i === shown.length - 1 && extra > 0
            const spanRow = shown.length === 3 && i === 0
            return (
              <div key={i} style={{ gridRow: spanRow ? 'span 2' : undefined, position: 'relative' }}>
                <button onClick={() => handleClick(a)} className="block w-full focus:outline-none" style={{ cursor: a._local ? 'default' : 'pointer' }}>
                  <img src={url(a)} alt={a.name}
                    style={{ width: '100%', height: spanRow ? 242 : cellH, objectFit: 'cover', display: 'block' }} />
                </button>
                {isLast && (
                  <div onClick={() => handleClick(a)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.52)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <span style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>+{extra}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {auds.map((a, i) => (
        <div key={i} className="px-3 py-2.5 bg-white">
          <audio controls src={url(a)} className="max-w-[240px] h-10" style={{ colorScheme: 'light' }} />
        </div>
      ))}
      {docs.map((a, i) => (
        <button key={i} onClick={() => handleClick(a)}
          className="flex w-full items-center gap-2 px-4 py-3 bg-white hover:bg-gray-50 transition-colors">
          <FileText className="h-5 w-5 text-purple-500 shrink-0" />
          <span className="text-sm text-gray-700 truncate max-w-[160px]">{a.name}</span>
        </button>
      ))}
    </div>
  )
}

// ── Chat-list row ─────────────────────────────────────────────────────────────
function ChatRow({ thread, userId, isActive, onClick }) {
  const isBuyer = thread.buyer?.id && String(thread.buyer.id) === String(userId)
  const other   = isBuyer ? thread.seller : thread.buyer
  const unread  = isBuyer ? (thread.unreadForBuyer || 0) : (thread.unreadForSeller || 0)

  const lastMsg = useMemo(() => {
    const real = (thread.messages || []).filter(m => m.id !== 'last-message')
    if (!real.length) return thread.lastMessage || ''
    const m = real[real.length - 1]
    if (m.type === 'call') {
      const isVideo = m.callMeta?.callType === 'video'
      const missed  = ['missed','rejected','cancelled'].includes(m.callMeta?.status)
      return missed
        ? `📵 Missed ${isVideo ? 'video' : 'voice'} call`
        : `${isVideo ? '📹' : '📞'} ${isVideo ? 'Video' : 'Voice'} call`
    }
    return m.senderId === userId ? `You: ${m.text}` : m.text
  }, [thread.messages, thread.lastMessage, userId])

  const title = thread.type === 'support'
    ? 'Support'
    : thread.productTitle || other?.name || 'Chat'

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-purple-50/60 transition-colors text-left ${
        isActive ? 'bg-purple-50 border-l-4 border-purple-600' : 'border-l-4 border-transparent'
      }`}
    >
      <Ava src={other?.avatar || other?.image} name={other?.name} size={46} online={unread > 0} />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1">
          <span className={`text-sm font-bold leading-snug truncate ${isActive ? 'text-purple-700' : 'text-gray-900'}`}>
            {title}
          </span>
          <span className="text-[11px] text-gray-400 shrink-0 mt-0.5">{fmtTime(thread.updatedAt)}</span>
        </div>

        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs text-gray-500 truncate">{other?.name || 'User'}</span>
          {unread > 0 && <span className="h-1.5 w-1.5 rounded-full bg-purple-600 shrink-0" />}
        </div>

        {unread > 0 ? (
          <p className="text-xs font-semibold text-green-600 mt-0.5">
            {unread > 5 ? '5+ new messages' : `${unread} new message${unread > 1 ? 's' : ''}`}
          </p>
        ) : (
          <div className="flex items-center gap-1 mt-0.5">
            {thread.productImage && (
              <ImageIcon className="h-3 w-3 text-gray-400 shrink-0" />
            )}
            <p className="text-xs text-gray-400 truncate">{lastMsg}</p>
          </div>
        )}
      </div>
    </button>
  )
}

// ── Sidebar — matches HomePage sidebar design ────────────────────────────────
function ChatSidebar({ chatUnread }) {
  const dispatch        = useDispatch()
  const { pathname }    = useLocation()
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const { rootCategories } = useSelector((state) => state.categories)

  useEffect(() => {
    if (rootCategories.length === 0) dispatch(fetchRootCategories())
  }, [dispatch, rootCategories.length])

  const quickLinks = [
    { label: 'My Bookmarks', to: isAuthenticated ? '/bookmarks' : '/login', icon: Bookmark },
    { label: 'Messages',     to: '/chat', icon: MessageCircle, badge: chatUnread > 0 ? chatUnread : null },
    { label: 'Settings',     to: isAuthenticated ? '/dashboard/settings' : '/login', icon: Settings },
  ]

  return (
    <aside className="h-full overflow-y-auto border-r border-slate-200 bg-white p-5">

      {/* Post Your Ad */}
      <Link
        to={isAuthenticated ? '/post-ad-dynamic' : '/login'}
        className="mb-6 flex items-center justify-center gap-2 w-full rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Post Your Ad
      </Link>

      {/* Categories */}
      {rootCategories.length > 0 && (
        <div className="mb-5">
          <Link
            to="/categories"
            className="inline-block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2 transition hover:text-primary-700"
          >
            Categories
          </Link>
          <div className="space-y-0.5">
            {rootCategories.map((cat) => {
              const Icon  = getCategoryIcon(cat.name)
              const count = cat.productCount ?? cat.count ?? 0
              return (
                <Link
                  key={cat._id || cat.id}
                  to={`/categories/${cat._id || cat.id}/products`}
                  className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  <Icon className="h-4 w-4 shrink-0 text-slate-500" />
                  <span className="flex-1 truncate">{cat.name}</span>
                  {count > 0 && (
                    <span className="text-xs text-slate-400">{fmtCompactCount(count)}</span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2">
          Quick Links
        </p>
        <div className="space-y-0.5">
          {quickLinks.map(({ label, to, icon: Icon, badge }) => {
            const active = to === '/chat' ? pathname.startsWith('/chat') : pathname === to
            return (
              <Link
                key={label}
                to={to}
                className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition hover:bg-slate-100 ${
                  active ? 'bg-primary-50 text-primary-800' : 'text-slate-700'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-primary-600' : 'text-slate-500'}`} />
                <span className="flex-1 truncate">{label}</span>
                {badge != null && (
                  <span className="inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-purple-600 text-white text-[10px] font-bold">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Popular Categories */}
      {rootCategories.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2">
            Popular Categories
          </p>
          <div className="space-y-0.5">
            {rootCategories.slice(0, 4).map((cat) => (
              <Link
                key={cat._id || cat.id}
                to={`/search?q=${encodeURIComponent(cat.name)}`}
                className="block text-sm text-slate-600 rounded-2xl px-3 py-2 transition hover:text-primary-700 hover:bg-slate-50"
              >
                {cat.name}
              </Link>
            ))}
          </div>
        </div>
      )}

    </aside>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ChatInboxPage() {
  const navigate        = useNavigate()
  const { threadId: urlId } = useParams()
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const currentUser     = useSelector(selectUser)
  const {
    threads, loading: threadsLoading,
    getThreadById, sendMessage, markThreadRead, refreshChats,
  } = useChat()
  const { startCall } = useCall()

  // Force-load threads when the chat page mounts (ChatContext's auto-load
  // may have already run with a different pathname before navigation settled)
  useEffect(() => {
    refreshChats()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [activeId,     setActiveId]     = useState(urlId || null)
  const [activeThread, setActiveThread] = useState(null)
  const [loadingThread, setLoadingThread] = useState(false)
  const [cartCount, setCartCount] = useState(0)
  const [search,  setSearch]  = useState('')
  const [tab,     setTab]     = useState('All')
  const [text,    setText]    = useState('')
  const [sending, setSending] = useState(false)
  const [mobileTh, setMobileTh] = useState(!!urlId)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const [attachFiles, setAttachFiles] = useState([])
  const [offerOpen, setOfferOpen] = useState(false)
  const [offerAmount, setOfferAmount] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)

  const bottomRef        = useRef(null)
  const inputRef         = useRef(null)
  const fileRef          = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef   = useRef([])
  const recordingTimerRef = useRef(null)

  const fmtRecTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const startRecording = async () => {
    if (isRecording) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = ['audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported(t)) || ''
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {})
      audioChunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = () => {
        // Stop tracks and exit recording state first so React 18 batches both updates together
        stream.getTracks().forEach((t) => t.stop())
        const chunks = audioChunksRef.current.slice()
        const type = mr.mimeType || mimeType || 'audio/webm'
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : type.includes('aac') ? 'aac' : 'webm'
        const blob = new Blob(chunks, { type })
        if (blob.size > 0) {
          setAttachFiles([new File([blob], `voice-${Date.now()}.${ext}`, { type })])
        } else {
          toast.error('Recording was empty, please try again')
        }
        setIsRecording(false)
      }
      mediaRecorderRef.current = mr
      mr.start(250)
      setIsRecording(true)
      setRecordingTime(0)
      recordingTimerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000)
    } catch (err) {
      const msg = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
        ? 'Microphone access denied'
        : 'Could not start recording'
      toast.error(msg)
    }
  }

  const stopRecording = () => {
    clearInterval(recordingTimerRef.current)
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
        // onstop handler will call setIsRecording(false) + setAttachFiles in one batch
      } else {
        setIsRecording(false)
      }
    } catch {
      setIsRecording(false)
    }
  }

  useEffect(() => () => {
    clearInterval(recordingTimerRef.current)
    try { if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop() } catch { /* ignore */ }
  }, [])

  // total unread for sidebar badge
  const chatUnread = useMemo(() => threads.reduce((sum, t) => {
    const isBuyer = t.buyer?.id && String(t.buyer.id) === String(currentUser?._id)
    return sum + (isBuyer ? (t.unreadForBuyer || 0) : (t.unreadForSeller || 0))
  }, 0), [threads, currentUser?._id])

  // sync URL → state
  useEffect(() => {
    if (urlId && urlId !== activeId) { setActiveId(urlId); setMobileTh(true) }
  }, [urlId]) // eslint-disable-line

  // load thread
  useEffect(() => {
    if (!activeId) return
    let dead = false
    setLoadingThread(true)
    getThreadById(activeId)
      .then(t => {
        if (dead || !t) return
        setActiveThread(t)
        const isBuyer = t.buyer?.id && String(t.buyer.id) === String(currentUser?._id)
        markThreadRead(t.id, isBuyer ? 'buyer' : 'seller')
      })
      .finally(() => { if (!dead) setLoadingThread(false) })
    return () => { dead = true }
  }, [activeId]) // eslint-disable-line

  // sync socket updates
  useEffect(() => {
    if (!activeId) return
    const ctx = threads.find(t => t.id === activeId)
    if (!ctx) return
    setActiveThread(prev => {
      if (!prev) return ctx
      const prevIds = new Set((prev.messages || []).map(m => m.id).filter(id => !id.startsWith('temp-')))
      const hasNew  = (ctx.messages || []).some(m => m.id !== 'last-message' && !prevIds.has(m.id))
      return hasNew ? ctx : prev
    })
  }, [threads, activeId])

  // auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeThread?.messages?.length])

  const openThread = useCallback(id => {
    setActiveId(id); setMobileTh(true)
    navigate(`/chat/${id}`, { replace: true })
  }, [navigate])

  const doSend = async (msg = text.trim(), files = attachFiles) => {
    if (!msg && files.length === 0) return
    if (!activeId || !activeThread || sending) return
    setText('')
    setAttachFiles([])
    setSending(true)
    const isBuyer = activeThread.buyer?.id && String(activeThread.buyer.id) === String(currentUser?._id)
    const senderRole = isBuyer ? 'buyer' : 'seller'
    try {
      await sendMessage(activeId, { senderId: currentUser._id, senderRole, text: msg, files: files.length > 0 ? files : null })
    } catch (err) {
      setText(msg)
      if (files.length > 0) setAttachFiles(files)
      toast.error(err?.response?.data?.message || 'Failed to send message')
    } finally { setSending(false); inputRef.current?.focus() }
  }

  const handleKey = e => { if (e.key === 'Enter' && !e.shiftKey && !attachFiles.length) { e.preventDefault(); doSend() } }

  // A quick-reply chip either sends its text, or — for "Make an offer" — opens the offer modal.
  const handleQuickReply = qr => {
    if (qr === 'Make an offer') { setOfferAmount(''); setOfferOpen(true) }
    else doSend(qr)
  }

  const sendOffer = () => {
    const amount = Number(String(offerAmount).replace(/[^0-9.]/g, ''))
    if (!amount || amount <= 0) { toast.error('Enter a valid offer amount'); return }
    doSend(`💰 Offer: AED ${amount.toLocaleString()}`)
    setOfferOpen(false)
    setOfferAmount('')
  }

  // Accept an offer: notify the chat AND add the product to the buyer's cart.
  // Either party can accept; the backend always files it under the buyer's id.
  const acceptOffer = async (amountStr) => {
    const amount = Number(String(amountStr).replace(/[^0-9.]/g, ''))
    doSend(`✅ Offer accepted for AED ${amountStr}`)
    try {
      await cartService.addFromOffer(activeId, amount)
      toast.success('Product added to cart')
      refreshCartCount()
    } catch {
      toast.error('Could not add product to cart')
    }
  }

  // filtered list
  const filtered = useMemo(() => threads.filter(t => {
    const isBuyer = t.buyer?.id && String(t.buyer.id) === String(currentUser?._id)
    const other   = isBuyer ? t.seller : t.buyer
    const unread  = isBuyer ? (t.unreadForBuyer || 0) : (t.unreadForSeller || 0)
    if (search) {
      const q = search.toLowerCase()
      const last = (t.messages || []).filter(m => m.id !== 'last-message').slice(-1)[0]?.text || ''
      if (!(other?.name || '').toLowerCase().includes(q) &&
          !(t.productTitle || '').toLowerCase().includes(q) &&
          !last.toLowerCase().includes(q)) return false
    }
    if (tab === 'Buying'  && !isBuyer)   return false
    if (tab === 'Selling' && isBuyer)    return false
    if (tab === 'Unread'  && unread === 0) return false
    return true
  }), [threads, search, tab, currentUser?._id])

  const otherParty = useMemo(() => {
    if (!activeThread || !currentUser) return null
    if (activeThread.type === 'support') return { name: 'Support', avatar: null }
    const isBuyer = activeThread.buyer?.id && String(activeThread.buyer.id) === String(currentUser._id)
    return isBuyer ? activeThread.seller : activeThread.buyer
  }, [activeThread, currentUser])

  // Is the current user the BUYER of this thread? The cart icon/count is a
  // buyer-only affordance (carts are always filed under the buyer).
  const isBuyer = useMemo(() => {
    if (!activeThread || !currentUser || activeThread.type === 'support') return false
    return activeThread.buyer?.id && String(activeThread.buyer.id) === String(currentUser._id)
  }, [activeThread, currentUser])

  // Count this thread's product in the buyer's active cart.
  const refreshCartCount = useCallback(async () => {
    const productId = activeThread?.productId
    if (!isBuyer || !productId) { setCartCount(0); return }
    try {
      const res = await cartService.getCart()
      const items = res?.data?.data || []
      const count = items
        .filter(it => String(it.productId?._id || it.productId) === String(productId))
        .reduce((n, it) => n + (it.quantity || 1), 0)
      setCartCount(count)
    } catch {
      setCartCount(0)
    }
  }, [isBuyer, activeThread?.productId])

  useEffect(() => { refreshCartCount() }, [refreshCartCount])

  const grouped = useMemo(() => {
    if (!activeThread) return []
    return groupMsgs((activeThread.messages || []).filter(m => m.id !== 'last-message'))
  }, [activeThread])

  if (!isAuthenticated) {
    return (
      <div className="h-[100dvh] overflow-hidden bg-[#f7f8fa]">
        <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
          <MarketplaceTopBar topBarColSpan="" onToggleMobileMenu={() => navigate('/login')} />
          <div className="flex items-center justify-center px-4">
            <div className="text-center">
              <p className="mb-4 text-gray-500">Please log in to view your messages.</p>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white"
              >
                Login
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#f7f8fa]">
      {mobileMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-[60] bg-black/40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-[70] w-[min(320px,88vw)] overflow-y-auto bg-white p-5 shadow-2xl lg:hidden">
            <div className="mb-5 flex items-center justify-between">
              <Link to="/" onClick={() => setMobileMenuOpen(false)}>
                <BrandLogo variant="light" className="h-8 w-auto" />
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl p-2 text-slate-600 hover:bg-slate-100"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ChatSidebar chatUnread={chatUnread} />
          </aside>
        </>
      )}

      <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] grid-cols-1 lg:grid-cols-[270px_minmax(0,1fr)]">
        <div className={MARKETPLACE_LOGO_CELL}>
          <MarketplaceLogoBlock />
        </div>

        <MarketplaceTopBar topBarColSpan="" onToggleMobileMenu={() => setMobileMenuOpen(true)} />

        <aside className="hidden min-h-0 overflow-y-auto border-r border-slate-200 bg-white lg:block">
          <ChatSidebar chatUnread={chatUnread} />
        </aside>

        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden p-3 sm:p-4 lg:p-5">

        {/* ── Two-panel ───────────────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 border border-gray-200 rounded-2xl overflow-hidden flex bg-white shadow-sm">

          {/* ═══ LEFT: conversation list ═══ */}
          <div className={`flex flex-col shrink-0 border-r border-gray-200 ${mobileTh ? 'hidden md:flex' : 'flex'} w-full md:w-[280px] lg:w-[300px]`}>

            {/* search */}
            <div className="px-3 py-3 border-b border-gray-100">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search messages..."
                  className="w-full h-9 pl-9 pr-8 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 transition" />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* tabs */}
            <div className="flex border-b border-gray-100 px-1">
              {TABS.map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 py-2.5 text-xs font-semibold transition-colors relative ${
                    tab === t ? 'text-purple-600' : 'text-gray-500 hover:text-gray-700'
                  }`}>
                  {t}
                  {tab === t && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 rounded-full" />
                  )}
                </button>
              ))}
            </div>

            {/* list */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {threadsLoading ? (
                [...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-4 animate-pulse">
                    <div className="h-11 w-11 rounded-full bg-gray-200 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-3/4" />
                      <div className="h-2.5 bg-gray-200 rounded w-1/2" />
                      <div className="h-2.5 bg-gray-200 rounded w-2/3" />
                    </div>
                  </div>
                ))
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-2">
                  <div className="h-12 w-12 rounded-full bg-purple-50 flex items-center justify-center">
                    <BubbleIcon className="h-6 w-6 text-purple-300" />
                  </div>
                  <p className="text-sm font-semibold text-gray-600 mt-1">
                    {search ? 'No results found' : 'No conversations yet'}
                  </p>
                  {!search && <p className="text-xs text-gray-400">Start chatting from any product page.</p>}
                </div>
              ) : (
                filtered.map(t => (
                  <ChatRow key={t.id} thread={t} userId={currentUser?._id}
                    isActive={t.id === activeId} onClick={() => openThread(t.id)} />
                ))
              )}
            </div>

            {/* new chat */}
            <div className="p-3 border-t border-gray-100 shrink-0">
              <button onClick={() => navigate('/reels')}
                className="w-full h-11 rounded-full text-white text-sm font-bold transition-opacity hover:opacity-90 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%)' }}>
                <Plus className="h-4 w-4" /> New Chat
              </button>
            </div>
          </div>

          {/* ═══ RIGHT: thread ═══ */}
          <div className={`flex-1 flex flex-col min-w-0 ${!mobileTh ? 'hidden md:flex' : 'flex'}`}>

            {activeId ? (<>
              {/* header */}
              <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 bg-white shrink-0">
                <button className="md:hidden p-1 -ml-1 text-gray-500"
                  onClick={() => { setMobileTh(false); navigate('/chat', { replace: true }) }}>
                  <ArrowLeft className="h-5 w-5" />
                </button>

                <Ava src={otherParty?.avatar || otherParty?.image} name={otherParty?.name} size={46} online />

                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-gray-900 leading-tight truncate">
                    {otherParty?.name || 'User'}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs font-medium text-green-500 mt-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                    Active Now
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {isBuyer && (
                    <button
                      title="View cart"
                      onClick={() => navigate(`/cart${activeThread?.productId ? `?productId=${activeThread.productId}` : ''}`)}
                      className="relative text-gray-400 hover:opacity-80 transition-opacity"
                    >
                      <img src="/images/shopping_cart.png" alt="Cart" className="h-5 w-5 object-contain" />
                      {cartCount > 0 && (
                        <span className="absolute -top-2 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                          {cartCount}
                        </span>
                      )}
                    </button>
                  )}
                  <button
                    title="Voice call"
                    onClick={() => otherParty?.id && startCall(
                      { id: otherParty.id, name: otherParty.name },
                      'audio',
                      activeId,
                    )}
                    className="text-gray-400 hover:text-purple-600 transition-colors"
                  >
                    <Phone className="h-5 w-5" />
                  </button>
                  <button
                    title="Video call"
                    onClick={() => otherParty?.id && startCall(
                      { id: otherParty.id, name: otherParty.name },
                      'video',
                      activeId,
                    )}
                    className="text-gray-400 hover:text-purple-600 transition-colors"
                  >
                    <Video className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* messages */}
              <div className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50/60">
                {loadingThread ? (
                  <div className="space-y-4 pt-2">
                    {[38, 55, 42, 60, 35].map((w, i) => (
                      <div key={i} className={`flex items-end gap-2 animate-pulse ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                        {i % 2 === 0 && <div className="h-8 w-8 rounded-full bg-gray-200 shrink-0" />}
                        <div className="h-10 bg-gray-200 rounded-2xl" style={{ width: `${w}%`, maxWidth: 260 }} />
                        {i % 2 !== 0 && <div className="h-8 w-8 rounded-full bg-gray-200 shrink-0" />}
                      </div>
                    ))}
                  </div>
                ) : grouped.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                    <BubbleIcon className="h-12 w-12 text-gray-200" />
                    <p className="text-sm text-gray-400">No messages yet — say hello!</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {grouped.map(group => (
                      <div key={group.label}>
                        {/* date divider */}
                        <div className="flex items-center gap-3 my-5">
                          <div className="flex-1 h-px bg-gray-200" />
                          <span className="text-xs text-gray-400">{group.label}</span>
                          <div className="flex-1 h-px bg-gray-200" />
                        </div>

                        <div className="space-y-3">
                          {group.msgs.map(m => {
                            const isSelf = m.senderId === currentUser?._id
                            const isTemp = m.id?.startsWith('temp-')
                            const offerAmount = parseOfferAmount(m.text)
                            return (
                              <div key={m.id}
                                className={`flex items-end gap-2 ${isSelf ? 'justify-end' : 'justify-start'}`}>

                                {!isSelf && (
                                  <Ava src={otherParty?.avatar || otherParty?.image}
                                    name={otherParty?.name} size={32} />
                                )}

                                <div className={`flex flex-col max-w-[60%] ${isSelf ? 'items-end' : 'items-start'}`}>
                                  {m.type === 'call' ? (
                                    <CallBubble message={m} isSelf={isSelf} />
                                  ) : offerAmount ? (
                                    <OfferBubble
                                      amount={offerAmount}
                                      isSelf={isSelf}
                                      senderName={otherParty?.name}
                                      senderAvatar={otherParty?.avatar || otherParty?.image}
                                      onAccept={() => acceptOffer(offerAmount)}
                                      onReject={() => doSend('❌ Offer rejected')}
                                      onCounter={amt => doSend(`💰 Offer: AED ${amt.toLocaleString()}`)}
                                    />
                                  ) : (m.attachments?.length > 0 || m.attachment) ? (() => {
                                    const atts = m.attachments?.length > 0 ? m.attachments : (m.attachment ? [m.attachment] : [])
                                    return (
                                      <div className={`rounded-2xl overflow-hidden border border-gray-200 shadow-sm ${isSelf ? 'rounded-br-sm' : 'rounded-bl-sm'}`}>
                                        <AttachGrid attachments={atts} isTemp={isTemp} />
                                        {m.text ? <p className="px-4 py-2 text-sm text-gray-800 whitespace-pre-wrap break-words border-t border-gray-100 bg-white">{m.text}</p> : null}
                                      </div>
                                    )
                                  })() : (
                                  <div className={`px-4 py-2.5 rounded-2xl text-sm text-gray-800 leading-relaxed bg-white border border-gray-200 shadow-sm ${
                                    isSelf ? 'rounded-br-sm' : 'rounded-bl-sm'
                                  } ${isTemp ? 'opacity-60' : ''}`}>
                                    <p className="whitespace-pre-wrap break-words">{m.text}</p>
                                  </div>
                                  )}
                                  <div className={`flex items-center gap-1 mt-1 ${isSelf ? 'flex-row-reverse' : ''}`}>
                                    <span className="text-[10px] text-gray-400">{fmtMsgTime(m.createdAt)}</span>
                                    {m.type !== 'call' && isSelf && !isTemp && (
                                      m.readAt
                                        ? <CheckCheck className="h-3 w-3 text-purple-500" />
                                        : <Check className="h-3 w-3 text-gray-400" />
                                    )}
                                  </div>
                                </div>

                                {isSelf && (
                                  <Ava src={currentUser?.avatar} name={currentUser?.name} size={32} />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>

              {/* quick replies */}
              <div className="flex gap-2 px-5 py-2.5 bg-white border-t border-gray-100 overflow-x-auto shrink-0">
                {QUICK_REPLIES.map(qr => (
                  <button key={qr} onClick={() => handleQuickReply(qr)}
                    className="whitespace-nowrap px-4 py-1.5 rounded-full border border-gray-200 bg-white text-xs text-gray-600 hover:border-purple-300 hover:text-purple-700 hover:bg-purple-50 transition-colors shrink-0">
                    {qr}
                  </button>
                ))}
              </div>

              {/* Make an offer modal */}
              {offerOpen && (
                <div
                  className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
                  onClick={() => setOfferOpen(false)}
                >
                  <div
                    className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="flex items-start justify-between">
                      <h2 className="text-xl font-bold text-gray-900">Make an Offer</h2>
                      <button
                        type="button"
                        onClick={() => setOfferOpen(false)}
                        className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                        aria-label="Close"
                      >
                        <X className="h-6 w-6" />
                      </button>
                    </div>

                    <label className="mt-6 block text-sm font-medium text-gray-700">Your offer amount</label>
                    <div className="mt-2 flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 focus-within:border-[#1414e6]">
                      <span className="text-sm font-semibold text-gray-500">AED</span>
                      <input
                        type="number"
                        min="0"
                        autoFocus
                        value={offerAmount}
                        onChange={e => setOfferAmount(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') sendOffer() }}
                        placeholder="Enter amount"
                        className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                      />
                    </div>

                    <div className="mt-6 flex gap-3">
                      <button
                        type="button"
                        onClick={() => setOfferOpen(false)}
                        className="flex-1 rounded-full border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={sendOffer}
                        className="flex-1 rounded-full bg-[#1414e6] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1010c4]"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* input */}
              <div className="px-5 py-3 bg-white border-t border-gray-200 shrink-0">
                <input ref={fileRef} type="file" multiple className="hidden"
                  onChange={e => { const fs = Array.from(e.target.files || []); if (fs.length) setAttachFiles(prev => [...prev, ...fs]); e.target.value = '' }} />

                {attachFiles.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2 p-2 bg-gray-50 rounded-xl border border-gray-100">
                    {attachFiles.map((f, idx) => (
                      <div key={idx} className="relative group shrink-0">
                        {f.type.startsWith('image/') ? (
                          <img src={URL.createObjectURL(f)} alt="" className="h-16 w-16 rounded-xl object-cover" />
                        ) : f.type.startsWith('audio/') ? (
                          <div className="h-16 w-16 rounded-xl bg-purple-50 border border-purple-200 flex flex-col items-center justify-center gap-1">
                            <Mic className="h-6 w-6 text-purple-500" />
                            <span className="text-[9px] text-purple-500 font-medium">Audio</span>
                          </div>
                        ) : (
                          <div className="h-16 w-16 rounded-xl bg-white border border-gray-200 flex flex-col items-center justify-center gap-1 px-1">
                            <FileText className="h-6 w-6 text-purple-500" />
                            <span className="text-[9px] text-gray-500 truncate w-full text-center">{f.name.split('.').pop().toUpperCase()}</span>
                          </div>
                        )}
                        <button
                          onClick={() => setAttachFiles(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-gray-700 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 bg-white focus-within:ring-2 focus-within:ring-purple-200 focus-within:border-purple-400 transition"
                  style={{ minHeight: 46 }}>
                  {isRecording ? (<>
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                    <span className="text-sm font-medium text-red-500 tabular-nums">{fmtRecTime(recordingTime)}</span>
                    <span className="flex-1 text-xs text-gray-400">Recording…</span>
                    <button onClick={stopRecording}
                      className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center bg-red-500 text-white transition-colors hover:bg-red-600">
                      <Square className="h-3.5 w-3.5 fill-white" />
                    </button>
                  </>) : (<>
                    <button onClick={() => fileRef.current?.click()} className="shrink-0 text-gray-400 hover:text-purple-600 transition-colors">
                      <Paperclip className="h-5 w-5" />
                    </button>
                    <input ref={inputRef} value={text}
                      onChange={e => setText(e.target.value)} onKeyDown={handleKey}
                      placeholder="Message"
                      className="flex-1 bg-transparent py-3 text-sm text-gray-800 outline-none placeholder:text-gray-400" />
                    {(text.trim() || attachFiles.length > 0) ? (
                      <button onClick={() => doSend()} disabled={sending}
                        className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-white transition-colors disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)' }}>
                        {sending
                          ? <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          : <Send className="h-3.5 w-3.5" />
                        }
                      </button>
                    ) : (
                      <button onClick={startRecording} className="shrink-0 text-gray-400 hover:text-purple-600 transition-colors">
                        <Mic className="h-5 w-5" />
                      </button>
                    )}
                  </>)}
                </div>
              </div>
            </>) : (
              /* placeholder */
              <div className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-gray-50/60">
                <div className="h-20 w-20 rounded-full flex items-center justify-center mb-5"
                  style={{ background: 'linear-gradient(135deg,#ede9fe,#ddd6fe)' }}>
                  <BubbleIcon className="h-10 w-10 text-purple-400" />
                </div>
                <p className="text-base font-bold text-gray-700">Your messages</p>
                <p className="text-sm text-gray-400 mt-1 max-w-xs">
                  {threads.length > 0
                    ? 'Select a conversation to start chatting'
                    : 'No conversations yet. Start from any product page.'}
                </p>
                {threads.length === 0 && (
                  <button onClick={() => navigate('/reels')}
                    className="mt-5 px-6 py-2.5 rounded-full text-white text-sm font-bold transition-colors"
                    style={{ background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)' }}>
                    Browse Products
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}

function BubbleIcon(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}
