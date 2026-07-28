import React from 'react'

function Checkbox({ label, description, className = '', id, ...props }) {
  const checkboxId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  return (
    <label htmlFor={checkboxId} className={`flex items-start gap-3 cursor-pointer group ${className}`}>
      <input
        id={checkboxId}
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500 dark:bg-slate-800"
        {...props}
      />
      <span className="flex flex-col">
        {label && (
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">
            {label}
          </span>
        )}
        {description && (
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</span>
        )}
      </span>
    </label>
  )
}

export default Checkbox
