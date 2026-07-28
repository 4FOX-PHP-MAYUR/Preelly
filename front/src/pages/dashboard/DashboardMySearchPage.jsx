import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  Bell,
  BellOff,
  MoreVertical,
  Search,
  Trash2,
  ExternalLink,
  Pencil,
} from 'lucide-react'
import SettingsPageShell from '../../components/Dashboard/SettingsPageShell'
import { userService } from '@shared/services/api'
import { getMediaUrl } from '@shared/utils/helpers'

function formatSavedDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function SavedSearchCard({ item, onOpen, onToggleNotify, onRename, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return undefined
    const onDown = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  const crumbs = (item.categoryPath || []).join(' > ')
  const title = item.title || 'My Search'
  const countSuffix = typeof item.matchCount === 'number' ? ` (${item.matchCount})` : ''
  const tags = item.filters?.tags?.length
    ? item.filters.tags
    : [
        item.filters?.location ? String(item.filters.location).toUpperCase() : 'ALL CITIES',
        item.filters?.minPrice || item.filters?.maxPrice
          ? `PRICE: ${item.filters.minPrice || '0'}–${item.filters.maxPrice || '∞'}`
          : null,
      ].filter(Boolean)

  const previews = (item.previewImages || []).slice(0, 4)

  return (
    <div className="rounded-[16px] border border-[#E5E7EB] bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition duration-200 hover:border-brand/25 sm:p-5">
      <div className="flex items-start gap-3">
        <button type="button" onClick={() => onOpen(item)} className="min-w-0 flex-1 text-left">
          {crumbs ? <p className="text-xs text-slate-400">{crumbs}</p> : null}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 sm:text-lg">
              {title}
              {countSuffix}
            </h3>
            {item.newAdsCount > 0 ? (
              <span className="rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-semibold text-white">
                {item.newAdsCount} new ads
              </span>
            ) : null}
          </div>
          {tags.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={item.notifyEnabled ? 'Mute notifications' : 'Enable notifications'}
            onClick={() => onToggleNotify(item)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition duration-200 hover:bg-slate-100 hover:text-brand"
          >
            {item.notifyEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          </button>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-label="More options"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition duration-200 hover:bg-slate-100"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onOpen(item)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <ExternalLink className="h-4 w-4" /> Open search
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onRename(item)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Pencil className="h-4 w-4" /> Rename
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onDelete(item)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="text-xs text-slate-400">Saved on: {formatSavedDate(item.createdAt)}</p>
        {previews.length > 0 ? (
          <div className="flex -space-x-2">
            {previews.map((src, i) => (
              <img
                key={`${src}-${i}`}
                src={getMediaUrl(src) || src}
                alt=""
                loading="lazy"
                className="h-9 w-9 rounded-full border-2 border-white object-cover"
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function DashboardMySearchPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [tabs, setTabs] = useState([{ key: 'all', label: 'All', count: 0 }])
  const [activeTab, setActiveTab] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await userService.getSavedSearches()
      setItems(res?.data?.savedSearches || [])
      setTabs(res?.data?.tabs?.length ? res.data.tabs : [{ key: 'all', label: 'All', count: 0 }])
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load saved searches')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    if (activeTab === 'all') return items
    const tab = tabs.find((t) => t.key === activeTab)
    if (!tab || tab.key === 'all') return items
    return items.filter((s) => (s.categoryPath?.[0] || 'Other') === tab.label)
  }, [items, activeTab, tabs])

  const handleOpen = async (item) => {
    try {
      await userService.updateSavedSearch(item._id, { markViewed: true })
      setItems((prev) =>
        prev.map((s) => (s._id === item._id ? { ...s, newAdsCount: 0, lastViewedAt: new Date().toISOString() } : s))
      )
    } catch {
      /* still navigate */
    }
    navigate(item.searchUrl || `/search?q=${encodeURIComponent(item.query || '')}`)
  }

  const handleToggleNotify = async (item) => {
    try {
      const res = await userService.updateSavedSearch(item._id, { notifyEnabled: !item.notifyEnabled })
      setItems((prev) => prev.map((s) => (s._id === item._id ? { ...s, ...res.data.savedSearch } : s)))
      toast.success(item.notifyEnabled ? 'Notifications muted' : 'Notifications enabled')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update notifications')
    }
  }

  const handleRename = async (item) => {
    const next = window.prompt('Rename saved search', item.title)
    if (next == null) return
    const title = next.trim()
    if (!title) {
      toast.error('Title is required')
      return
    }
    try {
      const res = await userService.updateSavedSearch(item._id, { title })
      setItems((prev) => prev.map((s) => (s._id === item._id ? { ...s, ...res.data.savedSearch } : s)))
      toast.success('Search renamed')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to rename')
    }
  }

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete “${item.title}”?`)) return
    try {
      await userService.deleteSavedSearch(item._id)
      setItems((prev) => prev.filter((s) => s._id !== item._id))
      toast.success('Saved search deleted')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete')
    }
  }

  return (
    <SettingsPageShell>
      <div className="mx-auto max-w-3xl pb-10">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3 sm:mb-8">
          <div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">My Search</h1>
            <p className="mt-1 text-sm text-slate-500">Resume your ads journey from here</p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand transition duration-200 hover:text-brand-700 sm:text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>

        <div className="mb-5 flex gap-5 overflow-x-auto border-b border-[#E5E7EB]">
          {tabs.map((tab) => {
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`shrink-0 border-b-2 pb-3 text-sm font-semibold transition duration-200 ${
                  active
                    ? 'border-brand text-brand'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            )
          })}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-[16px] bg-slate-100" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-[16px] border border-red-100 bg-red-50 px-4 py-8 text-center">
            <p className="text-sm font-semibold text-red-600">{error}</p>
            <button
              type="button"
              onClick={load}
              className="mt-3 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white"
            >
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[16px] border border-dashed border-[#E5E7EB] px-4 py-14 text-center">
            <Search className="h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">No saved searches yet</p>
            <p className="mt-1 max-w-sm text-xs text-slate-400">
              Run a search, then tap “Save search” to track new matching ads here.
            </p>
            <button
              type="button"
              onClick={() => navigate('/search')}
              className="mt-5 rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              Start searching
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <SavedSearchCard
                key={item._id}
                item={item}
                onOpen={handleOpen}
                onToggleNotify={handleToggleNotify}
                onRename={handleRename}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </SettingsPageShell>
  )
}
