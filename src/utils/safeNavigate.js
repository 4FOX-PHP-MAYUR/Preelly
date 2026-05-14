import { isValidObjectId } from './helpers'

// Safe wrapper for navigate to user pages
export function navigateToUser(navigate, userId, suffix = '') {
  if (!userId || !isValidObjectId(String(userId))) {
    console.warn('navigateToUser prevented navigation to invalid id:', userId)
    return false
  }
  navigate(`/user/${userId}${suffix}`)
  return true
}

