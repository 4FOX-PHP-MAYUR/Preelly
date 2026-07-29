import { Bell } from 'lucide-react'
import {
  formatSavedDate,
  getCategoryPathLabel,
  getFilterTags,
  getMatchCount,
  getNotificationsEnabled,
  getPreviewImages,
  getSearchDisplayName,
} from './savedSearchUtils'

export default function SavedSearchCard({
  item,
  onOpen,
  onOpenNotifications,
  onOpenMore,
}) {
  const crumbs = getCategoryPathLabel(item)
  const title = getSearchDisplayName(item)
  const count = getMatchCount(item)
  const tags = getFilterTags(item)
  const previews = getPreviewImages(item)
  const newCount = item?.newAdsCount || 0
  const notifyOn = getNotificationsEnabled(item)

  return (
    <article className="group rounded-[16px] border border-[#E8EAED] bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)] transition duration-200 hover:border-brand/20 hover:shadow-[0_6px_20px_rgba(15,23,42,0.06)] sm:p-5">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => onOpen?.(item)}
          className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-2 rounded-[8px]"
        >
          {crumbs ? (
            <p className="text-xs text-slate-400">{crumbs}</p>
          ) : (
            <p className="text-xs text-slate-300">Saved search</p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 sm:text-lg">
              {title}
              {count != null ? (
                <span className="font-bold text-slate-900">{` (${count})`}</span>
              ) : null}
            </h3>
            {newCount > 0 ? (
              <span className="inline-flex animate-fade-in rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-semibold text-white">
                {newCount} new ads
              </span>
            ) : null}
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            aria-label={notifyOn ? 'Notification settings' : 'Enable notifications'}
            onClick={() => onOpenNotifications?.(item)}
            className={`flex h-9 w-9 items-center justify-center rounded-full transition duration-200 hover:bg-slate-100 ${
              notifyOn ? 'text-brand' : 'text-slate-400'
            }`}
          >
            <Bell className="h-[18px] w-[18px]" strokeWidth={notifyOn ? 2.25 : 1.75} />
          </button>
          <button
            type="button"
            aria-label="More options"
            onClick={() => onOpenMore?.(item)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition duration-200 hover:bg-slate-100 hover:text-slate-800"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <circle cx="12" cy="5" r="1.75" />
              <circle cx="12" cy="12" r="1.75" />
              <circle cx="12" cy="19" r="1.75" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          {tags.length ? (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-[6px] bg-[#F1F2F4] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          <p className="mt-3 text-xs text-slate-400">
            Saved on: {formatSavedDate(item?.createdAt)}
          </p>
        </div>

        {previews.length > 0 ? (
          <div className="relative mb-0.5 flex h-12 w-[4.75rem] shrink-0 items-center justify-end">
            {previews.map((src, i) => (
              <img
                key={`${src}-${i}`}
                src={src}
                alt=""
                loading="lazy"
                decoding="async"
                className="absolute h-11 w-11 rounded-[10px] border-2 border-white object-cover shadow-sm transition duration-200 group-hover:scale-[1.03]"
                style={{ right: i * 16, zIndex: previews.length - i }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </article>
  )
}

export function SavedSearchCardSkeleton() {
  return (
    <div className="animate-pulse rounded-[16px] border border-[#E8EAED] bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3 w-36 rounded bg-slate-100" />
          <div className="h-5 w-56 rounded bg-slate-100" />
          <div className="mt-3 flex gap-2">
            <div className="h-6 w-20 rounded bg-slate-100" />
            <div className="h-6 w-16 rounded bg-slate-100" />
          </div>
          <div className="mt-3 h-3 w-28 rounded bg-slate-100" />
        </div>
        <div className="flex gap-1">
          <div className="h-9 w-9 rounded-full bg-slate-100" />
          <div className="h-9 w-9 rounded-full bg-slate-100" />
        </div>
      </div>
    </div>
  )
}
