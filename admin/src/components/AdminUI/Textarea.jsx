import React from 'react'

function Textarea({ label, error, hint, className = '', id, required, rows = 4, ...props }) {
  const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label htmlFor={textareaId} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
          {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
        </label>
      )}
      <textarea
        id={textareaId}
        rows={rows}
        required={required}
        className={`admin-input w-full resize-y min-h-[80px] ${error ? 'border-red-300 dark:border-red-700 focus:ring-red-500' : ''}`}
        aria-invalid={error ? 'true' : undefined}
        {...props}
      />
      {hint && !error && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      {error && <p className="text-xs text-red-600 dark:text-red-400" role="alert">{error}</p>}
    </div>
  )
}

export default Textarea
