import React from 'react'
import { Loader2 } from 'lucide-react'

function LoadingSpinner({ message = 'Loading...', size = 'md', className = '' }) {
  const sizes = { sm: 'h-6 w-6', md: 'h-10 w-10', lg: 'h-12 w-12' }

  return (
    <div className={`flex flex-col items-center justify-center py-12 ${className}`} role="status" aria-live="polite">
      <Loader2 className={`${sizes[size] || sizes.md} animate-spin text-primary-600`} aria-hidden="true" />
      {message && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{message}</p>}
      <span className="sr-only">{message}</span>
    </div>
  )
}

export default LoadingSpinner
