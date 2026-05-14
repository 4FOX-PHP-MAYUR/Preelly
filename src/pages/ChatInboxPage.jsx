import { MessageCircle, Inbox as InboxIcon, ChevronRight, Sparkles, Clock } from 'lucide-react'
import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate, Link } from 'react-router-dom'
import { selectUser, selectIsAuthenticated } from '../store/slices/authSlice'
import { useChat } from '../components/Chat/ChatContext'

function ChatInboxPage() {
  const navigate = useNavigate()
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const user = useSelector(selectUser)
  const { listThreadsForUser } = useChat()

  const threads = useMemo(() => {
    if (!user) return []
    return listThreadsForUser(user._id)
  }, [listThreadsForUser, user])

  const summary = useMemo(() => {
    const unread = threads.reduce((sum, t) => {
      const isBuyer = t.buyer?.id != null && String(t.buyer.id) === String(user?._id)
      return sum + (isBuyer ? (t.unreadForBuyer || 0) : (t.unreadForSeller || 0))
    }, 0)
    const active = threads.length
    const lastUpdated = threads[0]?.updatedAt
    return {
      unread,
      active,
      lastUpdated,
    }
  }, [threads, user?._id])

  if (!isAuthenticated) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center bg-white rounded-lg shadow">
        <InboxIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Chat Inbox</h1>
        <p className="text-gray-600 mb-6">Please log in to view your chats with buyers and sellers.</p>
        <Link to="/login" className="btn-primary inline-flex items-center">
          Go to Login
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary-600 via-primary-500 to-primary-400 text-white shadow-lg mb-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.15),_transparent_35%)]" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-5">
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 rounded-2xl bg-white/15 flex items-center justify-center border border-white/20">
              <MessageCircle className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Chat Inbox</h1>
              <p className="text-sm text-white/80">Conversations with buyers and sellers</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-xs sm:text-sm bg-white/10 px-3 py-2 rounded-full backdrop-blur border border-white/20">
            <Sparkles className="h-4 w-4" />
            <span>Reply fast to boost conversions</span>
          </div>
        </div>
        <div className="relative grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/15 border-t border-white/15">
          <StatPill label="Active chats" value={summary.active} />
          <StatPill label="Unread" value={summary.unread} />
          <StatPill
            label="Last update"
            value={summary.lastUpdated ? new Date(summary.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
          />
        </div>
      </div>

      {threads.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center shadow-sm">
          <InboxIcon className="h-10 w-10 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">No conversations yet</h2>
          <p className="text-gray-600 mb-4">Start a chat from any product page to connect with sellers.</p>
          <Link to="/" className="btn-primary inline-flex items-center">
            Browse Products
          </Link>
          <p className="text-xs text-gray-500 mt-4">Your messages stay private and synced on this device.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-lg divide-y divide-gray-100 border border-gray-100">
          {threads.map((thread) => {
            // Get last message - filter out the placeholder "last-message" if there are real messages
            const realMessages = thread.messages.filter(m => m.id !== 'last-message')
            const lastMessage = realMessages.length > 0 
              ? realMessages[realMessages.length - 1] 
              : thread.messages[thread.messages.length - 1]
            const isBuyer = thread.buyer?.id != null && String(thread.buyer.id) === String(user?._id)
            const otherParty = isBuyer ? thread.seller : thread.buyer
            const unread = isBuyer ? (thread.unreadForBuyer || 0) : (thread.unreadForSeller || 0)
            const avatarLetter = (otherParty?.name || 'U').trim().charAt(0).toUpperCase()
            const lastTime = lastMessage?.createdAt ? new Date(lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null

            return (
              <button
                key={thread.id}
                onClick={() => navigate(`/chat/${thread.id}`)}
                className="w-full text-left px-4 sm:px-6 py-4 hover:bg-primary-50/60 transition-colors flex items-center"
              >
                {otherParty?.image ? (
                  <img
                    src={otherParty.image}
                    alt={otherParty.name || 'User'}
                    className="h-12 w-12 rounded-full object-cover mr-4 flex-shrink-0"
                  />
                ) : (
                  <div className="relative mr-4 flex-shrink-0">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center text-primary-700 text-sm font-semibold border border-primary-100 shadow-inner">
                      {avatarLetter || <MessageCircle className="h-5 w-5" />}
                    </div>
                    <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-white border border-primary-100 text-[10px] flex items-center justify-center text-primary-700">
                      {isBuyer ? 'B' : 'S'}
                    </span>
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm text-gray-500 truncate">
                      {thread.productTitle} · {otherParty?.name || 'User'}
                    </p>
                    <div className="flex items-center space-x-3">
                      {lastTime && (
                        <span className="inline-flex items-center text-xs text-gray-400">
                          <Clock className="h-3 w-3 mr-1" />
                          {lastTime}
                        </span>
                      )}
                      {unread > 0 && (
                        <span className="inline-flex items-center justify-center h-6 px-2 rounded-full bg-primary-100 text-primary-800 text-xs font-semibold">
                          {unread} new
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                  <p className="text-gray-900 font-semibold truncate">{lastMessage?.text || 'No messages yet'}</p>
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    {lastMessage ? new Date(lastMessage.createdAt).toLocaleString() : 'Thread created'}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ChatInboxPage

function StatPill({ label, value }) {
  return (
    <div className="px-6 py-3 flex items-center justify-between sm:justify-center sm:flex-col sm:items-start text-sm text-white/80">
      <span>{label}</span>
      <span className="text-lg sm:text-xl font-semibold text-white">{value}</span>
    </div>
  )
}
