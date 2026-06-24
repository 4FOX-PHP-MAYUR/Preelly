import React from 'react'
import { ChevronDown } from 'lucide-react'

function Select({
  label,
  error,
  hint,
  options = [],
  placeholder,
  className = '',
  id,
  required,
  children,
  ...props
}) {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
          {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          required={required}
          className={`
            admin-input w-full appearance-none pr-10
            ${error ? 'border-red-300 dark:border-red-700 focus:ring-red-500' : ''}
          `}
          aria-invalid={error ? 'true' : undefined}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {children ||
            options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" aria-hidden="true" />
      </div>
      {hint && !error && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      {error && <p className="text-xs text-red-600 dark:text-red-400" role="alert">{error}</p>}
    </div>
  )
}

export default Select
