import React from 'react'

const Input = React.forwardRef(function Input(
  {
    label,
    error,
    hint,
    icon: Icon,
    iconRight: IconRight,
    className = '',
    inputClassName = '',
    id,
    required,
    ...props
  },
  ref
) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
          {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" aria-hidden="true" />
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            admin-input w-full
            ${Icon ? 'pl-10' : ''}
            ${IconRight ? 'pr-10' : ''}
            ${error ? 'border-red-300 dark:border-red-700 focus:ring-red-500' : ''}
            ${inputClassName}
          `}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...props}
        />
        {IconRight && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            <IconRight className="h-4 w-4" aria-hidden="true" />
          </div>
        )}
      </div>
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      )}
      {error && (
        <p id={`${inputId}-error`} className="text-xs text-red-600 dark:text-red-400" role="alert">{error}</p>
      )}
    </div>
  )
})

export default Input
