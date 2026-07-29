import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Loader2, Plus, Search, User } from 'lucide-react'
import { userService } from '@shared/services/api'
import { getMediaUrl, formatDate } from '@shared/utils/helpers'
import SettingsPageShell from '../../components/Dashboard/SettingsPageShell'
import BlockFlow from '../../components/Block/BlockFlow'
import SearchContactsToBlockModal from '../../components/Block/SearchContactsToBlockModal'
import UnblockConfirmModal from '../../components/Block/UnblockConfirmModal'
import { displayNameOf, usernameOf } from '../../components/Block/blockReasons'

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 300

export default function DashboardBlockedUsersPage() {
  const [blockedUsers, setBlockedUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [blockTarget, setBlockTarget] = useState(null)
  const [unblockTarget, setUnblockTarget] = useState(null)

  // Guards against a slow response for an old query overwriting a newer one.
  const requestRef = useRef(0)
  const sentinelRef = useRef(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  const load = useCallback(async ({ page: nextPage, q, append }) => {
    const requestId = ++requestRef.current
    if (append) setLoadingMore(true)
    else setLoading(true)

    try {
      const res = await userService.getBlockedUsers({ page: nextPage, limit: PAGE_SIZE, q })
      if (requestId !== requestRef.current) return // a newer request already won

      const data = res?.data || {}
      const items = data.items || data.blockedUsers || []
      setBlockedUsers((prev) => (append ? [...prev, ...items] : items))
      setHasMore(Boolean(data.hasMore))
      setPage(nextPage)
    } catch {
      if (requestId === requestRef.current) toast.error('Failed to load blocked users')
    } finally {
      if (requestId === requestRef.current) {
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [])

  useEffect(() => {
    load({ page: 1, q: debouncedQuery, append: false })
  }, [debouncedQuery, load])

  // Infinite scroll — same sentinel pattern used by the other dashboard lists.
  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasMore || loading || loadingMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          load({ page: page + 1, q: debouncedQuery, append: true })
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore, page, debouncedQuery, load])

  const excludeIds = useMemo(() => blockedUsers.map((u) => u._id), [blockedUsers])

  const openAdd = () => setShowSearch(true)

  const isSearching = debouncedQuery.length > 0
  const isEmpty = !loading && blockedUsers.length === 0

  return (
    <SettingsPageShell>
      <div className="mx-auto max-w-3xl pb-10">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3 sm:mb-8">
          <div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Blocked Account</h1>
            <p className="mt-1 text-sm text-slate-500">Resume your ads journey form here</p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand transition duration-200 hover:text-brand-700 sm:text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3" aria-busy="true" aria-live="polite">
            <span className="sr-only">Loading blocked accounts…</span>
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : isEmpty && !isSearching ? (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Add people to block list
            </button>
            <p className="mt-6 text-base font-bold text-slate-900">You don&apos;t have any account blocked</p>
            <p className="mt-2 max-w-sm text-sm text-slate-500">
              Looks like the kindness you show others comes right back to you.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="relative block min-w-0 flex-1">
                <span className="sr-only">Search blocked accounts</span>
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search contact"
                  className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                />
              </label>
              <button
                type="button"
                onClick={openAdd}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-brand-700"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                Add User
              </button>
            </div>

            <ul className="divide-y divide-slate-100" aria-live="polite">
              {blockedUsers.length === 0 ? (
                <li className="py-10 text-center text-sm text-slate-400">No matches</li>
              ) : (
                blockedUsers.map((user) => {
                  const name = displayNameOf(user)
                  const handle = usernameOf(user)
                  const avatarSrc = user.avatar ? getMediaUrl(user.avatar) || user.avatar : null
                  return (
                    <li key={user._id} className="flex items-center gap-3 py-3.5">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100">
                        {avatarSrc ? (
                          <img src={avatarSrc} alt="" loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <User className="h-5 w-5 text-slate-400" aria-hidden />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{name}</p>
                        {handle ? <p className="truncate text-xs text-slate-500">@{handle}</p> : null}
                        {user.blockedAt ? (
                          <p className="mt-0.5 text-xs text-slate-400">Blocked {formatDate(user.blockedAt)}</p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => setUnblockTarget(user)}
                        aria-label={`Unblock ${name}`}
                        className="shrink-0 rounded-md bg-brand px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
                      >
                        Unblock
                      </button>
                    </li>
                  )
                })
              )}
            </ul>

            {hasMore ? (
              <div ref={sentinelRef} className="flex justify-center py-6">
                {loadingMore ? (
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-label="Loading more" />
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>

      <SearchContactsToBlockModal
        open={showSearch}
        onClose={() => setShowSearch(false)}
        excludeIds={excludeIds}
        onSelectUser={(user) => {
          setShowSearch(false)
          setBlockTarget(user)
        }}
      />

      <BlockFlow
        open={Boolean(blockTarget)}
        user={blockTarget}
        onClose={() => setBlockTarget(null)}
        onBlocked={(user) => {
          setBlockedUsers((prev) => {
            if (prev.some((u) => String(u._id) === String(user._id))) return prev
            return [{ ...user, blockedAt: new Date().toISOString() }, ...prev]
          })
        }}
      />

      <UnblockConfirmModal
        open={Boolean(unblockTarget)}
        user={unblockTarget}
        onClose={() => setUnblockTarget(null)}
        onUnblocked={(user) => {
          setBlockedUsers((prev) => prev.filter((u) => String(u._id) !== String(user._id)))
        }}
      />
    </SettingsPageShell>
  )
}
