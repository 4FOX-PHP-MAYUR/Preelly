import React from 'react'

const accentMap = {
  default: 'bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400',
  yellow: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
  green: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
  purple: 'bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400',
  red: 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400',
}

function Card({ title, value, icon: Icon, trend, trendLabel, accent = 'default', className = '' }) {
  const accentClasses = accentMap[accent] || accentMap.default

  return (
    <div className={`admin-stat-card group ${className}`}>
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 truncate">{title}</p>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white mt-1 sm:mt-1.5 tabular-nums break-words">
            {value ?? '—'}
          </p>
          {(trend !== undefined || trendLabel) && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
              {trend !== undefined && (
                <span className={trend >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                  {trend >= 0 ? '+' : ''}{trend}%
                </span>
              )}
              {trendLabel && <span className="ml-1">{trendLabel}</span>}
            </p>
          )}
        </div>
        {Icon && (
          <div className={`h-9 w-9 sm:h-11 sm:w-11 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${accentClasses}`}>
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
          </div>
        )}
      </div>
    </div>
  )
}

export default Card
