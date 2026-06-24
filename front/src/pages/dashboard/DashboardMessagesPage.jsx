import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import {
  ArrowLeft, FileText, Image as ImageIcon, Mic, Paperclip, Phone, Plus, Search,
  Send, Square, Video, X, Check, CheckCheck,
} from 'lucide-react'
import { selectUser } from '@shared/store/slices/authSlice'
import { chatService } from '@shared/services/api'
import { getSocket } from '@shared/services/socket'
import { getMediaUrl } from '@shared/utils/helpers'
import { useCall } from '@shared/components/Call/CallContext'
import toast from 'react-hot-toast'

// ── Constants ─────────────────────────────────────────────────────────────────
const TABS = ['All', 'Buying', 'Selling', 'Unread']

const QUICK_REPLIES = [
  'Hello',
  'Is it available?',
  'When can I call you?',
  'What is your location?',
  'What is the final price?',
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function chatTime(value) {
  if (!value) return ''
  const d = new Date(value)
  const now = new Date()
  const diffDays = Math.floor((now - d) / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'short' })
  return d.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function msgTime(value) {
  if (!value) return ''
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function dateLabel(dateStr) {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function groupByDate(messages) {
  const groups = []
  let lastDate = ''
  for (const m of messages) {
    const day = new Date(m.createdAt).toDateString()
    if (day !== lastDate) {
      lastDate = day
      groups.push({ label: dateLabel(m.createdAt), messages: [] })
    }
    groups[groups.length - 1].messages.push(m)
  }
  return groups
}

// ── Call helpers ─────────────────────────────────────────────────────────────
function fmtDuration(secs) {
  if (!secs || secs <= 0) return ''
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
}

function CallBubble({ message, isSelf }) {
  const { callMeta } = message
  const isVideo = callMeta?.callType === 'video'
  const status  = callMeta?.status
  const missed  = status === 'missed' || status === 'rejected' || status === 'cancelled'

  const label = {
    completed: `${isVideo ? 'Video' : 'Voice'} call${fmtDuration(callMeta?.duration) ? ` · ${fmtDuration(callMeta?.duration)}` : ''}`,
    missed:    `Missed ${isVideo ? 'video' : 'voice'} call`,
    rejected:  `Declined ${isVideo ? 'video' : 'voice'} call`,
    cancelled: `Cancelled ${isVideo ? 'video' : 'voice'} call`,
  }[status] ?? (isVideo ? 'Video call' : 'Voice call')

  return (
    <div className={`inline-flex items-center gap-3 px-4 py-2.5 rounded-2xl border shadow-sm bg-white border-gray-200 ${
      isSelf ? 'rounded-br-sm' : 'rounded-bl-sm'
    }`}>
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

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ src, name = '?', size = 44, online = false }) {
  const s = size
  return (
    <div className="relative shrink-0" style={{ width: s, height: s }}>
      {src ? (
        <img src={getMediaUrl(src)} alt={name}
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
    if (a._local) return
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

// ── Chat list row ─────────────────────────────────────────────────────────────
function ChatRow({ chat, currentUserId, isActive, onClick }) {
  const isBuyer = String(typeof chat.buyer === 'object' ? chat.buyer?._id : chat.buyer) === String(currentUserId)
  const other = isBuyer ? chat.seller : chat.buyer
  const unread = isBuyer ? (chat.unreadForBuyer || 0) : (chat.unreadForSeller || 0)
  const productImg = chat.product?.video
    ? getMediaUrl(chat.product.video)
    : chat.product?.images?.[0]
    ? getMediaUrl(chat.product.images[0])
    : null

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-purple-50/60 transition-colors text-left ${
        isActive ? 'bg-purple-50 border-l-4 border-purple-600' : 'border-l-4 border-transparent'
      }`}
    >
      <Avatar src={other?.avatar} name={other?.name} size={48} online={unread > 0} />

      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-start justify-between gap-1">
          <span className={`text-sm font-bold truncate ${isActive ? 'text-purple-700' : 'text-gray-900'}`}>
            {chat.type === 'support' ? 'Support' : chat.product?.title || other?.name || 'Chat'}
          </span>
          <span className="text-[11px] text-gray-400 shrink-0 mt-0.5">{chatTime(chat.lastMessageAt)}</span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-xs text-gray-500 font-medium truncate">{other?.name || 'User'}</span>
          {unread > 0 && <span className="h-1.5 w-1.5 rounded-full bg-purple-600 shrink-0" />}
        </div>
        {unread > 0 ? (
          <span className="text-xs font-semibold text-green-600 block mt-0.5">
            {unread > 5 ? '5+ new messages' : `${unread} new message${unread > 1 ? 's' : ''}`}
          </span>
        ) : (
          <p className="text-xs text-gray-400 truncate mt-0.5">
            {chat.lastMessage || 'No messages yet'}
          </p>
        )}
      </div>

      {productImg && (
        <div className="shrink-0 h-12 w-12 rounded-lg overflow-hidden border border-gray-100">
          {chat.product?.video ? (
            <video src={productImg} className="h-full w-full object-cover" muted playsInline />
          ) : (
            <img src={productImg} alt={chat.product?.title} className="h-full w-full object-cover" />
          )}
        </div>
      )}
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DashboardMessagesPage() {
  const navigate = useNavigate()
  const currentUser = useSelector(selectUser)
  const { startCall } = useCall()

  const [chats, setChats] = useState([])
  const [loadingChats, setLoadingChats] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('All')

  const [activeId, setActiveId] = useState(null)
  const [activeChat, setActiveChat] = useState(null)
  const [messages, setMessages] = useState([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)

  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [mobileShowThread, setMobileShowThread] = useState(false)

  const [attachFiles, setAttachFiles] = useState([])
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)

  const bottomRef         = useRef(null)
  const inputRef          = useRef(null)
  const fileRef           = useRef(null)
  const mediaRecorderRef  = useRef(null)
  const audioChunksRef    = useRef([])
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

  // ── Load chat list ───────────────────────────────────────────────────────────
  const loadChats = useCallback(async () => {
    setLoadingChats(true)
    try {
      const res = await chatService.getChats()
      const items = Array.isArray(res?.data) ? res.data : (res?.data?.chats || [])
      setChats(items)
      if (!activeId && items.length > 0) setActiveId(items[0]._id)
    } catch {
      // silent
    } finally {
      setLoadingChats(false)
    }
  }, [activeId])

  useEffect(() => { loadChats() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load thread messages ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeId) return
    let cancelled = false
    setLoadingMsgs(true)
    chatService.getChatById(activeId)
      .then((res) => {
        if (cancelled) return
        setActiveChat(res.data.chat)
        setMessages(res.data.messages || [])
        chatService.markAsRead(activeId).catch(() => {})
        // Clear local unread badge
        setChats((prev) =>
          prev.map((c) => {
            if (c._id !== activeId) return c
            const isBuyer = String(typeof c.buyer === 'object' ? c.buyer?._id : c.buyer) === String(currentUser?._id)
            return isBuyer ? { ...c, unreadForBuyer: 0 } : { ...c, unreadForSeller: 0 }
          })
        )
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingMsgs(false) })
    return () => { cancelled = true }
  }, [activeId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Socket: real-time messages ───────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?._id) return
    const socket = getSocket()
    const onNew = ({ chatId, message, isOwnMessage }) => {
      if (!chatId || !message) return
      setChats((prev) =>
        prev.map((c) =>
          c._id === chatId
            ? { ...c, lastMessage: message.text, lastMessageAt: message.createdAt,
                unreadForBuyer: !isOwnMessage && String(typeof c.seller === 'object' ? c.seller._id : c.seller) === String(currentUser._id)
                  ? (c.unreadForBuyer || 0) + 1 : c.unreadForBuyer,
                unreadForSeller: !isOwnMessage && String(typeof c.buyer === 'object' ? c.buyer._id : c.buyer) === String(currentUser._id)
                  ? (c.unreadForSeller || 0) + 1 : c.unreadForSeller,
              }
            : c
        )
      )
      if (chatId === activeId) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === message._id)) return prev
          return [...prev, message]
        })
        if (chatId === activeId) chatService.markAsRead(chatId).catch(() => {})
      }
    }
    socket.on('new-message', onNew)
    return () => socket.off('new-message', onNew)
  }, [currentUser?._id, activeId])

  // ── Auto-scroll ──────────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // ── Send ─────────────────────────────────────────────────────────────────────
  const handleSend = async (msg = text.trim(), files = attachFiles) => {
    if (!msg && files.length === 0) return
    if (!activeId || sending) return
    setText('')
    setAttachFiles([])
    setSending(true)
    const now = new Date().toISOString()
    const senderMeta = { _id: currentUser._id, name: currentUser.name, avatar: currentUser.avatar }
    const tempId = `temp-${Date.now()}`
    const temp = {
      _id: tempId,
      sender: senderMeta,
      type: files.length > 0 ? 'file' : 'text',
      text: msg,
      attachments: files.map((f) => ({ url: URL.createObjectURL(f), mimeType: f.type, name: f.name, size: f.size, _local: true })),
      attachment: files.length === 1 ? { url: URL.createObjectURL(files[0]), mimeType: files[0].type, name: files[0].name, size: files[0].size, _local: true } : null,
      createdAt: now,
      _temp: true,
    }
    setMessages((prev) => [...prev, temp])
    setChats((prev) => prev.map((c) => c._id === activeId ? { ...c, lastMessage: msg || files[0]?.name, lastMessageAt: now } : c))
    try {
      const res = await chatService.sendMessage(activeId, msg, files.length > 0 ? files : null)
      setMessages((prev) => prev.map((m) => m._id === tempId ? { ...res.data, sender: senderMeta } : m))
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m._id !== tempId))
      setText(msg)
      if (files.length > 0) setAttachFiles(files)
      toast.error(err?.response?.data?.message || 'Failed to send message')
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !attachFiles.length) { e.preventDefault(); handleSend() }
  }

  // ── Filtered chat list ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return chats.filter((c) => {
      const isBuyer = String(typeof c.buyer === 'object' ? c.buyer?._id : c.buyer) === String(currentUser?._id)
      const other = isBuyer ? c.seller : c.buyer
      const unread = isBuyer ? (c.unreadForBuyer || 0) : (c.unreadForSeller || 0)

      if (search) {
        const q = search.toLowerCase()
        const matchName = (other?.name || '').toLowerCase().includes(q)
        const matchProduct = (c.product?.title || '').toLowerCase().includes(q)
        const matchMsg = (c.lastMessage || '').toLowerCase().includes(q)
        if (!matchName && !matchProduct && !matchMsg) return false
      }

      if (tab === 'Buying' && !isBuyer) return false
      if (tab === 'Selling' && isBuyer) return false
      if (tab === 'Unread' && unread === 0) return false
      return true
    })
  }, [chats, search, tab, currentUser?._id])

  // ── Derived: active thread info ──────────────────────────────────────────────
  const otherParty = useMemo(() => {
    if (!activeChat || !currentUser) return null
    if (activeChat.type === 'support') return { name: 'Support', avatar: null }
    const buyerId = typeof activeChat.buyer === 'object' ? activeChat.buyer?._id : activeChat.buyer
    const isBuyer = String(buyerId) === String(currentUser._id)
    const party = isBuyer ? activeChat.seller : activeChat.buyer
    if (!party) return null
    // normalize _id → id for startCall compatibility
    return { ...party, id: party._id || party.id }
  }, [activeChat, currentUser])

  const grouped = useMemo(() => groupByDate(messages), [messages])

  // ── Open thread ──────────────────────────────────────────────────────────────
  const openChat = (id) => {
    setActiveId(id)
    setMobileShowThread(true)
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 72px)' }}>
      {/* Page title row */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-0 pb-3 shrink-0">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">Messages</h1>
          <p className="text-xs text-gray-500 mt-0.5">{chats.length} listing{chats.length !== 1 ? 's' : ''} found</p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors shrink-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          BACK TO HOME
        </button>
      </div>

      {/* Main panel */}
      <div className="flex-1 min-h-0 rounded-2xl border border-gray-200 bg-white overflow-hidden flex">

        {/* ── Left: Chat list ────────────────────────────────────────────────── */}
        <div className={`flex flex-col border-r border-gray-200 ${mobileShowThread ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 shrink-0`}>
          {/* Search */}
          <div className="px-3 py-3 border-b border-gray-100 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search messages..."
                className="w-full h-9 rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-8 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 transition"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 px-1 shrink-0">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2.5 text-xs font-semibold transition-colors relative ${
                  tab === t ? 'text-purple-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t}
                {tab === t && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {loadingChats ? (
              [...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                  <div className="h-12 w-12 rounded-full bg-gray-200 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-2/3" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm font-medium text-gray-500">No conversations</p>
                <p className="text-xs text-gray-400 mt-1">
                  {search ? 'Try a different search' : 'Start a chat from any product page'}
                </p>
              </div>
            ) : (
              filtered.map((c) => (
                <ChatRow
                  key={c._id}
                  chat={c}
                  currentUserId={currentUser?._id}
                  isActive={c._id === activeId}
                  onClick={() => openChat(c._id)}
                />
              ))
            )}
          </div>

          {/* New Chat */}
          <div className="p-3 shrink-0 border-t border-gray-100">
            <button
              onClick={() => navigate('/reels')}
              className="w-full flex items-center justify-center gap-2 h-11 rounded-full text-white text-sm font-bold transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%)' }}
            >
              <Plus className="h-4 w-4" />
              New Chat
            </button>
          </div>
        </div>

        {/* ── Right: Thread ──────────────────────────────────────────────────── */}
        <div className={`flex-1 flex flex-col min-w-0 ${!mobileShowThread ? 'hidden md:flex' : 'flex'}`}>
          {activeId ? (
            <>
              {/* Thread header */}
              <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 bg-white shrink-0">
                {/* Mobile back */}
                <button
                  onClick={() => setMobileShowThread(false)}
                  className="md:hidden p-1 -ml-1 text-gray-500"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>

                <Avatar src={otherParty?.avatar} name={otherParty?.name} size={44} online />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{otherParty?.name || 'User'}</p>
                  <p className="text-xs text-green-500 font-medium flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                    Active Now
                  </p>
                </div>

                <div className="flex items-center gap-3">
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
                  <button className="text-gray-400 hover:text-purple-600 transition-colors">
                    <Search className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50/60 space-y-1">
                {loadingMsgs ? (
                  <div className="space-y-4 pt-4">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className={`flex items-end gap-2 animate-pulse ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                        {i % 2 === 0 && <div className="h-8 w-8 rounded-full bg-gray-200 shrink-0" />}
                        <div className={`h-10 rounded-2xl bg-gray-200 ${i % 2 === 0 ? 'w-48' : 'w-40'}`} />
                      </div>
                    ))}
                  </div>
                ) : grouped.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <p className="text-sm text-gray-400">No messages yet. Say hi!</p>
                  </div>
                ) : (
                  grouped.map((group) => (
                    <div key={group.label}>
                      {/* Date divider */}
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-gray-200" />
                        <span className="text-xs text-gray-400 font-medium whitespace-nowrap">{group.label}</span>
                        <div className="flex-1 h-px bg-gray-200" />
                      </div>

                      <div className="space-y-2">
                        {group.messages.map((m) => {
                          const senderId = m.sender && typeof m.sender === 'object' ? m.sender._id : m.sender
                          const isSelf = String(senderId) === String(currentUser?._id)
                          const senderName = m.sender && typeof m.sender === 'object' ? m.sender.name : null
                          const senderAvatar = m.sender && typeof m.sender === 'object' ? m.sender.avatar : null

                          return (
                            <div key={m._id} className={`flex items-end gap-2 ${isSelf ? 'justify-end' : 'justify-start'}`}>
                              {!isSelf && (
                                <Avatar src={senderAvatar} name={senderName || otherParty?.name} size={32} />
                              )}
                              <div className={`max-w-[65%] flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}>
                                {m.type === 'call' ? (
                                  <CallBubble message={m} isSelf={isSelf} />
                                ) : (m.attachments?.length > 0 || m.attachment) ? (() => {
                                  const atts = m.attachments?.length > 0 ? m.attachments : (m.attachment ? [m.attachment] : [])
                                  return (
                                    <div className={`rounded-2xl overflow-hidden border border-gray-200 shadow-sm ${isSelf ? 'rounded-br-sm' : 'rounded-bl-sm'}`}>
                                      <AttachGrid attachments={atts} isTemp={!!m._temp} />
                                      {m.text ? <p className="px-4 py-2 text-sm text-gray-800 whitespace-pre-wrap break-words border-t border-gray-100 bg-white">{m.text}</p> : null}
                                    </div>
                                  )
                                })() : (
                                  <div
                                    className={`px-4 py-2.5 rounded-2xl text-sm text-gray-800 bg-white border border-gray-200 shadow-sm leading-relaxed ${
                                      isSelf ? 'rounded-br-sm' : 'rounded-bl-sm'
                                    } ${m._temp ? 'opacity-60' : ''}`}
                                  >
                                    <p className="whitespace-pre-wrap break-words leading-relaxed">{m.text}</p>
                                  </div>
                                )}
                                <div className={`flex items-center gap-1 mt-1 ${isSelf ? 'flex-row-reverse' : 'flex-row'}`}>
                                  <span className="text-[10px] text-gray-400">{msgTime(m.createdAt)}</span>
                                  {m.type !== 'call' && isSelf && !m._temp && (
                                    m.readAt
                                      ? <CheckCheck className="h-3 w-3 text-purple-500" />
                                      : <Check className="h-3 w-3 text-gray-400" />
                                  )}
                                </div>
                              </div>
                              {isSelf && (
                                <Avatar src={currentUser?.avatar} name={currentUser?.name} size={32} />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              {/* Quick replies */}
              <div className="flex gap-2 px-5 py-2 overflow-x-auto bg-white border-t border-gray-100 shrink-0">
                {QUICK_REPLIES.map((qr) => (
                  <button
                    key={qr}
                    onClick={() => handleSend(qr)}
                    className="whitespace-nowrap px-4 py-1.5 rounded-full border border-gray-200 bg-white text-xs text-gray-600 hover:border-purple-300 hover:text-purple-700 hover:bg-purple-50 transition-colors shrink-0"
                  >
                    {qr}
                  </button>
                ))}
              </div>

              {/* Input */}
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

                <div
                  className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 bg-white focus-within:ring-2 focus-within:ring-purple-200 focus-within:border-purple-400 transition"
                  style={{ minHeight: 46 }}
                >
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
                    <input
                      ref={inputRef}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Message"
                      className="flex-1 bg-transparent py-3 text-sm text-gray-800 outline-none placeholder:text-gray-400"
                    />
                    {(text.trim() || attachFiles.length > 0) ? (
                      <button
                        onClick={() => handleSend()}
                        disabled={sending}
                        className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-white transition-colors disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)' }}
                      >
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
            </>
          ) : (
            // No active chat
            <div className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-gray-50/60">
              <div className="h-20 w-20 rounded-full flex items-center justify-center mb-5"
                style={{ background: 'linear-gradient(135deg,#ede9fe,#ddd6fe)' }}>
                <MessageCircleIcon className="h-10 w-10 text-purple-400" />
              </div>
              <p className="text-base font-bold text-gray-700">Your messages</p>
              <p className="text-sm text-gray-400 mt-1 max-w-xs">Select a conversation to start chatting</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MessageCircleIcon(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}
