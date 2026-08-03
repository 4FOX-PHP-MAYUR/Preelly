import React from 'react'

/**
 * Loading placeholders for the admin design system.
 *
 * Shapes mirror the content they stand in for, so nothing shifts when real data
 * lands. Marked `aria-hidden` — the surrounding region carries `aria-busy`.
 */
function Skeleton({ className = '', rounded = 'rounded-md', style }) {
  return (
    <div
      aria-hidden="true"
      style={style}
      className={`animate-pulse bg-slate-200/80 dark:bg-slate-800 ${rounded} ${className}`}
    />
  )
}

/** Matches the footprint of a `Card` stat tile. */
export function SkeletonStatCard() {
  return (
    <div className="admin-stat-card" aria-hidden="true">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-9 w-9 shrink-0 sm:h-11 sm:w-11" rounded="rounded-xl" />
      </div>
    </div>
  )
}

export function SkeletonChart({ height = 240 }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="flex items-end gap-2" style={{ height }}>
        {[58, 74, 42, 88, 63, 95, 51, 79, 68, 46, 84, 60].map((percent, index) => (
          <Skeleton key={index} className="flex-1" style={{ height: `${percent}%` }} rounded="rounded-t-md" />
        ))}
      </div>
      <Skeleton className="h-3 w-1/3" />
    </div>
  )
}

export function SkeletonTable({ rows = 5, columns = 4 }) {
  return (
    <div className="space-y-2 p-4" aria-hidden="true">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-3">
          {Array.from({ length: columns }).map((__, colIndex) => (
            <Skeleton
              key={colIndex}
              className={`h-4 ${colIndex === 0 ? 'w-1/3' : 'flex-1'}`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonList({ rows = 4 }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 shrink-0" rounded="rounded-lg" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
          <Skeleton className="h-3 w-12 shrink-0" />
        </div>
      ))}
    </div>
  )
}

export default Skeleton
