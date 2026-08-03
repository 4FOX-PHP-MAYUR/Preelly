import { useLoginPrompt } from '../components/LoginPrompt/LoginPromptContext'

/**
 * `const requireAuth = useRequireAuth()`
 * `if (!requireAuth('Please login to like products')) return`
 *
 * Returns true when the user is already authenticated. Otherwise shows the
 * shared "Login Required" confirmation modal and returns false — callers
 * should bail out of the action exactly like they used to on a redirect.
 */
export function useRequireAuth() {
  const { requireAuth } = useLoginPrompt()
  return requireAuth
}

export default useRequireAuth
