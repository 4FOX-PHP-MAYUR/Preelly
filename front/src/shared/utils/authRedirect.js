/**
 * Reads and clears the post-login destination stashed by LoginPage (set from
 * the shared "Login Required" modal's ?redirect= param). Consumed once by
 * whichever page completes the sign-in (OTP verify, OAuth success, ...).
 */
export function consumeAuthRedirect() {
  try {
    const value = localStorage.getItem('authRedirectTo')
    localStorage.removeItem('authRedirectTo')
    return value && value.startsWith('/') ? value : null
  } catch {
    return null
  }
}
