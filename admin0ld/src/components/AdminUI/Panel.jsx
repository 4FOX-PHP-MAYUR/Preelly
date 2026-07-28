import React from 'react'

function Panel({ children, className = '', padding = true, noBorder = false }) {
  return (
    <div
      className={`
        admin-panel rounded-xl bg-white dark:bg-slate-900
        ${noBorder ? '' : 'border border-slate-200/80 dark:border-slate-800 shadow-sm'}
        ${padding ? 'p-4 sm:p-6' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}

export default Panel
