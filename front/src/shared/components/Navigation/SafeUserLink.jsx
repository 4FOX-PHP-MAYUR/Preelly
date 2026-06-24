import React from 'react'
import { Link } from 'react-router-dom'
import { isValidObjectId } from '@shared/utils/helpers'

// Resolve userId when caller passes either an id string or a user object.
function resolveUserId(input) {
  if (!input) return null
  if (typeof input === 'string') return input
  if (typeof input === 'object') {
    // common id fields from various responses
    const id = input._id || input.id || input.userId || (input.seller && (input.seller._id || input.seller.id))
    if (id) return String(id)
  }
  return null
}

// Renders a real Link only when a valid user id can be resolved; otherwise renders a non-clickable span.
export default function SafeUserLink({ userId, children, className = '', suffix = '', ...rest }) {
  const resolved = resolveUserId(userId)
  if (!resolved || !isValidObjectId(resolved)) {
    // Use debug-level log to avoid spamming warnings for many feed items.
    console.debug('SafeUserLink blocked invalid userId:', userId)
    return <span className={className} {...rest}>{children}</span>
  }
  const to = `/user/${resolved}${suffix}`
  return (
    <Link to={to} className={className} {...rest}>
      {children}
    </Link>
  )
}

