import { useMemo, useState } from 'react'
import { BadgeCheck, Info, Star, User } from 'lucide-react'
import ModalDialog from '../ui/ModalDialog'
import { getMediaUrl } from '@shared/utils/helpers'

function Stars({ value = 0, size = 'h-4 w-4' }) {
  const rating = Math.max(0, Math.min(5, Number(value) || 0))
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`${size} ${i < Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'}`}
        />
      ))}
    </div>
  )
}

function DistributionBars({ distribution }) {
  const max = Math.max(1, ...distribution.map((d) => d.count))
  return (
    <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
      {distribution.map((row) => (
        <div key={row.stars} className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-amber-400 transition-all duration-300"
              style={{ width: `${Math.round((row.count / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function relativeTime(date) {
  if (!date) return ''
  const diff = Date.now() - new Date(date).getTime()
  const days = Math.floor(diff / 86400000)
  if (days < 30) return `${Math.max(1, days)} days ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`
  const years = Math.floor(months / 12)
  return `${years} year${years === 1 ? '' : 's'} ago`
}

/**
 * Review & Rating modal.
 * Uses existing user rating fields. Review list is optional — when the API does
 * not return reviews, an empty state is shown (no backend contract changes).
 */
export default function ReviewRatingModal({
  open,
  onClose,
  user,
  reviews = [],
  distribution: distributionProp,
}) {
  const [expanded, setExpanded] = useState({})
  const [filter, setFilter] = useState('all')

  const avatarSrc = user?.avatar ? getMediaUrl(user.avatar) || user.avatar : null
  const name = user?.displayName || user?.name || 'User'
  const sellerType = user?.role === 'admin' ? 'Admin' : user?.isDealer ? 'Dealer' : 'Seller'
  const memberSince = user?.memberSince || user?.createdAt
  const sinceLabel = memberSince
    ? `Since ${new Date(memberSince).toLocaleString('en-US', { month: 'short', year: 'numeric' })}`
    : ''

  const average = Number(user?.rating?.average ?? user?.rating ?? 0) || 0
  const total = Number(user?.rating?.count ?? user?.ratingCount ?? reviews.length) || 0

  const distribution = useMemo(() => {
    if (distributionProp?.length) return distributionProp
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    reviews.forEach((r) => {
      const s = Math.round(Number(r.rating) || 0)
      if (counts[s] != null) counts[s] += 1
    })
    if (!reviews.length && total > 0 && average > 0) {
      // Approximate bars from average when detailed reviews are unavailable.
      counts[5] = average >= 4.5 ? total : Math.round(total * 0.45)
      counts[4] = average >= 3.5 ? Math.round(total * 0.3) : Math.round(total * 0.2)
      counts[3] = Math.round(total * 0.15)
      counts[2] = Math.round(total * 0.07)
      counts[1] = Math.max(0, total - counts[5] - counts[4] - counts[3] - counts[2])
    }
    return [5, 4, 3, 2, 1].map((stars) => ({ stars, count: counts[stars] }))
  }, [distributionProp, reviews, total, average])

  const filtered = useMemo(() => {
    if (filter === 'all') return reviews
    return reviews.filter((r) => Math.round(Number(r.rating)) === Number(filter))
  }, [reviews, filter])

  return (
    <ModalDialog open={open} onClose={onClose} title="Review & Rating" maxWidthClass="sm:max-w-lg">
      <div className="space-y-5 pb-2">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-slate-100">
              {avatarSrc ? (
                <img src={avatarSrc} alt={name} className="h-full w-full object-cover" />
              ) : (
                <User className="h-7 w-7 text-slate-400" />
              )}
            </div>
            {(user?.isVerified || user?.identityVerificationStatus === 'approved') && (
              <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white ring-2 ring-white">
                <BadgeCheck className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold text-slate-900">{name}</h3>
            <p className="text-sm text-slate-500">
              {sellerType}
              {sinceLabel ? ` · ${sinceLabel}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="shrink-0 text-center">
            <p className="text-3xl font-bold text-slate-900">{average.toFixed(1)}</p>
            <Stars value={average} />
            <p className="mt-1 text-xs text-slate-400">({total.toLocaleString()})</p>
          </div>
          <DistributionBars distribution={distribution} />
          <Info className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
        </div>

        <div className="flex flex-wrap gap-2">
          {['all', 5, 4, 3, 2, 1].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition duration-200 ${
                filter === f
                  ? 'border-brand bg-brand-50 text-brand'
                  : 'border-[#E5E7EB] text-slate-600 hover:border-brand/30'
              }`}
            >
              {f === 'all' ? 'All' : `${f} ★`}
            </button>
          ))}
        </div>

        <div className="max-h-[40vh] space-y-5 overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-[#E5E7EB] px-4 py-10 text-center">
              <Star className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-semibold text-slate-700">No reviews yet</p>
              <p className="mt-1 text-xs text-slate-400">
                Reviews will appear here when buyers rate this seller.
              </p>
            </div>
          ) : (
            filtered.map((review) => {
              const id = review._id || review.id
              const isOpen = expanded[id]
              const text = review.comment || review.text || ''
              const long = text.length > 160
              const display = !long || isOpen ? text : `${text.slice(0, 160).trim()}…`
              const reviewer = review.reviewer || review.user || {}
              const reviewerName = reviewer.displayName || reviewer.name || 'User'
              const reviewerAvatar = reviewer.avatar
                ? getMediaUrl(reviewer.avatar) || reviewer.avatar
                : null

              return (
                <article key={id} className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="relative h-9 w-9 overflow-hidden rounded-full bg-slate-100">
                      {reviewerAvatar ? (
                        <img src={reviewerAvatar} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <User className="m-2 h-5 w-5 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">{reviewerName}</p>
                      {review.meta ? (
                        <p className="truncate text-xs text-slate-400">{review.meta}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Stars value={review.rating} size="h-3.5 w-3.5" />
                    <span className="text-xs text-slate-400">
                      {relativeTime(review.createdAt || review.date)}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-500">
                    {display}
                    {long ? (
                      <button
                        type="button"
                        onClick={() => setExpanded((prev) => ({ ...prev, [id]: !isOpen }))}
                        className="ml-1 font-semibold text-brand"
                      >
                        {isOpen ? 'Read Less' : 'Read More'}
                      </button>
                    ) : null}
                  </p>
                </article>
              )
            })
          )}
        </div>
      </div>
    </ModalDialog>
  )
}
