import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Search } from 'lucide-react'
import SettingsPageShell from '../../components/Dashboard/SettingsPageShell'
import Pagination from '../../components/ui/Pagination'
import SavedSearchCard, { SavedSearchCardSkeleton } from '../../components/MySearch/SavedSearchCard'
import NotificationSettingsModal from '../../components/MySearch/NotificationSettingsModal'
import MoreOptionsModal from '../../components/MySearch/MoreOptionsModal'
import ShareSearchModal from '../../components/MySearch/ShareSearchModal'
import RenameSearchModal from '../../components/MySearch/RenameSearchModal'
import DeleteSearchModal from '../../components/MySearch/DeleteSearchModal'
import { userService } from '@shared/services/api'

const PAGE_SIZE = 10

export default function DashboardMySearchPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [tabs, setTabs] = useState([{ key: 'all', label: 'All', count: 0 }])
  const [activeTab, setActiveTab] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)

  const [activeItem, setActiveItem] = useState(null)
  const [notifyOpen, setNotifyOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [actionSaving, setActionSaving] = useState(false)

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
    return items.filter((s) => {
      const root = s.categoryPath?.[0] || s.categoryName || 'Other'
      return root === tab.label
    })
  }, [items, activeTab, tabs])

  useEffect(() => {
    setPage(1)
  }, [activeTab])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const pagedItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const patchItem = (id, next) => {
    setItems((prev) => prev.map((s) => (s._id === id ? { ...s, ...next } : s)))
  }

  const handleOpen = async (item) => {
    try {
      await userService.updateSavedSearch(item._id, { markViewed: true })
      patchItem(item._id, { newAdsCount: 0, lastViewedAt: new Date().toISOString() })
    } catch {
      /* still navigate */
    }
    navigate(item.searchUrl || `/search?q=${encodeURIComponent(item.query || item.keyword || '')}`)
  }

  const openNotifications = (item) => {
    setActiveItem(item)
    setNotifyOpen(true)
  }

  const openMore = (item) => {
    setActiveItem(item)
    setMoreOpen(true)
  }

  const afterMore = (openNext) => {
    setMoreOpen(false)
    window.setTimeout(openNext, 220)
  }

  const handleSaveNotifications = async (payload) => {
    if (!activeItem) return
    setActionSaving(true)
    try {
      const res = await userService.updateSavedSearch(activeItem._id, payload)
      const updated = res?.data?.savedSearch || { ...activeItem, ...payload }
      patchItem(activeItem._id, updated)
      setActiveItem(updated)
      setNotifyOpen(false)
      toast.success('Notification settings updated')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update notifications')
    } finally {
      setActionSaving(false)
    }
  }

  const handleRename = async (title) => {
    if (!activeItem) return
    setActionSaving(true)
    try {
      const res = await userService.updateSavedSearch(activeItem._id, { title, searchName: title })
      const updated = res?.data?.savedSearch || { ...activeItem, title, searchName: title }
      patchItem(activeItem._id, updated)
      setActiveItem(updated)
      setRenameOpen(false)
      toast.success('Search renamed')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to rename')
    } finally {
      setActionSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!activeItem) return
    setActionSaving(true)
    try {
      await userService.deleteSavedSearch(activeItem._id)
      setItems((prev) => prev.filter((s) => s._id !== activeItem._id))
      setTabs((prev) => {
        const nextItems = items.filter((s) => s._id !== activeItem._id)
        const tabsMap = new Map()
        nextItems.forEach((s) => {
          const root = s.categoryPath?.[0] || s.categoryName || 'Other'
          tabsMap.set(root, (tabsMap.get(root) || 0) + 1)
        })
        return [
          { key: 'all', label: 'All', count: nextItems.length },
          ...Array.from(tabsMap.entries()).map(([label, count]) => ({
            key: label.toLowerCase().replace(/\s+/g, '-'),
            label,
            count,
          })),
        ]
      })
      setDeleteOpen(false)
      setActiveItem(null)
      toast.success('Saved search deleted')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete')
    } finally {
      setActionSaving(false)
    }
  }

  return (
    <SettingsPageShell>
      <div className="mx-auto max-w-3xl pb-10">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3 sm:mb-8">
          <div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">My Search</h1>
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

        <div
          className="mb-5 flex gap-5 overflow-x-auto border-b border-[#E5E7EB]"
          role="tablist"
          aria-label="Saved search categories"
        >
          {tabs.map((tab) => {
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
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
          <div className="space-y-3" aria-busy="true" aria-label="Loading saved searches">
            {[1, 2, 3].map((i) => (
              <SavedSearchCardSkeleton key={i} />
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
          <div className="flex flex-col items-center justify-center rounded-[16px] border border-dashed border-[#E5E7EB] px-4 py-14 text-center animate-fade-in">
            <Search className="h-10 w-10 text-slate-300" aria-hidden />
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
          <div className="space-y-3" role="list">
            {pagedItems.map((item, index) => (
              <div
                key={item._id}
                role="listitem"
                className="animate-fade-in"
                style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
              >
                <SavedSearchCard
                  item={item}
                  onOpen={handleOpen}
                  onOpenNotifications={openNotifications}
                  onOpenMore={openMore}
                />
              </div>
            ))}
          </div>
        )}

        {!loading && !error && filtered.length > 0 ? (
          <Pagination page={page} totalPages={totalPages} total={filtered.length} onPageChange={setPage} itemLabel="saved searches" />
        ) : null}
      </div>

      <NotificationSettingsModal
        open={notifyOpen}
        item={activeItem}
        saving={actionSaving}
        onClose={() => setNotifyOpen(false)}
        onSave={handleSaveNotifications}
      />

      <MoreOptionsModal
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        onRename={() => afterMore(() => setRenameOpen(true))}
        onShare={() => afterMore(() => setShareOpen(true))}
        onDelete={() => afterMore(() => setDeleteOpen(true))}
      />

      <ShareSearchModal
        open={shareOpen}
        item={activeItem}
        onClose={() => setShareOpen(false)}
      />

      <RenameSearchModal
        open={renameOpen}
        item={activeItem}
        saving={actionSaving}
        onClose={() => setRenameOpen(false)}
        onSave={handleRename}
      />

      <DeleteSearchModal
        open={deleteOpen}
        item={activeItem}
        saving={actionSaving}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </SettingsPageShell>
  )
}
