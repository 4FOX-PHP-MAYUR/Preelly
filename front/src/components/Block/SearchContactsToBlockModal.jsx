import { useEffect, useState } from 'react'
import { Search, User } from 'lucide-react'
import toast from 'react-hot-toast'
import { userService } from '@shared/services/api'
import { getMediaUrl } from '@shared/utils/helpers'
import ModalDialog from '../ui/ModalDialog'
import { displayNameOf } from './blockReasons'

/**
 * Search contacts and start the block flow for a selected user.
 */
export default function SearchContactsToBlockModal({ open, onClose, onSelectUser, excludeIds = [] }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      setLoading(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const q = query.trim()
    if (q.length < 3) {
      setResults([])
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)
    const t = window.setTimeout(async () => {
      try {
        const res = await userService.searchUsers(q, 30)
        if (cancelled) return
        const excluded = new Set(excludeIds.map(String))
        setResults((res?.data?.users || []).filter((u) => !excluded.has(String(u._id))))
      } catch {
        if (!cancelled) {
          toast.error('Failed to search contacts')
          setResults([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 280)

    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [query, open, excludeIds])

  return (
    <ModalDialog open={open} onClose={onClose} title="Search Contacts To Block Them" maxWidthClass="sm:max-w-[440px]">
      <div className="pb-2">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contact"
            autoFocus
            className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-11 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
          />
        </label>

        <div className="mt-4 max-h-[50vh] space-y-1 overflow-y-auto">
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-400">Searching…</p>
          ) : query.trim().length < 3 ? (
            <p className="py-8 text-center text-sm text-slate-400">Type at least 3 characters to search</p>
          ) : results.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No contacts found</p>
          ) : (
            results.map((user) => {
              const name = displayNameOf(user)
              const avatarSrc = user.avatar ? getMediaUrl(user.avatar) || user.avatar : null
              return (
                <div key={user._id} className="flex items-center gap-3 py-2.5">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-slate-100">
                    {avatarSrc ? (
                      <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <User className="h-5 w-5 text-slate-400" />
                      </div>
                    )}
                  </div>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{name}</p>
                  <button
                    type="button"
                    onClick={() => onSelectUser?.(user)}
                    className="shrink-0 rounded-md bg-brand px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
                  >
                    Block
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </ModalDialog>
  )
}
