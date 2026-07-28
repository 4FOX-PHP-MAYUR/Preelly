import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Plus, Search, User } from 'lucide-react'
import { userService } from '@shared/services/api'
import { getMediaUrl } from '@shared/utils/helpers'
import SettingsPageShell from '../../components/Dashboard/SettingsPageShell'
import BlockFlow from '../../components/Block/BlockFlow'
import SearchContactsToBlockModal from '../../components/Block/SearchContactsToBlockModal'
import UnblockConfirmModal from '../../components/Block/UnblockConfirmModal'
import { displayNameOf } from '../../components/Block/blockReasons'

export default function DashboardBlockedUsersPage() {
  const [blockedUsers, setBlockedUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [blockTarget, setBlockTarget] = useState(null)
  const [unblockTarget, setUnblockTarget] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await userService.getBlockedUsers()
      setBlockedUsers(res?.data?.blockedUsers || [])
    } catch {
      toast.error('Failed to load blocked users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return blockedUsers
    return blockedUsers.filter((u) => {
      const name = displayNameOf(u).toLowerCase()
      const email = String(u.email || '').toLowerCase()
      return name.includes(q) || email.includes(q)
    })
  }, [blockedUsers, query])

  const excludeIds = useMemo(() => blockedUsers.map((u) => u._id), [blockedUsers])

  const openAdd = () => setShowSearch(true)

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
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : blockedUsers.length === 0 ? (
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

            <div className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">No matches</p>
              ) : (
                filtered.map((user) => {
                  const name = displayNameOf(user)
                  const avatarSrc = user.avatar ? getMediaUrl(user.avatar) || user.avatar : null
                  return (
                    <div key={user._id} className="flex items-center gap-3 py-3.5">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100">
                        {avatarSrc ? (
                          <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <User className="h-5 w-5 text-slate-400" />
                        )}
                      </div>
                      <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{name}</p>
                      <button
                        type="button"
                        onClick={() => setUnblockTarget(user)}
                        className="shrink-0 rounded-md bg-brand px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
                      >
                        Unblock
                      </button>
                    </div>
                  )
                })
              )}
            </div>
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
