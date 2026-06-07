/**
 * Per-route axios scope: abort page-scoped in-flight calls when navigating away.
 * Must rotate synchronously during render (before child useEffects) — see useSyncRouteApiScope().
 */
let routeAbortController = new AbortController()

export function getRouteAbortSignal() {
  return routeAbortController.signal
}

export function rotateRouteApiScope() {
  routeAbortController.abort()
  routeAbortController = new AbortController()
}
