import React from 'react'
import { Inbox } from 'lucide-react'
import Button from './Button'

function EmptyState({
  icon: Icon = Inbox,
  title = 'No data found',
  description,
  action,
  actionLabel,
  onAction,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      <div className="h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <Icon className="h-7 w-7 text-slate-400 dark:text-slate-500" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-4">{description}</p>
      )}
      {(action || onAction) && (
        action || <Button onClick={onAction}>{actionLabel || 'Get started'}</Button>
      )}
    </div>
  )
}

export default EmptyState
