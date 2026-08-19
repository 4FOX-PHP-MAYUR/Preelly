import { useEffect, useMemo, useState } from 'react'
import { Search, User, Users, X, Check, Link as LinkIcon, MessageCircle, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { chatService, userService } from '@shared/services/api'
import { getMediaUrl } from '@shared/utils/helpers'
import { buildReelShareText, buildProductShareUrl, shareReelToInstagram } from '@shared/utils/reelShare'

function ReelShareModal({ isOpen, onClose, product, userId, asPanel = false }) {
  const [loading, setLoading] = useState(false)
  const [shareUsers, setShareUsers] = useState([])
  const [shareGroups, setShareGroups] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState(new Set())
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [remoteUsers, setRemoteUsers] = useState([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!isOpen || !userId) return

    let isMounted = true
    const loadPeople = async () => {
      try {
        setLoading(true)
        const [followersRes, followingRes, chatsRes] = await Promise.all([
          userService.getFollowers(userId),
          userService.getFollowing(userId),
          chatService.getChats().catch(() => null),
        ])

        if (!isMounted) return

        // Groups the current user created or was added to (from their chat list).
        const chats = chatsRes?.data?.chats || chatsRes?.data || []
        const groups = (Array.isArray(chats) ? chats : [])
          .filter((c) => c?.type === 'group')
          .map((c) => ({
            _id: String(c._id),
            name: c.name || 'Group',
            avatar: c.groupAvatar || '',
            memberCount: (c.participants || []).length,
          }))
          .sort((a, b) => a.name.localeCompare(b.name))
        setShareGroups(groups)

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
          setShareGroups([])
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
      setRemoteUsers([])
    }
  }, [isOpen])

  // Search all active users once the query reaches 3 characters. Debounced so we
  // don't hit the API on every keystroke; results render below the People list.
  useEffect(() => {
    const query = searchQuery.trim()
    if (query.length < 3) {
      setRemoteUsers([])
      setSearching(false)
      return
    }

    let isActive = true
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const res = await userService.searchUsers(query)
        if (!isActive) return
        const results = Array.isArray(res?.data?.users) ? res.data.users : []
        setRemoteUsers(results)
      } catch (error) {
        if (isActive) setRemoteUsers([])
      } finally {
        if (isActive) setSearching(false)
      }
    }, 300)

    return () => {
      isActive = false
      clearTimeout(timer)
    }
  }, [searchQuery])

  const selectedCount = selectedUserIds.size
  const reelUrl = buildProductShareUrl(product?._id)
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

  const filteredGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return shareGroups
    return shareGroups.filter((g) => String(g?.name || '').toLowerCase().includes(query))
  }, [shareGroups, searchQuery])

  // Active users from the global search, minus anyone already shown in the
  // People list (followers/following) so the two sections don't duplicate.
  const extraUsers = useMemo(() => {
    if (remoteUsers.length === 0) return []
    const known = new Set(filteredUsers.map((u) => String(u._id)))
    return remoteUsers.filter((u) => u?._id && !known.has(String(u._id)))
  }, [remoteUsers, filteredUsers])

  // Split the current selection into existing groups vs. users (ids are distinct).
  const selectedGroups = useMemo(
    () => shareGroups.filter((g) => selectedUserIds.has(String(g._id))),
    [shareGroups, selectedUserIds],
  )
  const selectedUsers = useMemo(() => {
    const byId = new Map()
    ;[...shareUsers, ...remoteUsers].forEach((u) => {
      if (u?._id) byId.set(String(u._id), u)
    })
    return Array.from(byId.values()).filter((u) => selectedUserIds.has(String(u._id)))
  }, [shareUsers, remoteUsers, selectedUserIds])

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
      toast.success('Link copied')
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

  // Share the reel with each selected user in their own 1:1 chat. createOrGetChat
  // reuses an existing conversation or creates one, so no duplicate DMs are made.
  const shareIndividually = async (users, dmShareText) => {
    let success = 0
    let failed = 0
    for (const user of users) {
      try {
        const chatRes = await chatService.createOrGetChat(product._id, user._id, { shareMode: true })
        const chatId = chatRes?.data?.chat?._id
        if (!chatId) throw new Error('Chat not created')
        await chatService.sendMessage(chatId, dmShareText)
        success += 1
      } catch {
        failed += 1
      }
    }
    return { success, failed }
  }

  // Create a brand-new group chat from the selected users and post the reel into it.
  const shareAsGroup = async (users, dmShareText) => {
    try {
      const memberIds = users.map((u) => String(u._id))
      const selectedNames = users.map((u) => u.name || u.username).filter(Boolean)
      // Group name = each member's initial + "-" + a random code, e.g. "JV-DTGFRV564".
      const initials = selectedNames
        .map((n) => n.trim().charAt(0).toUpperCase())
        .filter(Boolean)
        .join('')
      const letters = Array.from({ length: 6 }, () =>
        String.fromCharCode(65 + Math.floor(Math.random() * 26)),
      ).join('')
      const digits = String(Math.floor(100 + Math.random() * 900))
      const groupName = `${initials || 'G'}-${letters}${digits}`
      await chatService.createGroup({
        memberIds,
        name: groupName,
        productId: product._id,
        text: dmShareText,
      })
      return { success: 1, failed: 0 }
    } catch {
      return { success: 0, failed: 1 }
    }
  }

  // mode: 'individual' | 'group' | 'auto'. 'auto' preserves the legacy single-button
  // behaviour (2+ users with no group picked → new group; otherwise individual DMs).
  const handleSend = async (mode = 'auto') => {
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
      // 1) Existing groups the user picked → post the reel straight into them.
      for (const group of selectedGroups) {
        try {
          await chatService.sendMessage(group._id, dmShareText)
          successCount += 1
        } catch {
          failedCount += 1
        }
      }

      // 2) Users → group or individual DMs depending on the chosen mode.
      if (selectedUsers.length > 0) {
        const useGroup =
          mode === 'group' ||
          (mode === 'auto' && selectedUsers.length > 1 && selectedGroups.length === 0)
        const { success, failed } = useGroup
          ? await shareAsGroup(selectedUsers, dmShareText)
          : await shareIndividually(selectedUsers, dmShareText)
        successCount += success
        failedCount += failed
      }

      if (successCount > 0) {
        toast.success(successCount > 1 ? `Shared to ${successCount} chats` : 'Shared successfully')
        onClose()
      }
      if (failedCount > 0) {
        toast.error(`Failed for ${failedCount} ${failedCount > 1 ? 'chats' : 'chat'}`)
      }
    } catch (error) {
      toast.error('Unable to share reel')
    } finally {
      setSending(false)
    }
  }

  if (!isOpen) return null

  const searchBar = (
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
  )

  const avatarSize = asPanel ? 'h-16 w-16' : 'h-14 w-14'
  const labelSize = asPanel ? 'max-w-[90px] text-xs' : 'max-w-[70px] text-[11px]'
  const gridClass = asPanel
    ? 'grid grid-cols-3 gap-x-3 gap-y-6'
    : 'grid grid-cols-4 gap-x-3 gap-y-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7'

  const renderPersonButton = (person) => {
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
        <div className={`relative rounded-full border-2 ${selected ? 'border-primary-600' : 'border-transparent'} p-[2px] ${avatarSize}`}>
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
        <span className={`line-clamp-1 font-medium text-gray-800 ${labelSize}`}>{label}</span>
      </button>
    )
  }

  const hasAnyResult =
    filteredGroups.length > 0 || filteredUsers.length > 0 || extraUsers.length > 0

  const userGrid = (
    loading ? (
      <div className="py-8 text-center text-sm text-gray-500">Loading followers and following...</div>
    ) : !hasAnyResult && !searching ? (
      <div className="py-8 text-center text-sm text-gray-500">No users or groups found.</div>
    ) : (
      <div className="space-y-5">
        {filteredGroups.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Groups</p>
            <div className={gridClass}>
              {filteredGroups.map((group) => {
                const selected = selectedUserIds.has(group._id)
                return (
                  <button
                    key={group._id}
                    type="button"
                    onClick={() => toggleUserSelection(group._id)}
                    className="flex flex-col items-center gap-1.5 text-center"
                  >
                    <div className={`relative rounded-full border-2 ${selected ? 'border-primary-600' : 'border-transparent'} p-[2px] ${avatarSize}`}>
                      {group.avatar ? (
                        <img
                          src={getMediaUrl(group.avatar) || group.avatar}
                          alt={group.name}
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center rounded-full bg-primary-100">
                          <Users className="h-5 w-5 text-primary-600" />
                        </div>
                      )}
                      {selected && (
                        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-white">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                    <span className={`line-clamp-1 font-medium text-gray-800 ${labelSize}`}>{group.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {filteredUsers.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">People</p>
            <div className={gridClass}>
              {filteredUsers.map(renderPersonButton)}
            </div>
          </div>
        )}

        {(extraUsers.length > 0 || searching) && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">All Users</p>
            {searching ? (
              <div className="py-4 text-center text-sm text-gray-500">Searching users...</div>
            ) : (
              <div className={gridClass}>
                {extraUsers.map(renderPersonButton)}
              </div>
            )}
          </div>
        )}
      </div>
    )
  )

  const footer = (
    <>
      {selectedCount <= 1 && (
      <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
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
      )}

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
        {selectedUsers.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => handleSend('individual')}
              disabled={sending}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-primary-600 bg-white px-4 text-sm font-semibold text-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {sending ? 'Sending...' : 'Send Individual'}
            </button>
            <button
              type="button"
              onClick={() => handleSend('group')}
              disabled={sending}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-primary-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              <Send className="h-4 w-4" />
              {sending ? 'Sending...' : 'Send Group'}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => handleSend('individual')}
            disabled={selectedCount === 0 || sending}
            className="flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-primary-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            <Send className="h-4 w-4" />
            {sending ? 'Sending...' : 'Send'}
          </button>
        )}
      </div>
    </>
  )

  if (asPanel) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-bold text-gray-900">Share</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-red-500 hover:text-red-600"
          >
            Close
          </button>
        </div>
        <div className="px-5 pt-4">{searchBar}</div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{userGrid}</div>
        <div className="border-t border-gray-200 px-5 py-3">{footer}</div>
      </div>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div className="fixed inset-0 z-[10001] flex items-end justify-center p-0 sm:items-center sm:p-4">
        <div className="flex max-h-[92vh] w-full max-w-[860px] flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-2xl sm:max-h-[85vh] sm:rounded-2xl">
          <div className="flex shrink-0 items-center gap-2 border-b border-gray-200 px-4 py-3">
            {searchBar}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              aria-label="Close share modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{userGrid}</div>

          <div className="shrink-0 border-t border-gray-200 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>
        </div>
      </div>
    </>
  )
}

export default ReelShareModal
