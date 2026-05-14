import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, RefreshCw } from 'lucide-react'
import { chatService } from '../../services/api'

function timeAgo(value) {
  if (!value) return ''
  const d = new Date(value)
  const sec = Math.max(1, Math.floor((Date.now() - d.getTime()) / 1000))
  const min = Math.floor(sec / 60)
  const hr = Math.floor(min / 60)
  const day = Math.floor(hr / 24)
  if (day > 0) return `${day}d`
  if (hr > 0) return `${hr}h`
  if (min > 0) return `${min}m`
  return `${sec}s`
}

export default function DashboardMessagesPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [chats, setChats] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [activeLoading, setActiveLoading] = useState(false)
  const [activeMessages, setActiveMessages] = useState([])
  const [activeChat, setActiveChat] = useState(null)

  const loadChats = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await chatService.getChats()
      const items = res?.data || []
      setChats(items)
      if (!activeId && items[0]?._id) setActiveId(items[0]._id)
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load conversations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadChats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!activeId) return
    let cancelled = false
    setActiveLoading(true)
    chatService
      .getChatById(activeId)
      .then((res) => {
        if (cancelled) return
        setActiveChat(res.data.chat)
        setActiveMessages(res.data.messages || [])
      })
      .catch((e) => {
        if (cancelled) return
        setError(e?.response?.data?.message || 'Failed to load chat')
      })
      .finally(() => {
        if (cancelled) return
        setActiveLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeId])

  const activeTitle = useMemo(() => {
    if (!activeChat) return 'Conversation'
    if (activeChat.type === 'support') return 'Support'
    // Try to infer the other party name from populated fields
    const buyer = activeChat.buyer
    const seller = activeChat.seller
    return buyer?.name || seller?.name || 'Conversation'
  }, [activeChat])

  return (
    <div className="space-y-5">
      <div>
        <div className="text-sm text-gray-500 dark:text-gray-400">Chat</div>
        <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">Messages</div>
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">This view is dynamic and pulls from `/api/chats`.</div>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-900 bg-white dark:bg-gray-950 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr]">
          {/* Left: conversation list */}
          <div className="border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-900">
            <div className="p-4 flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Conversations</div>
              <button
                type="button"
                onClick={loadChats}
                className="inline-flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:text-primary-600"
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-900">
              {loading ? (
                <div className="p-4 text-sm text-gray-600 dark:text-gray-300">Loading…</div>
              ) : error ? (
                <div className="p-4 text-sm text-red-700 bg-red-50">{error}</div>
              ) : chats.length === 0 ? (
                <div className="p-6 text-sm text-gray-600 dark:text-gray-300">
                  No conversations yet. Use <Link to="/chat" className="text-primary-700 dark:text-primary-300 font-medium">Chat</Link> to start one.
                </div>
              ) : (
                chats.map((c) => (
                  <button
                    key={c._id}
                    type="button"
                    onClick={() => setActiveId(c._id)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-900 ${
                      c._id === activeId ? 'bg-primary-50 dark:bg-gray-900' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {c.type === 'support'
                          ? 'Support'
                          : c.product?.title
                          ? c.product.title
                          : 'Product chat'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{timeAgo(c.lastMessageAt)}</div>
                    </div>
                    <div className="mt-1 text-sm text-gray-600 dark:text-gray-300 truncate">{c.lastMessage || 'No messages yet'}</div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right: chat window */}
          <div className="min-h-[420px] flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-900 flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{activeTitle}</div>
              {activeId ? (
                <Link to={`/chat/${activeId}`} className="ml-auto text-xs font-medium text-primary-700 dark:text-primary-300 hover:underline">
                  Open full chat
                </Link>
              ) : null}
            </div>

            <div className="flex-1 p-4 space-y-3 bg-gray-50 dark:bg-black">
              {activeLoading ? (
                <div className="text-sm text-gray-600 dark:text-gray-300">Loading messages…</div>
              ) : activeMessages.length === 0 ? (
                <div className="text-sm text-gray-600 dark:text-gray-300">No messages yet.</div>
              ) : (
                activeMessages.map((m) => (
                  <div
                    key={m._id}
                    className="max-w-[80%] rounded-2xl bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-900 px-4 py-3 text-sm text-gray-800 dark:text-gray-200"
                  >
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {m.sender?.name || 'User'} • {timeAgo(m.createdAt)}
                    </div>
                    <div className="mt-1 whitespace-pre-wrap">{m.text}</div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-gray-200 dark:border-gray-900">
              <div className="flex gap-2">
                <input
                  className="input-field flex-1 dark:bg-gray-950 dark:text-gray-100 dark:border-gray-900"
                  placeholder="Use the full chat view to send messages"
                  disabled
                />
                <button className="btn-primary px-4" disabled>
                  Send
                </button>
              </div>
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                This dashboard page is read-only. Sending is enabled in the full chat page.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

