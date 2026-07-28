/**
 * Per-route axios scope: abort page-scoped in-flight calls when navigating away.
 * The api request interceptor attaches this signal to non-persistent calls. The admin
 * app does not currently rotate the scope, so the signal is effectively inert — kept
 * here so the interceptor behaves identically to the shared implementation and so
 * route-scoped cancellation can be wired up later without touching the API layer.
 */
let routeAbortController = new AbortController()

export function getRouteAbortSignal() {
  return routeAbortController.signal
}

export function rotateRouteApiScope() {
  routeAbortController.abort()
  routeAbortController = new AbortController()
}
