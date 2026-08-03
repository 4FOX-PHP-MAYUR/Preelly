import React from 'react'
import { Star } from 'lucide-react'

/** 1–5 star rating. Pass `onChange` for an interactive control, omit it for read-only display. */
function StarRating({ value = 0, onChange, size = 'md', className = '' }) {
  const readOnly = typeof onChange !== 'function'
  const sizeClass = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'

  return (
    <div className={`flex items-center gap-0.5 ${className}`} role={readOnly ? 'img' : 'radiogroup'} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value
        const starIcon = (
          <Star
            className={`${sizeClass} ${filled ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'}`}
            aria-hidden="true"
          />
        )
        if (readOnly) {
          return <span key={star}>{starIcon}</span>
        }
        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
            aria-checked={value === star}
            role="radio"
          >
            {starIcon}
          </button>
        )
      })}
    </div>
  )
}

export default StarRating
