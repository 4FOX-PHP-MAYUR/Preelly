import React from 'react'

function PageHeader({ title, subtitle, action, className = '' }) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 ${className}`}>
      <div className="min-w-0 flex-1">
        {title && (
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 dark:text-white tracking-tight break-words">
            {title}
          </h2>
        )}
        {subtitle && (
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 break-all sm:break-words">
            {subtitle}
          </p>
        )}
      </div>
      {action && (
        <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto [&_button]:w-full sm:[&_button]:w-auto">
          {action}
        </div>
      )}
    </div>
  )
}

export default PageHeader
