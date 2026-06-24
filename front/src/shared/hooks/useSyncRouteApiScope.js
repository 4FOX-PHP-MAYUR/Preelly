import { useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { rotateRouteApiScope } from '../services/apiScope'

/**
 * Abort the previous page's API calls before child effects run (fixes pending/stuck loaders).
 * React runs child useEffects before parent useEffects — rotating in App useEffect was
 * cancelling requests that had just started on the new page.
 */
export function useSyncRouteApiScope() {
  const location = useLocation()
  const prevPathnameRef = useRef(location.pathname)

  if (prevPathnameRef.current !== location.pathname) {
    rotateRouteApiScope()
    prevPathnameRef.current = location.pathname
  }
}
