import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'
import { selectIsAuthenticated } from '../../store/slices/authSlice'
import LoginRequiredModal from './LoginRequiredModal'

const LoginPromptContext = createContext(null)

const DEFAULT_MESSAGE = 'You need to log in to perform this action. Would you like to log in now?'

/**
 * Centralizes the "guest tried a protected action" flow: instead of every
 * feature redirecting to /login on its own, it asks this context whether the
 * user is authenticated. If not, a shared confirmation modal is shown and the
 * current page (so the user lands back on it, action still in reach) is
 * captured as the post-login redirect target.
 */
export function LoginPromptProvider({ children }) {
  const [prompt, setPrompt] = useState(null)
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const navigate = useNavigate()
  const location = useLocation()

  const closePrompt = useCallback(() => setPrompt(null), [])

  const requireAuth = useCallback(
    (message) => {
      if (isAuthenticated) return true
      setPrompt({ message: message || DEFAULT_MESSAGE })
      return false
    },
    [isAuthenticated]
  )

  const handleLogin = useCallback(() => {
    const redirectTo = `${location.pathname}${location.search}${location.hash}`
    setPrompt(null)
    navigate(`/login?redirect=${encodeURIComponent(redirectTo)}`)
  }, [navigate, location])

  const value = useMemo(() => ({ requireAuth }), [requireAuth])

  return (
    <LoginPromptContext.Provider value={value}>
      {children}
      <LoginRequiredModal
        open={Boolean(prompt)}
        message={prompt?.message}
        onLogin={handleLogin}
        onClose={closePrompt}
      />
    </LoginPromptContext.Provider>
  )
}

export function useLoginPrompt() {
  const ctx = useContext(LoginPromptContext)
  if (!ctx) throw new Error('useLoginPrompt must be used within a LoginPromptProvider')
  return ctx
}
