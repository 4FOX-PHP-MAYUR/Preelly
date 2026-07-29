import { useEffect, useRef, useState } from 'react'
import {
  Archive,
  Eye,
  MoreVertical,
  MapPin,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { formatPrice, getMediaUrl } from '@shared/utils/helpers'

function formatDate(value) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function ArchiveStatusPill({ status }) {
  const s = String(status || 'inactive').toLowerCase()
  const label = s === 'inactive' || s === 'archived' ? 'Archived' : s
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold capitalize text-slate-600">
      {label}
    </span>
  )
}

export function ArchiveCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-[16px] border border-[#E5E7EB] bg-white p-3 sm:gap-4 sm:p-4">
      <div className="h-20 w-24 shrink-0 animate-pulse rounded-[12px] bg-slate-100 sm:h-24 sm:w-32" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-1/4 animate-pulse rounded bg-slate-100" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-slate-100" />
    </div>
  )
}

export default function ArchiveCard({
  item,
  busy = false,
  onRestore,
  onView,
  onDelete,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const thumbRaw = item?.images?.[0] || null
  const thumb = thumbRaw ? getMediaUrl(thumbRaw) || thumbRaw : null
  const categoryName =
    (item?.category && typeof item.category === 'object' && item.category.name) ||
    item?.categoryName ||
    'Uncategorized'
  const archivedOn = formatDate(item?.archivedAt || item?.updatedAt)
  const updatedOn = formatDate(item?.updatedAt)
  const location = item?.location || null
  const priceLabel = formatPrice(Number(item?.price || 0), (item?.currency || 'AED').toUpperCase())

  useEffect(() => {
    if (!menuOpen) return undefined
    const onDown = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  const actions = [
    { label: 'Restore Ad', icon: RotateCcw, onClick: onRestore },
    { label: 'View Details', icon: Eye, onClick: onView },
    { label: 'Delete Permanently', icon: Trash2, onClick: onDelete, danger: true },
  ]

  return (
    <article
      className={`flex items-center gap-3 rounded-[16px] border border-[#E5E7EB] bg-white p-3 shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition duration-200 hover:border-brand/20 sm:gap-4 sm:p-4 ${
        busy ? 'opacity-60' : ''
      }`}
    >
      <div className="h-20 w-24 shrink-0 overflow-hidden rounded-[12px] bg-slate-100 sm:h-24 sm:w-32">
        {thumb ? (
          <img
            src={thumb}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <Archive className="h-8 w-8" aria-hidden />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-bold text-slate-900 sm:text-base">
            {item?.title || 'Untitled ad'}
          </h3>
          <ArchiveStatusPill status={item?.isArchived ? 'archived' : item?.status} />
        </div>
        <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{categoryName}</p>
        <p className="mt-1 text-sm font-bold text-slate-900">{priceLabel}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
          {location ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" aria-hidden />
              <span className="truncate max-w-[140px] sm:max-w-[200px]">{location}</span>
            </span>
          ) : null}
          {archivedOn ? <span>Archived {archivedOn}</span> : null}
          {updatedOn ? <span>Updated {updatedOn}</span> : null}
        </div>
      </div>

      <div className="relative shrink-0" ref={menuRef}>
        <button
          type="button"
          aria-label={`Options for ${item?.title || 'archived ad'}`}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          disabled={busy}
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition duration-200 hover:bg-slate-100 disabled:opacity-50"
        >
          <MoreVertical className="h-5 w-5" />
        </button>
        {menuOpen ? (
          <div
            role="menu"
            className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white py-1 shadow-lg"
          >
            {actions.map((action) => {
              const Icon = action.icon
              return (
                <button
                  key={action.label}
                  type="button"
                  role="menuitem"
                  disabled={busy}
                  onClick={() => {
                    setMenuOpen(false)
                    action.onClick?.()
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition duration-150 hover:bg-slate-50 disabled:opacity-50 ${
                    action.danger ? 'text-red-500' : 'text-slate-700'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {action.label}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    </article>
  )
}
