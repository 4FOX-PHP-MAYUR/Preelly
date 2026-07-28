import { createContext, useCallback, useContext, useEffect, useMemo, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { chatService } from '../../services/api'
import { useDispatch, useSelector } from 'react-redux'
import { selectIsAuthenticated, selectUser } from '../../store/slices/authSlice'
import { getMediaUrl } from '../../utils/helpers'
import { getSocket, disconnectSocket, setSocketUserId } from '../../services/socket'

const ChatContext = createContext(undefined)

// Transform backend chat format to frontend format
const transformChat = (chat, messages = [], meId = null) => {
  const isSupport = chat.type === 'support'
  const isGroup = chat.type === 'group'

  let productImage = ''
  if (!isSupport && chat.product) {
    if (chat.product.video) productImage = getMediaUrl(chat.product.video) || ''
    else if (chat.product.images?.length) productImage = getMediaUrl(chat.product.images[0]) || ''
    else if (typeof chat.product.image === 'string' && chat.product.image.startsWith('http')) productImage = chat.product.image
  }

  if (isGroup) {
    const participants = (chat.participants || []).map((p) => ({
      id: (typeof p === 'object' ? p._id : p) || null,
      name: p?.name || p?.username || 'User',
      avatar: p?.avatar ? getMediaUrl(p.avatar) || p.avatar : null,
    }))
    const meKey = meId ? String(meId) : null
    const unread = meKey ? Number(chat.unreadFor?.[meKey] || 0) : 0
    const groupName = chat.name || 'Group'
    return {
      id: chat._id || chat.id,
      type: 'group',
      isGroup: true,
      groupName,
      groupAvatar: chat.groupAvatar || '',
      participants,
      productId: chat.product && typeof chat.product === 'object' ? chat.product._id : chat.product,
      productTitle: chat.product?.title || '',
      productImage,
      productSold: Boolean(chat.product?.isSold) || chat.product?.status === 'sold',
      // Keep buyer/seller shape as no-ops so existing 1:1 helpers stay null-safe.
      buyer: { id: null, name: groupName },
      seller: { id: null, name: groupName },
      messages: (messages || []).map(transformMessage),
      updatedAt: chat.lastMessageAt || chat.updatedAt || new Date().toISOString(),
      lastMessage: chat.lastMessage || '',
      unreadForBuyer: 0,
      unreadForSeller: 0,
      unreadForMe: unread,
      muted: Boolean(chat.muted),
    }
  }

  let transformedMessages = (messages || []).map(transformMessage)
  if (transformedMessages.length === 0 && chat.lastMessage && (!messages || messages.length === 0)) {
    transformedMessages = [{
      id: 'last-message',
      senderId: null,
      senderRole: null,
      text: chat.lastMessage,
      createdAt: chat.lastMessageAt || chat.updatedAt || new Date().toISOString(),
    }]
  }

  if (isSupport) {
    const userObj = chat.user
    const customerId = typeof userObj === 'object' ? userObj._id : userObj
    const customerName = userObj?.name || userObj?.username || 'Customer'
    return {
      id: chat._id || chat.id,
      type: 'support',
      productId: null,
      productTitle: 'Support',
      productImage: '',
      buyer: { id: customerId, name: customerName },
      seller: { id: 'support', name: 'Support' },
      messages: transformedMessages,
      updatedAt: chat.lastMessageAt || chat.updatedAt || new Date().toISOString(),
      lastMessage: chat.lastMessage || '',
      unreadForBuyer: chat.unreadForUser || 0,
      unreadForSeller: chat.unreadForAdmin || 0,
    }
  }

  const productRef = chat.product && typeof chat.product === 'object' ? chat.product._id : chat.product
  const buyerRef = chat.buyer && typeof chat.buyer === 'object' ? chat.buyer._id : chat.buyer
  const sellerRef = chat.seller && typeof chat.seller === 'object' ? chat.seller._id : chat.seller

  return {
    id: chat._id || chat.id,
    productId: productRef,
    productTitle: chat.product?.title || '',
    productImage,
    // Sold products can no longer be chatted about / offered on.
    productSold: Boolean(chat.product?.isSold) || chat.product?.status === 'sold',
    buyer: {
      id: buyerRef || null,
      name: chat.buyer?.name || chat.buyer?.username || 'Buyer',
    },
    seller: {
      id: sellerRef || null,
      name: chat.seller?.name || chat.seller?.username || 'Seller',
    },
    messages: transformedMessages,
    updatedAt: chat.lastMessageAt || chat.updatedAt || new Date().toISOString(),
    lastMessage: chat.lastMessage || '',
    unreadForBuyer: chat.unreadForBuyer || 0,
    unreadForSeller: chat.unreadForSeller || 0,
    muted: Boolean(chat.muted),
    // Block state of this 1:1 thread, relative to the viewer.
    blockedByMe: Boolean(chat.blockedByMe),
    blockedMe: Boolean(chat.blockedMe),
  }
}

// Transform backend message format to frontend format
const transformMessage = (message) => {
  const senderObj = typeof message.sender === 'object' ? message.sender : null
  const senderId = senderObj ? senderObj._id : message.sender
  return {
    id: message._id || message.id,
    senderId: senderId,
    senderName: senderObj?.name || senderObj?.username || null,
    senderAvatar: senderObj?.avatar ? getMediaUrl(senderObj.avatar) || senderObj.avatar : null,
    senderRole: message.senderRole || null,
    type: message.type || 'text',
    callMeta: message.callMeta || null,
    text: message.text || '',
    // A text message serializes with an empty `attachment: {}` subdoc; only treat
    // an attachment as real when it actually has a url, else a stray file icon shows.
    attachment: message.attachment?.url ? message.attachment : null,
    attachments: (() => {
      const list = (message.attachments || []).filter((a) => a && a.url)
      if (list.length > 0) return list
      return message.attachment?.url ? [message.attachment] : []
    })(),
    createdAt: message.createdAt || new Date().toISOString(),
    read: message.read || false,
    readAt: message.readAt || null,
  }
}

export function ChatProvider({ children }) {
  const [threads, setThreads] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const user = useSelector(selectUser)
  const dispatch = useDispatch()
  const location = useLocation()
  const socketRef = useRef(null)

  // Initialize Socket.io connection
  useEffect(() => {
    if (isAuthenticated && user?._id) {
      const socket = getSocket()
      socketRef.current = socket
      setSocketUserId(user._id)

      // Join user's personal room to receive messages
      socket.emit('join-user', user._id)

      // Listen for new messages
      socket.on('new-message', (data) => {
        const { chatId, message, isOwnMessage } = data

        if (!chatId || !message) {
          console.warn('Invalid message data received:', data)
          return
        }

        // Transform message to frontend format
        const senderId = typeof message.sender === 'object' && message.sender._id
          ? message.sender._id
          : typeof message.sender === 'object' && message.sender.id
          ? message.sender.id
          : message.sender

        const senderObj = typeof message.sender === 'object' ? message.sender : null
        const transformedMessage = {
          id: message._id || message.id,
          senderId: senderId,
          senderName: senderObj?.name || senderObj?.username || null,
          senderAvatar: senderObj?.avatar ? getMediaUrl(senderObj.avatar) || senderObj.avatar : null,
          senderRole: null,
          type: message.type || 'text',
          callMeta: message.callMeta || null,
          text: message.text || '',
          attachment: message.attachment?.url ? message.attachment : null,
          attachments: (message.attachments || []).filter((a) => a?.url).length
            ? (message.attachments || []).filter((a) => a?.url)
            : (message.attachment?.url ? [message.attachment] : []),
          createdAt: message.createdAt || new Date().toISOString(),
          read: message.read || false,
          readAt: message.readAt || null,
        }

        // Update threads with new message
        setThreads((prev) => {
          const threadIndex = prev.findIndex((thread) => thread.id === chatId)
          
          if (threadIndex === -1) {
            // Thread not in local state yet - fetch it from backend
            // This can happen if user receives a message for a thread they haven't loaded
            chatService.getChatById(chatId)
              .then((response) => {
                const { chat, messages } = response.data
                const transformedChat = transformChat(chat, messages || [], user?._id)
                if (!transformedChat.isGroup) {
                  transformedChat.messages = transformedChat.messages.map(msg => ({
                    ...msg,
                    senderRole: msg.senderId === transformedChat.buyer.id ? 'buyer' : 'seller',
                  }))
                }

                setThreads((current) => {
                  const exists = current.find(t => t.id === chatId)
                  if (exists) return current
                  return [transformedChat, ...current]
                })
              })
              .catch((err) => {
                console.error('Error fetching thread for new message:', err)
              })
            
            return prev // Return unchanged for now
          }

          const thread = prev[threadIndex]

          // Check if message already exists (avoid duplicates)
          const messageExists = thread.messages.some((m) => m.id === transformedMessage.id)
          if (messageExists) return prev

          if (thread.isGroup) {
            const updated = [...prev]
            updated[threadIndex] = {
              ...thread,
              messages: [...thread.messages, transformedMessage],
              updatedAt: transformedMessage.createdAt,
              lastMessage: message.text,
              unreadForMe: !isOwnMessage ? (thread.unreadForMe || 0) + 1 : thread.unreadForMe,
            }
            const [updatedThread] = updated.splice(threadIndex, 1)
            return [updatedThread, ...updated]
          }

          // Determine sender role
          transformedMessage.senderRole =
            transformedMessage.senderId === thread.buyer.id ? 'buyer' : 'seller'

          const updated = [...prev]
          updated[threadIndex] = {
            ...thread,
            messages: [...thread.messages, transformedMessage],
            updatedAt: transformedMessage.createdAt,
            lastMessage: message.text, // Update last message for inbox
            // Only update unread if it's not our own message
            unreadForBuyer:
              !isOwnMessage && transformedMessage.senderRole === 'seller'
                ? (thread.unreadForBuyer || 0) + 1
                : thread.unreadForBuyer,
            unreadForSeller:
              !isOwnMessage && transformedMessage.senderRole === 'buyer'
                ? (thread.unreadForSeller || 0) + 1
                : thread.unreadForSeller,
          }

          // Move updated thread to top (most recent)
          const [updatedThread] = updated.splice(threadIndex, 1)
          return [updatedThread, ...updated]
        })
      })

      socket.on('messages-read', (data) => {
        const { chatId: readChatId } = data || {}
        if (!readChatId || !user?._id) return
        const now = new Date().toISOString()
        setThreads((prev) =>
          prev.map((thread) => {
            if (thread.id !== readChatId) return thread
            return {
              ...thread,
              messages: (thread.messages || []).map((m) =>
                m.senderId === user._id ? { ...m, read: true, readAt: m.readAt || now } : m
              ),
            }
          })
        )
      })

      return () => {
        socket.off('new-message')
        socket.off('messages-read')
      }
    } else {
      // Disconnect socket when not authenticated
      if (socketRef.current) {
        disconnectSocket()
        socketRef.current = null
      }
    }
  }, [isAuthenticated, user?._id])

  // Load chats from backend
  const loadChats = useCallback(async () => {
    if (!isAuthenticated) {
      setThreads([])
      return
    }

    try {
      setLoading(true)
      setError(null)
      // Only load chat threads when user is actually on chat routes.
      // This avoids heavy `/api/feed-data?includeChats=1` requests on every page load.
      const isChatRoute =
        location?.pathname?.startsWith('/chat') ||
        location?.pathname?.startsWith('/dashboard/messages')
      if (!isChatRoute) {
        setThreads([])
        return
      }

      const res = await chatService.getChats()
      const chats = res?.data?.chats || res?.data || []
      
      // Transform chats - we don't load all messages for inbox, just the thread info.
      // Preserve any messages already loaded for a thread so re-running loadChats (e.g.
      // on navigation) doesn't wipe the open conversation back to an empty inbox row.
      const transformedChats = (Array.isArray(chats) ? chats : []).map(chat => transformChat(chat, [], user?._id))
      setThreads((prev) => {
        const realCount = (msgs) =>
          (msgs || []).filter(m => m.id !== 'last-message' && !String(m.id).startsWith('temp-')).length
        return transformedChats.map((nt) => {
          const existing = prev.find(p => p.id === nt.id)
          if (existing && realCount(existing.messages) > realCount(nt.messages)) {
            return { ...nt, messages: existing.messages }
          }
          return nt
        })
      })
    } catch (err) {
      console.error('Error loading chats:', err)
      setError(err.response?.data?.message || 'Failed to load chats')
      setThreads([])
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, location?.pathname, user?._id])

  // Load chats on mount and when authentication changes
  useEffect(() => {
    loadChats()
  }, [loadChats])

  const createOrGetThread = useCallback(async ({ product, buyer, seller }) => {
    if (!product?.id || !buyer?.id || !seller?.id) return null

    try {
      const productId = typeof product === 'object' ? product.id : product
      const sellerId = typeof seller === 'object' ? seller.id : seller

      const response = await chatService.createOrGetChat(productId, sellerId)
      const { chat, messages } = response.data

      const transformedChat = transformChat(chat, messages, user?._id)

      // Determine senderRole for messages by comparing with buyer/seller
      if (!transformedChat.isGroup) {
        transformedChat.messages = transformedChat.messages.map(msg => ({
          ...msg,
          senderRole: msg.senderId === transformedChat.buyer.id ? 'buyer' : 'seller',
        }))
      }

      // Update threads list
      setThreads((prev) => {
        const existingIndex = prev.findIndex((t) => t.id === transformedChat.id)
        if (existingIndex >= 0) {
          // Update existing thread with messages
          const updated = [...prev]
          updated[existingIndex] = transformedChat
          return updated
        }
        // Add new thread at the beginning
        return [transformedChat, ...prev]
      })

      return transformedChat
    } catch (err) {
      console.error('Error creating/getting thread:', err)
      setError(err.response?.data?.message || 'Failed to create chat')
      return null
    }
  }, [])

  const sendMessage = useCallback(async (threadId, { senderId, senderRole, text, files, file }) => {
    const fileList = files || (file ? [file] : [])
    if (!threadId || (!text?.trim() && fileList.length === 0)) return null

    try {
      const response = await chatService.sendMessage(threadId, text?.trim() || '', fileList.length > 0 ? fileList : null)
      const message = response.data

      // Transform message
      const transformedMessage = {
        id: message._id || message.id,
        senderId: typeof message.sender === 'object' ? message.sender._id : message.sender,
        senderRole: senderRole,
        type: message.type || 'text',
        text: message.text,
        attachment: message.attachment?.url ? message.attachment : null,
        attachments: (message.attachments || []).filter((a) => a?.url).length
          ? (message.attachments || []).filter((a) => a?.url)
          : (message.attachment?.url ? [message.attachment] : []),
        createdAt: message.createdAt || new Date().toISOString(),
        read: message.read || false,
        readAt: message.readAt || null,
      }

      // Remove any temp messages
      setThreads((prev) =>
        prev.map((thread) => {
          if (thread.id !== threadId) return thread
          
          // Remove temp messages and ensure this message is present (socket might have already added it)
          const filteredMessages = thread.messages.filter(m => !m.id.startsWith('temp-'))
          const messageExists = filteredMessages.some(m => m.id === transformedMessage.id)
          
          return {
            ...thread,
            messages: messageExists ? filteredMessages : [...filteredMessages, transformedMessage],
            updatedAt: transformedMessage.createdAt,
            // Unread counts are updated by socket event, so don't double-count
            // unreadForBuyer: senderRole === 'seller' ? thread.unreadForBuyer + 1 : thread.unreadForBuyer,
            // unreadForSeller: senderRole === 'buyer' ? thread.unreadForSeller + 1 : thread.unreadForSeller,
          }
        })
      )

      return transformedMessage
    } catch (err) {
      console.error('Error sending message:', err)
      setError(err.response?.data?.message || 'Failed to send message')

      const blocked = err.response?.status === 403 && err.response?.data?.blocked

      // Remove temp message on error
      setThreads((prev) =>
        prev.map((thread) => {
          if (thread.id !== threadId) return thread
          return {
            ...thread,
            messages: thread.messages.filter(m => !m.id.startsWith('temp-')),
            // The block may have happened while this thread was open — sync it so
            // the composer locks immediately.
            ...(blocked
              ? {
                  blockedByMe: Boolean(err.response.data.blockedByMe),
                  blockedMe: Boolean(err.response.data.blockedMe),
                }
              : {}),
          }
        })
      )

      // Blocked sends must surface to the caller so it can lock the UI.
      if (blocked) throw err

      return null
    }
  }, [])

  const markThreadRead = useCallback(async (threadId, viewerRole) => {
    if (!threadId || !viewerRole) return

    try {
      // Update local state optimistically first
      setThreads((prev) =>
        prev.map((thread) => {
          if (thread.id !== threadId) return thread
          if (thread.isGroup || viewerRole === 'group') {
            if (!thread.unreadForMe) return thread
            return { ...thread, unreadForMe: 0 }
          }
          if (viewerRole === 'buyer' && thread.unreadForBuyer === 0) return thread
          if (viewerRole === 'seller' && thread.unreadForSeller === 0) return thread
          return {
            ...thread,
            unreadForBuyer: viewerRole === 'buyer' ? 0 : thread.unreadForBuyer,
            unreadForSeller: viewerRole === 'seller' ? 0 : thread.unreadForSeller,
          }
        })
      )

      // Mark as read in DB and sync badge immediately (no refresh dependency)
      await chatService.markAsRead(threadId)
    } catch (err) {
      if (err.code !== 'ERR_INSUFFICIENT_RESOURCES' && err.code !== 'ERR_NETWORK') {
        console.error('Error marking thread as read:', err)
      }
    }
  }, [])

  const deleteThread = useCallback(async (threadId) => {
    if (!threadId) return false

    try {
      await chatService.deleteChat(threadId)
      setThreads((prev) => prev.filter((thread) => thread.id !== threadId))
      return true
    } catch (err) {
      console.error('Error deleting chat:', err)
      setError(err.response?.data?.message || 'Failed to delete chat')
      return false
    }
  }, [])

  const deleteMessage = useCallback(async (threadId, messageId) => {
    if (!threadId || !messageId) return false

    try {
      const response = await chatService.deleteMessage(threadId, messageId)
      const updatedChat = response.data?.chat

      setThreads((prev) =>
        prev.map((thread) => {
          if (thread.id !== threadId) return thread
          const filteredMessages = thread.messages.filter((m) => m.id !== messageId)

          return {
            ...thread,
            messages: filteredMessages,
            lastMessage: updatedChat?.lastMessage ?? thread.lastMessage,
            updatedAt: updatedChat?.lastMessageAt ?? thread.updatedAt,
            unreadForBuyer: updatedChat?.unreadForBuyer ?? thread.unreadForBuyer,
            unreadForSeller: updatedChat?.unreadForSeller ?? thread.unreadForSeller,
          }
        })
      )

      return true
    } catch (err) {
      console.error('Error deleting message:', err)
      setError(err.response?.data?.message || 'Failed to delete message')
      return false
    }
  }, [])

  const getThreadById = useCallback(
    async (threadId) => {
      if (!threadId) return null

      // Always fetch from backend to get latest messages
      // Local state might be stale, especially after refresh
      try {
        const response = await chatService.getChatById(threadId)
        const { chat, messages } = response.data

        const transformedChat = transformChat(chat, messages || [], user?._id)

        // Determine senderRole for messages
        if (!transformedChat.isGroup) {
          transformedChat.messages = transformedChat.messages.map(msg => ({
            ...msg,
            senderRole: msg.senderId === transformedChat.buyer.id ? 'buyer' : 'seller',
          }))
        }

        // Update threads list - use functional update to avoid stale closure
        setThreads((prev) => {
          const existingIndex = prev.findIndex((t) => t.id === transformedChat.id)
          if (existingIndex >= 0) {
            const updated = [...prev]
            updated[existingIndex] = transformedChat
            return updated
          }
          return [transformedChat, ...prev]
        })

        return transformedChat
      } catch (err) {
        console.error('Error fetching thread:', err)
        // Only set error if it's not a network/resource error to avoid infinite loops
        if (err.code !== 'ERR_INSUFFICIENT_RESOURCES' && err.code !== 'ERR_NETWORK') {
          setError(err.response?.data?.message || 'Failed to load chat')
        }
        // Fallback to local thread if available
        const localThread = threads.find((thread) => thread.id === threadId)
        return localThread || null
      }
    },
    [threads]
  )

  const listThreadsForUser = useCallback(
    (userId) => {
      if (!userId) return []
      const uid = String(userId)
      return threads
        .filter((thread) => {
          if (thread.isGroup) {
            return (thread.participants || []).some((p) => String(p.id) === uid)
          }
          const buyerId = thread.buyer?.id != null ? String(thread.buyer.id) : null
          const sellerId = thread.seller?.id != null ? String(thread.seller.id) : null
          return buyerId === uid || sellerId === uid
        })
        .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
    },
    [threads]
  )

  const value = useMemo(
    () => ({
      threads,
      loading,
      error,
      createOrGetThread,
      sendMessage,
      markThreadRead,
      getThreadById,
      listThreadsForUser,
      deleteThread,
      deleteMessage,
      refreshChats: loadChats,
    }),
    [threads, loading, error, createOrGetThread, sendMessage, markThreadRead, getThreadById, listThreadsForUser, deleteThread, deleteMessage, loadChats]
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export const useChat = () => {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider')
  }
  return context
}
