import { useEffect, useMemo, useState } from 'react'
import { Search, User, X, Check, Link as LinkIcon, MessageCircle, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { chatService, userService } from '@shared/services/api'
import { getMediaUrl } from '@shared/utils/helpers'
import { buildReelShareText, buildReelShareUrl, shareReelToInstagram } from '@shared/utils/reelShare'

function ReelShareModal({ isOpen, onClose, product, userId }) {
  const [loading, setLoading] = useState(false)
  const [shareUsers, setShareUsers] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState(new Set())
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!isOpen || !userId) return

    let isMounted = true
    const loadPeople = async () => {
      try {
        setLoading(true)
        const [followersRes, followingRes] = await Promise.all([
          userService.getFollowers(userId),
          userService.getFollowing(userId),
        ])

        if (!isMounted) return

        const followers = Array.isArray(followersRes?.data?.followers) ? followersRes.data.followers : []
        const following = Array.isArray(followingRes?.data?.following) ? followingRes.data.following : []

        const userMap = new Map()

        followers.forEach((person) => {
          if (!person?._id || String(person._id) === String(userId)) return
          userMap.set(String(person._id), {
            ...person,
            isFollower: true,
            isFollowing: false,
          })
        })

        following.forEach((person) => {
          if (!person?._id || String(person._id) === String(userId)) return
          const key = String(person._id)
          const existing = userMap.get(key)
          userMap.set(key, {
            ...person,
            isFollower: existing?.isFollower || false,
            isFollowing: true,
          })
        })

        const mergedUsers = Array.from(userMap.values()).sort((a, b) =>
          String(a.name || a.username || '').localeCompare(String(b.name || b.username || ''))
        )
        setShareUsers(mergedUsers)
      } catch (error) {
        console.error('Failed to load share users:', error)
        if (isMounted) {
          setShareUsers([])
          toast.error('Could not load followers/following')
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadPeople()
    return () => {
      isMounted = false
    }
  }, [isOpen, userId])

  useEffect(() => {
    if (!isOpen) {
      setSelectedUserIds(new Set())
      setSearchQuery('')
      setMessage('')
    }
  }, [isOpen])

  const selectedCount = selectedUserIds.size
  const reelUrl = buildReelShareUrl(product?._id)
  const shareText = buildReelShareText(product, message)
  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return shareUsers
    return shareUsers.filter((person) => {
      const name = String(person?.name || '').toLowerCase()
      const username = String(person?.username || '').toLowerCase()
      return name.includes(query) || username.includes(query)
    })
  }, [shareUsers, searchQuery])

  const toggleUserSelection = (id) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(reelUrl)
      toast.success('Reel link copied')
    } catch (error) {
      toast.error('Unable to copy link')
    }
  }

  const openShareWindow = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleNativeShare = async () => {
    const shareBody = buildReelShareText(product, message)
    if (navigator.share) {
      try {
        await navigator.share({
          title: product?.title || 'Preelly reel',
          text: shareBody,
          url: reelUrl,
        })
        return
      } catch (error) {
        // fallback below
      }
    }
    await handleCopyLink()
  }

  const handleWhatsAppShare = () => {
    openShareWindow(`https://wa.me/?text=${encodeURIComponent(shareText)}`)
  }

  const handleXShare = () => {
    const text = message.trim() || `Check out ${product?.title || 'this reel'} on Preelly`
    openShareWindow(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(reelUrl)}`
    )
  }

  const handleFacebookShare = () => {
    const quote = message.trim() || `Check out ${product?.title || 'this reel'} on Preelly`
    openShareWindow(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(reelUrl)}&quote=${encodeURIComponent(quote)}`
    )
  }

  const handleInstagramShare = async () => {
    try {
      const result = await shareReelToInstagram({ product, message })
      if (result.method === 'native') {
        toast.success('Shared to Instagram')
      } else {
        toast.success('Reel link copied — paste in Instagram chat')
      }
    } catch {
      toast.error('Unable to share to Instagram')
    }
  }

  const handleSend = async () => {
    if (selectedCount === 0 || sending) return
    if (!product?._id) {
      toast.error('Unable to share this reel')
      return
    }
    setSending(true)

    const dmShareText = buildReelShareText(product, message)
    let successCount = 0
    let failedCount = 0

    try {
      for (const receiverId of selectedUserIds) {
        try {
          const chatRes = await chatService.createOrGetChat(product._id, receiverId, { shareMode: true })
          const chatId = chatRes?.data?.chat?._id
          if (!chatId) throw new Error('Chat not created')
          await chatService.sendMessage(chatId, dmShareText)
          successCount += 1
        } catch (shareErr) {
          failedCount += 1
        }
      }

      if (successCount > 0) {
        toast.success(successCount > 1 ? `Shared with ${successCount} people` : 'Shared successfully')
        onClose()
      }
      if (failedCount > 0) {
        toast.error(`Failed for ${failedCount} ${failedCount > 1 ? 'users' : 'user'}`)
      }
    } catch (error) {
      toast.error('Unable to share reel')
    } finally {
      setSending(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div className="fixed inset-0 z-[10001] flex items-center justify-center p-3 sm:p-4">
        <div className="w-full max-w-[860px] rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
          <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-gray-300 bg-gray-50 px-3 py-2">
              <Search className="h-4 w-4 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search"
                className="w-full min-w-0 bg-transparent text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              aria-label="Close share modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[42vh] overflow-y-auto px-4 py-4">
            {loading ? (
              <div className="py-8 text-center text-sm text-gray-500">Loading followers and following...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">No users found.</div>
            ) : (
              <div className="grid grid-cols-4 gap-x-3 gap-y-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7">
                {filteredUsers.map((person) => {
                  const personId = String(person._id)
                  const selected = selectedUserIds.has(personId)
                  const label = person.name || person.username || 'User'
                  return (
                    <button
                      key={personId}
                      type="button"
                      onClick={() => toggleUserSelection(personId)}
                      className="flex flex-col items-center gap-1.5 text-center"
                    >
                      <div className={`relative h-14 w-14 rounded-full border-2 ${selected ? 'border-primary-600' : 'border-transparent'} p-[2px]`}>
                        {person.avatar ? (
                          <img
                            src={getMediaUrl(person.avatar) || person.avatar}
                            alt={label}
                            className="h-full w-full rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center rounded-full bg-gray-200">
                            <User className="h-5 w-5 text-gray-600" />
                          </div>
                        )}
                        {selected && (
                          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-white">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>
                      <span className="line-clamp-1 max-w-[70px] text-[11px] font-medium text-gray-800">{label}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 px-4 py-3">
            <div className="mb-3 grid grid-cols-6 gap-2">
              <button
                type="button"
                onClick={handleNativeShare}
                className="flex flex-col items-center gap-1 rounded-xl px-1 py-2 hover:bg-gray-100"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700">
                  <Send className="h-4 w-4" />
                </span>
                <span className="text-[11px] text-gray-700">Share</span>
              </button>
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex flex-col items-center gap-1 rounded-xl px-1 py-2 hover:bg-gray-100"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700">
                  <LinkIcon className="h-4 w-4" />
                </span>
                <span className="text-[11px] text-gray-700">Copy Link</span>
              </button>
              <button
                type="button"
                onClick={handleWhatsAppShare}
                className="flex flex-col items-center gap-1 rounded-xl px-1 py-2 hover:bg-gray-100"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366] text-white">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <span className="text-[11px] text-gray-700">Whatsapp</span>
              </button>
              <button
                type="button"
                onClick={handleXShare}
                className="flex flex-col items-center gap-1 rounded-xl px-1 py-2 hover:bg-gray-100"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-white text-sm font-bold">
                  X
                </span>
                <span className="text-[11px] text-gray-700">X</span>
              </button>
              <button
                type="button"
                onClick={handleFacebookShare}
                className="flex flex-col items-center gap-1 rounded-xl px-1 py-2 hover:bg-gray-100"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1877F2] text-white text-base font-bold">
                  f
                </span>
                <span className="text-[11px] text-gray-700">Facebook</span>
              </button>
              <button
                type="button"
                onClick={handleInstagramShare}
                className="flex flex-col items-center gap-1 rounded-xl px-1 py-2 hover:bg-gray-100"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="4" y="4" width="16" height="16" rx="5" stroke="currentColor" strokeWidth="2" />
                    <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="2" />
                    <circle cx="17.5" cy="6.5" r="1.25" fill="currentColor" />
                  </svg>
                </span>
                <span className="text-[11px] text-gray-700">Instagram</span>
              </button>
            </div>

            <div className="mb-3 flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2">
              <MessageCircle className="h-4 w-4 text-gray-500" />
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write a message..."
                className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none"
                maxLength={400}
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSend}
                disabled={selectedCount === 0 || sending}
                className="flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-primary-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                <Send className="h-4 w-4" />
                {sending ? 'Sending...' : selectedCount > 1 ? 'Send Group' : 'Send individual'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default ReelShareModal
