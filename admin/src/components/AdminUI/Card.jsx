import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { SkeletonStatCard } from './Skeleton'

const accentMap = {
  default: 'bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400',
  yellow: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
  green: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
  purple: 'bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400',
  red: 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400',
  slate: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
}

/**
 * KPI stat tile.
 *
 * Optional additions (all default to the original static behaviour):
 *  - `to`        renders the tile as a router link to a pre-filtered listing
 *  - `loading`   swaps in a matching skeleton so the grid never reflows
 *  - `hint`      a short caption under the value
 */
function Card({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel,
  accent = 'default',
  className = '',
  to,
  loading = false,
  hint,
  trendPositiveIsGood = true,
}) {
  if (loading) return <SkeletonStatCard />

  const accentClasses = accentMap[accent] || accentMap.default
  const trendIsGood = trend >= 0 ? trendPositiveIsGood : !trendPositiveIsGood

  const body = (
    <div className="flex items-start justify-between gap-2 sm:gap-3">
      <div className="min-w-0 flex-1">
        {/* Wraps to a second line rather than truncating — a clipped KPI label
            ("Total Regi…") is worse than a two-line one. */}
        <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 line-clamp-2">{title}</p>
        <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white mt-1 sm:mt-1.5 tabular-nums break-words">
          {value ?? '—'}
        </p>
        {(trend !== undefined || trendLabel) && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
            {trend !== undefined && (
              <span className={trendIsGood ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                {trend >= 0 ? '+' : ''}{trend}%
              </span>
            )}
            {trendLabel && <span className="ml-1">{trendLabel}</span>}
          </p>
        )}
        {hint && !trendLabel && trend === undefined && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5 line-clamp-2">{hint}</p>
        )}
      </div>
      {Icon && (
        <div className={`h-9 w-9 sm:h-11 sm:w-11 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${accentClasses}`}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
        </div>
      )}
    </div>
  )

  if (to) {
    return (
      <Link
        to={to}
        className={`admin-stat-card group relative block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60 ${className}`}
      >
        {body}
        <ArrowUpRight
          className="absolute right-3 top-3 h-3.5 w-3.5 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-600"
          aria-hidden="true"
        />
      </Link>
    )
  }

  return <div className={`admin-stat-card group ${className}`}>{body}</div>
}

export default Card
