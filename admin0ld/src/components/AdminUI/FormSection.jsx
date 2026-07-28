import React from 'react'

function FormSection({ title, description, children, className = '' }) {
  return (
    <section className={`space-y-4 ${className}`}>
      {(title || description) && (
        <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
          {title && <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>}
          {description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>}
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </section>
  )
}

export default FormSection
