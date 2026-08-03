import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, MessageCircle, Send, ShieldCheck, Clock, Sparkles, Tags, ImageIcon, Info, Trash2, XCircle, Check, CheckCheck, Paperclip, Play, X, FileText } from 'lucide-react'
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { selectIsAuthenticated, selectUser } from '@shared/store/slices/authSlice'
import { useChat } from '@shared/components/Chat/ChatContext'
import ChatMessageRichContent from '@shared/components/Chat/ChatMessageRichContent'
import ChatAttachments from '@shared/components/Chat/ChatAttachments'
import { getSocket } from '@shared/services/socket'
import { chatService } from '@shared/services/api'

const VIDEO_EXT_RE = /\.(mp4|mov|webm|mkv|avi|m4v|ogg)(\?|$)/i
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|bmp|heic|heif|avif)(\?|$)/i

// Classify a chat attachment (real or optimistic) so we can render it WhatsApp-style.
function attachmentKind(att) {
  const mime = att?.mimeType || att?.type || ''
  const ref = att?.previewUrl || att?.url || att?.name || ''
  if (mime.startsWith('video/') || VIDEO_EXT_RE.test(ref)) return 'video'
  if (mime.startsWith('image/') || IMAGE_EXT_RE.test(ref)) return 'image'
  return 'file'
}

const MAX_ATTACHMENT_MB = 25 // must match backend chatUpload fileSize limit

function ChatThreadPage() {
  const { threadId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const user = useSelector(selectUser)
  const { threads: contextThreads, getThreadById, markThreadRead, sendMessage, deleteThread, deleteMessage } = useChat()
  const [message, setMessage] = useState('')
  const [price, setPrice] = useState(1000)
  const [condition, setCondition] = useState('good')
  const [category, setCategory] = useState('electronics')
  const [suggestion, setSuggestion] = useState({ min: 900, max: 1100, midpoint: 1000 })
  const [pendingFiles, setPendingFiles] = useState([])
  const [sending, setSending] = useState(false)
  const fileInputRef = useRef(null)
  const bottomRef = useRef(null)
  const messagesContainerRef = useRef(null)

  const [thread, setThread] = useState(null)
  const [loadingThread, setLoadingThread] = useState(true)
  const [markedAsRead, setMarkedAsRead] = useState(false)
  const markedReadForRef = useRef(null)

  // Mark as read in DB immediately when user opens chat (no wait for thread load) → badge drops instantly
  useEffect(() => {
    if (!threadId || !isAuthenticated) return
    if (markedReadForRef.current === threadId) return
    markedReadForRef.current = threadId
    chatService
      .markAsRead(threadId)
      .then(() => {
      })
      .catch((err) => {
        markedReadForRef.current = null
        if (err?.code !== 'ERR_NETWORK') console.error('Mark as read failed:', err)
      })
    return () => {
      markedReadForRef.current = null
    }
  }, [threadId, isAuthenticated])

  // Join chat room for real-time updates when viewing a thread
  useEffect(() => {
    if (threadId && isAuthenticated) {
      const socket = getSocket()
      // Join the chat room to receive messages for this specific chat
      socket.emit('join-room', `chat-${threadId}`)

      return () => {
        // Leave room when component unmounts
        socket.emit('leave-room', `chat-${threadId}`)
      }
    }
  }, [threadId, isAuthenticated])

  // Real-time: update the OPEN conversation directly from the socket, so a message
  // shows the instant it arrives (rather than depending on the inbox-list sync).
  // A named handler is used so socket.off removes only this listener, not the
  // ChatContext one that keeps the inbox in sync.
  useEffect(() => {
    if (!threadId || !isAuthenticated) return
    const socket = getSocket()
    const onNewMessage = (data) => {
      if (!data || data.chatId !== threadId || !data.message) return
      const m = data.message
      const senderId =
        typeof m.sender === 'object' ? (m.sender._id || m.sender.id) : m.sender
      const realId = m._id || m.id
      console.log('💬 live message on open thread', { threadId, realId, text: m.text })
      setThread((prev) => {
        if (!prev) return prev
        if (prev.messages.some((x) => x.id === realId)) return prev // dedupe
        const localMsg = {
          id: realId,
          senderId,
          senderRole: String(senderId) === String(prev.buyer?.id) ? 'buyer' : 'seller',
          type: m.type || 'text',
          text: m.text || '',
          attachment: m.attachment || null,
          attachments: m.attachments?.length ? m.attachments : m.attachment ? [m.attachment] : [],
          callMeta: m.callMeta || null,
          createdAt: m.createdAt || new Date().toISOString(),
          read: m.read || false,
        }
        // Replace our own optimistic temp bubble (same text/sender) with the real one.
        const withoutTemp = prev.messages.filter(
          (x) =>
            !(String(x.id).startsWith('temp-') &&
              x.text === localMsg.text &&
              String(x.senderId) === String(senderId)),
        )
        return { ...prev, messages: [...withoutTemp, localMsg], updatedAt: localMsg.createdAt }
      })
    }
    socket.on('new-message', onNewMessage)
    return () => socket.off('new-message', onNewMessage)
  }, [threadId, isAuthenticated])

  // Sync thread with context threads when they update (e.g., after sending message)
  useEffect(() => {
    if (threadId && contextThreads.length > 0) {
      const contextThread = contextThreads.find(t => t.id === threadId)
      if (contextThread) {
        setThread((prevThread) => {
          if (!prevThread) {
            return contextThread
          }
          // Always update if context has more messages or different message IDs
          const prevIds = new Set((prevThread.messages || []).map(m => m.id).filter(id => !id.startsWith('temp-')))
          const newIds = new Set((contextThread.messages || []).map(m => m.id).filter(id => id !== 'last-message'))
          
          if (newIds.size > prevIds.size) {
            return contextThread
          }
          
          // Check if any real messages changed
          const hasNewMessages = [...newIds].some(id => !prevIds.has(id))
          if (hasNewMessages) {
            return contextThread
          }
          
          return prevThread
        })
      }
    }
  }, [threadId, contextThreads])

  // Load thread from backend - only once when threadId changes
  useEffect(() => {
    let cancelled = false
    
    const loadThread = async () => {
      if (!threadId) return
      setLoadingThread(true)
      try {
        // Use getThreadById from context
        const loadedThread = await getThreadById(threadId)
        if (!cancelled && loadedThread) {
          setThread(loadedThread)
          setMarkedAsRead(false) // Reset when thread changes
        }
      } catch (err) {
        console.error('Error loading thread:', err)
      } finally {
        if (!cancelled) {
          setLoadingThread(false)
        }
      }
    }
    
    loadThread()
    
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]) // Only depend on threadId, getThreadById changes but we don't want to reload

  const viewerRole = useMemo(() => {
    if (!thread || !user) return null
    const buyerId = typeof thread.buyer === 'object' ? thread.buyer.id : thread.buyer
    return buyerId === user._id ? 'buyer' : 'seller'
  }, [thread, user])

  const isVideo = useMemo(
    () => Boolean(thread?.productImage && /\.(mp4|mov|avi|mkv|webm)$/i.test(thread.productImage)),
    [thread?.productImage]
  )
  const placeholderImage =
    'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=60'

  // Mark as read only once when thread loads and viewerRole is determined
  useEffect(() => {
    if (thread && viewerRole && !markedAsRead) {
      setMarkedAsRead(true)
      markThreadRead(thread.id, viewerRole).catch(err => {
        // Silently fail - don't retry to avoid loops
        console.error('Failed to mark as read:', err)
      })
    }
  }, [thread?.id, viewerRole, markedAsRead]) // Only depend on thread.id, not entire thread object

  useEffect(() => {
    if (thread?.messages && thread.messages.length > 0) {
      // Scroll only the messages container (not the window) so sending a message
      // doesn't scroll the whole page. scrollIntoView would bubble to every
      // scrollable ancestor, including the page itself.
      const el = messagesContainerRef.current
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [thread?.messages?.length])

  const searchParams = new URLSearchParams(location.search)
  const from = searchParams.get('from')
  const isAdminChat = location.pathname.startsWith('/admin/chat/')

  if (!isAuthenticated) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center bg-white rounded-lg shadow">
        <MessageCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Chat</h1>
        <p className="text-gray-600 mb-6">Please log in to chat with buyers and sellers.</p>
        <Link to="/login" className="btn-primary inline-flex items-center">
          Go to Login
        </Link>
      </div>
    )
  }

  if (loadingThread) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center bg-white rounded-lg shadow">
        <p className="text-gray-900 font-semibold mb-2">Loading chat...</p>
      </div>
    )
  }

  if (!thread) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center bg-white rounded-lg shadow">
        <p className="text-gray-900 font-semibold mb-2">Chat not found</p>
        <p className="text-gray-600 mb-6">The conversation you’re looking for doesn’t exist.</p>
        <button
          onClick={() => {
            if (isAdminChat) {
              navigate('/admin?tab=contacts')
            } else {
              navigate('/chat')
            }
          }}
          className="btn-secondary"
        >
          Back to Inbox
        </button>
      </div>
    )
  }

  const otherParty = viewerRole === 'buyer' 
    ? (typeof thread.seller === 'object' ? thread.seller : { id: thread.seller })
    : (typeof thread.buyer === 'object' ? thread.buyer : { id: thread.buyer })

  const handleFilesSelected = (e) => {
    const picked = Array.from(e.target.files || [])
    e.target.value = '' // allow re-selecting the same file
    if (picked.length === 0) return
    const tooBig = picked.find((f) => f.size > MAX_ATTACHMENT_MB * 1024 * 1024)
    if (tooBig) {
      alert(`"${tooBig.name}" is larger than ${MAX_ATTACHMENT_MB}MB.`)
      return
    }
    // Build preview URLs once, at selection time, to avoid leaking blobs on re-render.
    const items = picked.map((file) => {
      const kind = attachmentKind({ mimeType: file.type, name: file.name })
      return { file, kind, previewUrl: kind === 'file' ? null : URL.createObjectURL(file) }
    })
    setPendingFiles((prev) => [...prev, ...items].slice(0, 10))
  }

  const removePendingFile = (idx) => {
    setPendingFiles((prev) => {
      const target = prev[idx]
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((_, i) => i !== idx)
    })
  }

  const handleSend = async () => {
    const msg = message.trim()
    const items = pendingFiles
    const files = items.map((it) => it.file)
    if ((!msg && files.length === 0) || !thread || sending) return

    setSending(true)
    setMessage('') // Clear input immediately for better UX
    setPendingFiles([])

    // Reuse the already-created preview URLs for the optimistic bubble.
    const optimisticAttachments = items.map((it) => ({
      previewUrl: it.previewUrl,
      mimeType: it.file.type,
      name: it.file.name,
      size: it.file.size,
    }))

    const tempId = `temp-${Date.now()}`
    const tempMessage = {
      id: tempId,
      senderId: user._id,
      senderRole: viewerRole,
      type: files.length > 0 ? 'file' : 'text',
      text: msg,
      attachments: optimisticAttachments,
      createdAt: new Date().toISOString(),
    }

    // Update local thread immediately
    setThread((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        messages: [...prev.messages, tempMessage],
        updatedAt: tempMessage.createdAt,
      }
    })

    // Send to backend and update
    try {
      await sendMessage(thread.id, {
        senderId: user._id,
        senderRole: viewerRole,
        text: msg,
        files: files.length > 0 ? files : undefined,
      })
      // Thread syncs from context via the useEffect above; the real backend
      // URL then replaces these previews. Object URLs are reclaimed on page unload.
    } catch (err) {
      // On error, restore the input + files so the user can retry.
      setMessage(msg)
      setPendingFiles(items)
      setThread((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          messages: prev.messages.filter(m => m.id !== tempId),
        }
      })
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleDeleteChat = async () => {
    if (!thread) return
    const confirmed = window.confirm('Delete this chat? This will remove all messages.')
    if (!confirmed) return
    const success = await deleteThread(thread.id)
    if (success) {
      setThread(null)
      navigate('/chat')
    }
  }

  const handleDeleteMessage = async (messageId) => {
    if (!thread || !messageId) return
    const confirmed = window.confirm('Delete this message?')
    if (!confirmed) return
    const success = await deleteMessage(thread.id, messageId)
    if (!success) return
    // Also update local thread state immediately for smoother UX
    setThread((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        messages: prev.messages.filter((m) => m.id !== messageId),
      }
    })
  }

  const calculateSuggestion = () => {
    const base = Number(price) || 0
    const categoryFactor =
      category === 'electronics'
        ? 1.02
        : category === 'vehicles'
        ? 1.12
        : category === 'furniture'
        ? 0.92
        : category === 'fashion'
        ? 0.88
        : 1
    const conditionFactor = condition === 'new' ? 1.08 : condition === 'fair' ? 0.93 : 1

    const midpoint = Math.max(0, Math.round(base * categoryFactor * conditionFactor))
    const min = Math.max(0, Math.round(midpoint * 0.93))
    const max = Math.max(min, Math.round(midpoint * 1.08))
    setSuggestion({ min, max, midpoint })
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 bg-gradient-to-b from-gray-50 to-white rounded-3xl shadow-inner border border-gray-100">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center space-x-3">
        <button
          onClick={() => {
            if (isAdminChat) {
              navigate('/admin?tab=contacts')
            } else {
              navigate('/chat')
            }
          }}
            className="h-11 w-11 rounded-full border border-gray-200 flex items-center justify-center hover:bg-white shadow-sm transition"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Chat about</p>
            <h1 className="text-xl font-semibold text-gray-900">{thread.productTitle}</h1>
            <p className="text-sm text-gray-500">With {otherParty?.name || 'User'}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center space-x-2 text-xs text-gray-600 bg-white px-3 py-2 rounded-full shadow-sm border border-gray-100">
            <ShieldCheck className="h-4 w-4 text-primary-500 shrink-0" />
            <span>Stay safe: communicate in-app</span>
          </div>
          <div className="hidden sm:inline-flex items-center space-x-2 text-xs text-gray-600 bg-white px-3 py-2 rounded-full shadow-sm border border-gray-100">
            <Sparkles className="h-4 w-4 text-primary-500 shrink-0" />
            <span>Tip: reply quickly for better conversions</span>
          </div>
        </div>
      </div>

      <div className="bg-white/95 backdrop-blur rounded-2xl shadow-xl border border-gray-100 flex flex-col h-[75vh] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3 border-b border-gray-100 bg-gradient-to-r from-primary-50/60 via-white to-white">
          <div className="flex min-w-0 items-center space-x-3">
            <div className="h-12 w-12 shrink-0 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center">
              {thread.productImage ? (
                isVideo ? (
                  <video
                    src={thread.productImage}
                    className="h-full w-full object-cover"
                    muted
                    loop
                    playsInline
                    controls={false}
                  />
                ) : (
                  <img src={thread.productImage} alt={thread.productTitle} className="h-full w-full object-cover" />
                )
              ) : (
                <img src={placeholderImage} alt="Listing placeholder" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-gray-500">Listing</p>
              <p className="text-sm font-semibold text-gray-900 truncate">{thread.productTitle}</p>
              <p className="text-xs text-gray-500 truncate">With {otherParty?.name || 'User'}</p>
            </div>
          </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="hidden sm:block max-w-[160px] truncate text-[11px] text-gray-500 bg-white px-3 py-2 rounded-full border border-gray-100">
                Thread ID: {thread.id}
              </div>
              <button
                onClick={handleDeleteChat}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-full hover:bg-red-100"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Delete</span>
              </button>
            </div>
        </div>

        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 bg-gradient-to-b from-gray-50/80 via-white to-white">
          {(!thread.messages || thread.messages.length === 0 || (thread.messages.length === 1 && thread.messages[0].id === 'last-message')) && (
            <p className="text-sm text-gray-500 text-center">No messages yet. Say hi to start the conversation.</p>
          )}
          {thread.messages
            .filter(msg => msg.id !== 'last-message') // Filter out placeholder message
            .map((msg) => {
            const isSelf = msg.senderId === user._id
            const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            return (
              <div key={msg.id} className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
                <div className="flex items-end space-x-2 max-w-[92%] sm:max-w-[85%] group">
                  {!isSelf && (
                    <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center text-primary-700 text-xs border border-primary-100 shadow-inner">
                      {otherParty?.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                  <div
                    className={`min-w-0 max-w-full sm:max-w-md px-4 py-3 rounded-2xl text-sm shadow-sm border ${
                      isSelf
                        ? msg.readAt
                          ? 'bg-primary-500/90 text-white rounded-br-none border-primary-400/60'
                          : 'bg-primary-600 text-white rounded-br-none border-primary-500/60 shadow-primary/20'
                        : 'bg-white border-gray-200 text-gray-900 rounded-bl-none'
                    }`}
                  >
                    {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                      <div className={msg.text ? 'mb-2' : ''}>
                        <ChatAttachments
                          attachments={msg.attachments}
                          isTemp={String(msg.id).startsWith('temp-')}
                        />
                      </div>
                    )}
                    {msg.text ? (
                      <ChatMessageRichContent text={msg.text} bubbleVariant={isSelf ? 'primary' : 'neutral'} />
                    ) : null}
                    <span className={`block text-[11px] mt-1 flex items-center justify-end gap-1 ${isSelf ? (msg.readAt ? 'text-white/90' : 'text-white/80') : 'text-gray-400'}`}>
                      <span>{time}</span>
                      {isSelf && (
                        msg.readAt ? (
                          <CheckCheck className="h-3.5 w-3.5 flex-shrink-0 text-white/90" aria-label="Read" title="Read" />
                        ) : (
                          <Check className="h-3.5 w-3.5 flex-shrink-0 text-white/80" aria-label="Sent" title="Sent" />
                        )
                      )}
                    </span>
                  </div>
                  {isSelf && (
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="h-8 w-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-xs border border-red-100 shadow-inner hover:bg-red-100 transition-colors"
                        title="Delete message"
                        disabled={!msg.id || msg.id === 'last-message' || msg.id?.startsWith('temp-')}
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                      <div className="h-8 w-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs border border-primary-200 shadow-inner">
                        You
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-gray-200 px-4 sm:px-6 py-4 bg-white rounded-b-2xl mt-auto">
          {pendingFiles.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {pendingFiles.map((item, i) => {
                const { kind, previewUrl, file } = item
                return (
                  <div key={i} className="relative h-20 w-20 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                    {kind === 'image' && (
                      <img src={previewUrl} alt={file.name} className="h-full w-full object-cover" />
                    )}
                    {kind === 'video' && (
                      <>
                        <video src={previewUrl} className="h-full w-full bg-black object-cover" muted playsInline preload="metadata" />
                        <span className="absolute inset-0 flex items-center justify-center">
                          <Play className="h-6 w-6 text-white drop-shadow" fill="currentColor" />
                        </span>
                      </>
                    )}
                    {kind === 'file' && (
                      <div className="flex h-full w-full flex-col items-center justify-center p-1 text-center">
                        <FileText className="h-6 w-6 text-gray-400" />
                        <span className="mt-1 w-full truncate px-1 text-[9px] text-gray-500">{file.name}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removePendingFile(i)}
                      className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                      aria-label="Remove attachment"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
          <div className="flex items-end space-x-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={handleFilesSelected}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-300 text-gray-500 hover:bg-gray-50 hover:text-primary-600"
              title="Attach photo or video"
              aria-label="Attach photo or video"
            >
              <Paperclip className="h-5 w-5" />
            </button>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Write a message..."
              className="flex-1 resize-none border border-gray-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50"
            />
            <button
              onClick={handleSend}
              disabled={(!message.trim() && pendingFiles.length === 0) || sending}
              className="btn-primary inline-flex items-center justify-center h-11 px-4 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Send className="h-4 w-4 mr-2" />
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChatThreadPage
