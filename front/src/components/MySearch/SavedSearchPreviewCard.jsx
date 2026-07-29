import {
  formatSavedDate,
  getCategoryPathLabel,
  getFilterTags,
  getMatchCount,
  getPreviewImages,
  getSearchDisplayName,
} from './savedSearchUtils'

/** Compact preview used inside notification settings modal. */
export default function SavedSearchPreviewCard({ item, className = '' }) {
  const crumbs = getCategoryPathLabel(item)
  const title = getSearchDisplayName(item)
  const count = getMatchCount(item)
  const tags = getFilterTags(item)
  const previews = getPreviewImages(item)
  const newCount = item?.newAdsCount || 0

  return (
    <div className={`rounded-[14px] bg-[#F5F6F8] p-3.5 sm:p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {crumbs ? <p className="text-[11px] text-slate-400">{crumbs}</p> : null}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 sm:text-[15px]">
              {title}
              {count != null ? ` (${count})` : ''}
            </h3>
            {newCount > 0 ? (
              <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-white">
                {newCount} new ads
              </span>
            ) : null}
          </div>
          {tags.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-[6px] bg-[#E8EAED] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          <p className="mt-2.5 text-[11px] text-slate-400">
            Saved on: {formatSavedDate(item?.createdAt)}
          </p>
        </div>
        {previews.length > 0 ? (
          <div className="relative mt-1 flex h-14 w-[4.5rem] shrink-0 items-center justify-end">
            {previews.map((src, i) => (
              <img
                key={`${src}-${i}`}
                src={src}
                alt=""
                loading="lazy"
                className="absolute h-11 w-11 rounded-[10px] border-2 border-white object-cover shadow-sm"
                style={{ right: i * 14, zIndex: previews.length - i }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
