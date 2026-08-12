import { useCallback, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import toast from 'react-hot-toast'

import { appleWebLogin } from '../store/slices/authSlice'
import { preloadAppleSdk, signInWithApple } from '../services/appleSignIn'

/**
 * "Continue with Apple" for the web, shared by the login and signup pages so both
 * behave identically.
 *
 * Two failure sources are handled separately: the Apple popup itself (SDK
 * unreachable, Services ID/Return URL not registered, state mismatch) is toasted
 * here, while a rejected POST /auth/apple/web lands in `auth.error` and is toasted
 * by the page's existing error effect — the same route every other auth call takes,
 * so a deactivated account or an email/Apple conflict shows the server's own
 * message. A closed popup is not an error and must not read like one.
 *
 * Navigation is left to the caller's existing `isAuthenticated` effect: the thunk
 * stores the token exactly like OTP login does, so redirect + target handling
 * already works.
 *
 * A build with no Services ID configured keeps the button (the UI is identical in
 * every environment) and answers with the same "not configured yet" message the
 * API uses for an unconfigured provider.
 *
 * @param {{onStart?: () => void, onFinish?: () => void}} [callbacks] button state hooks
 * @returns {{startAppleSignIn: () => Promise<void>}}
 */
export function useAppleSignIn({ onStart, onFinish } = {}) {
  const dispatch = useDispatch()

  // Fetch Apple's SDK up front so the first click can open the popup immediately;
  // no-ops when Apple sign in is not configured for this build.
  useEffect(() => {
    preloadAppleSdk()
  }, [])

  const startAppleSignIn = useCallback(async () => {
    onStart?.()
    try {
      // Not awaited before this point: the popup must open in the click's own task,
      // or the browser blocks it as unrequested.
      const result = await signInWithApple()

      if (result.cancelled) {
        // Neutral, not an error toast — the user chose to back out.
        toast('Apple sign in was cancelled')
        return
      }

      const payload = await dispatch(
        appleWebLogin({
          identityToken: result.identityToken,
          authorizationCode: result.authorizationCode,
          user: result.user,
        })
      ).unwrap()

      toast.success(payload?.message || 'Signed in successfully')
    } catch (error) {
      // A rejected thunk throws its rejectWithValue payload — a plain object, not
      // an Error — and auth.error already carries it, so the page's error effect
      // toasts the server's message. Anything that IS an Error came from the Apple
      // popup (or is unexpected) and would otherwise fail silently.
      if (error instanceof Error) {
        toast.error(
          error.name === 'AppleSignInError' ? error.message : 'Apple sign in failed. Please try again.'
        )
      }
    } finally {
      onFinish?.()
    }
  }, [dispatch, onStart, onFinish])

  return { startAppleSignIn }
}

export default useAppleSignIn
