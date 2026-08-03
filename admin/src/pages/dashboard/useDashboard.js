import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { dashboardService } from '@/services/api'
import { isRangeReady, toQueryParams } from './dashboardConstants'

/**
 * Data hooks for the dashboard.
 *
 * Two behaviours matter here:
 *  - **Refetch keeps the frame.** On a filter change the previous payload stays
 *    mounted and `refreshing` goes true, so charts dim rather than collapsing
 *    into skeletons. `loading` is only true for the very first fetch.
 *  - **Stale responses are dropped.** Every request carries a sequence number;
 *    a slow response for an older filter set is ignored.
 */
function useDashboardResource(fetcher, filters, { enabled = true, extraKey = '' } = {}) {
  const ready = enabled && isRangeReady(filters)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(ready)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  const sequence = useRef(0)
  const hasLoaded = useRef(false)
  const params = useMemo(() => toQueryParams(filters), [filters])
  const key = `${JSON.stringify(params)}|${extraKey}`

  const load = useCallback(async () => {
    if (!ready) {
      // A half-filled custom range isn't an error — hold the last render and
      // stop showing skeletons rather than spinning forever.
      setLoading(false)
      setRefreshing(false)
      return
    }
    const requestId = sequence.current + 1
    sequence.current = requestId

    if (hasLoaded.current) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const response = await fetcher(params)
      if (sequence.current !== requestId) return // a newer request won
      setData(response.data)
      hasLoaded.current = true
    } catch (err) {
      if (sequence.current !== requestId) return
      // Route-scoped aborts are expected on navigation — not an error state.
      if (err.code === 'ERR_CANCELED' || err.name === 'CanceledError') return
      setError(err.response?.data?.message || err.message || 'Failed to load dashboard data')
    } finally {
      if (sequence.current === requestId) {
        setLoading(false)
        setRefreshing(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready])

  useEffect(() => {
    load()
  }, [load])

  return { data, loading, refreshing, error, reload: load }
}

export function useDashboardSummary(filters) {
  return useDashboardResource(dashboardService.getSummary, filters)
}

export function useDashboardCharts(filters, { enabled = true } = {}) {
  return useDashboardResource(dashboardService.getCharts, filters, { enabled })
}

export function useDashboardInsights(filters, { enabled = true } = {}) {
  return useDashboardResource(dashboardService.getInsights, filters, { enabled })
}

export function useDashboardPerformance({ enabled = true } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!enabled) return
    try {
      setLoading(true)
      const response = await dashboardService.getPerformance()
      setData(response.data?.performance || null)
      setError(null)
    } catch (err) {
      if (err.code === 'ERR_CANCELED' || err.name === 'CanceledError') return
      setError(err.response?.data?.message || 'Failed to load performance metrics')
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    load()
  }, [load])

  return { data, loading, error, reload: load }
}

/**
 * Paginated dashboard table with optional sort. Page resets to 1 whenever the
 * global filters or the sort change, so the reader never lands on page 4 of a
 * shorter result set.
 */
export function useDashboardTable(table, filters, { enabled = true, limit = 10, sort } = {}) {
  const [page, setPage] = useState(1)
  const params = useMemo(() => toQueryParams(filters), [filters])
  const filterKey = JSON.stringify(params)

  useEffect(() => {
    setPage(1)
  }, [filterKey, sort])

  const fetcher = useCallback(
    (query) =>
      dashboardService.getTable(table, {
        ...query,
        page,
        limit,
        ...(sort ? { sort } : {}),
      }),
    [table, page, limit, sort],
  )

  const resource = useDashboardResource(fetcher, filters, {
    enabled,
    extraKey: `${page}|${limit}|${sort || ''}`,
  })

  return { ...resource, page, setPage, limit }
}

/** Filter dropdown options — fetched once, they don't depend on the range. */
export function useDashboardFilterOptions() {
  const [options, setOptions] = useState(null)

  useEffect(() => {
    let cancelled = false
    dashboardService
      .getFilterOptions()
      .then((response) => {
        if (!cancelled) setOptions(response.data?.options || null)
      })
      .catch(() => {
        // Filter bar degrades to the range selector alone — not worth a toast.
      })
    return () => {
      cancelled = true
    }
  }, [])

  return options
}

/**
 * Defer a heavy section until it scrolls near the viewport.
 * Returns `[ref, isVisible]`; once visible it stays visible.
 */
export function useLazySection({ rootMargin = '200px' } = {}) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (visible) return undefined
    const node = ref.current
    if (!node) return undefined

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [visible, rootMargin])

  return [ref, visible]
}
