import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, MessageCircle, Send, ShieldCheck, Clock, Sparkles, Tags, ImageIcon, Info, Trash2, XCircle, Check, CheckCheck } from 'lucide-react'
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { selectIsAuthenticated, selectUser } from '@shared/store/slices/authSlice'
import { useChat } from '@shared/components/Chat/ChatContext'
import ChatMessageRichContent from '@shared/components/Chat/ChatMessageRichContent'
import { getMediaUrl } from '@shared/utils/helpers'
import { getSocket } from '@shared/services/socket'
import { chatService } from '@shared/services/api'

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
  const bottomRef = useRef(null)

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
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
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

  const handleSend = async () => {
    if (!message.trim() || !thread) return
    const msg = message.trim()
    setMessage('') // Clear input immediately for better UX
    
    // Optimistically add message to UI
    const tempMessage = {
      id: `temp-${Date.now()}`,
      senderId: user._id,
      senderRole: viewerRole,
      text: msg,
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
      })
      // Thread will be synced from context via the useEffect above
    } catch (err) {
      // On error, remove temp message and restore input
      setMessage(msg)
      setThread((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          messages: prev.messages.filter(m => m.id !== tempMessage.id),
        }
      })
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
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center space-x-2 text-xs text-gray-600 bg-white px-3 py-2 rounded-full shadow-sm border border-gray-100">
            <ShieldCheck className="h-4 w-4 text-primary-500" />
            <span>Stay safe: communicate in-app</span>
          </div>
          <div className="inline-flex items-center space-x-2 text-xs text-gray-600 bg-white px-3 py-2 rounded-full shadow-sm border border-gray-100">
            <Sparkles className="h-4 w-4 text-primary-500" />
            <span>Tip: reply quickly for better conversions</span>
          </div>
        </div>
      </div>

      <div className="bg-white/95 backdrop-blur rounded-2xl shadow-xl border border-gray-100 flex flex-col h-[75vh] overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-gray-100 bg-gradient-to-r from-primary-50/60 via-white to-white">
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center">
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
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Listing</p>
              <p className="text-sm font-semibold text-gray-900">{thread.productTitle}</p>
              <p className="text-xs text-gray-500">With {otherParty?.name || 'User'}</p>
            </div>
          </div>
            <div className="flex items-center gap-2">
              <div className="text-[11px] text-gray-500 bg-white px-3 py-2 rounded-full border border-gray-100">
                Thread ID: {thread.id}
              </div>
              <button
                onClick={handleDeleteChat}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-full hover:bg-red-100"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 bg-gradient-to-b from-gray-50/80 via-white to-white">
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
                <div className="flex items-end space-x-2 max-w-full group">
                  {!isSelf && (
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center text-primary-700 text-xs border border-primary-100 shadow-inner">
                      {otherParty?.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                  <div
                    className={`max-w-xs sm:max-w-md px-4 py-3 rounded-2xl text-sm shadow-sm border ${
                      isSelf
                        ? msg.readAt
                          ? 'bg-primary-500/90 text-white rounded-br-none border-primary-400/60'
                          : 'bg-primary-600 text-white rounded-br-none border-primary-500/60 shadow-primary/20'
                        : 'bg-white border-gray-200 text-gray-900 rounded-bl-none'
                    }`}
                  >
                    <ChatMessageRichContent text={msg.text} bubbleVariant={isSelf ? 'primary' : 'neutral'} />
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
          <div className="flex items-end space-x-3">
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
              disabled={!message.trim()}
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
