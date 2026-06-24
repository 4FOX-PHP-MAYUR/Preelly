import React from 'react'

const statusStyles = {
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
  sold: 'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300',
  inactive: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
}

const dotStyles = {
  approved: 'bg-emerald-500',
  active: 'bg-emerald-500',
  pending: 'bg-amber-500',
  rejected: 'bg-red-500',
  sold: 'bg-violet-500',
  inactive: 'bg-slate-400',
}

function StatusBadge({ status, showDot = true, className = '' }) {
  const normalized = String(status || 'unknown').toLowerCase()
  const cls = statusStyles[normalized] || statusStyles.inactive
  const dot = dotStyles[normalized] || dotStyles.inactive
  const label = String(status).charAt(0).toUpperCase() + String(status).slice(1)

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${cls} ${className}`}>
      {showDot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />}
      {label}
    </span>
  )
}

export default StatusBadge
