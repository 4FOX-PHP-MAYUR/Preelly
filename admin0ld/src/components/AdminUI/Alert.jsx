import React from 'react'
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react'

const variants = {
  info: {
    icon: Info,
    classes: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-200',
    iconClass: 'text-blue-600 dark:text-blue-400',
  },
  success: {
    icon: CheckCircle2,
    classes: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200',
    iconClass: 'text-emerald-600 dark:text-emerald-400',
  },
  warning: {
    icon: AlertTriangle,
    classes: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200',
    iconClass: 'text-amber-600 dark:text-amber-400',
  },
  error: {
    icon: AlertCircle,
    classes: 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-800 dark:text-red-200',
    iconClass: 'text-red-600 dark:text-red-400',
  },
}

function Alert({ variant = 'info', title, children, onDismiss, className = '' }) {
  const config = variants[variant] || variants.info
  const Icon = config.icon

  return (
    <div className={`flex gap-3 rounded-xl border p-4 ${config.classes} ${className}`} role="alert">
      <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${config.iconClass}`} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        {title && <p className="font-medium mb-0.5">{title}</p>}
        {children && <div className="text-sm opacity-90">{children}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 p-1 rounded-md opacity-60 hover:opacity-100 transition-opacity"
          aria-label="Dismiss alert"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

export default Alert
