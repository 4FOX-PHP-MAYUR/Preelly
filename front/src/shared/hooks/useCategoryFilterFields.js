import { useEffect, useMemo, useState } from 'react'
import {
  buildCategoryFilterFields,
  fetchCategoryFiltersForPath,
} from '@shared/utils/categoryFilterFields'

/**
 * Loads the admin-configured filters for a category path (root → leaf) and
 * turns them into renderable fields. Shared by the search page and the listing
 * filter sidebar so both always show the same set of filters.
 *
 * @param {string[]} categoryPath ids from root to the selected leaf
 * @param {{ enabled?: boolean }} [options]
 */
export function useCategoryFilterFields(categoryPath, { enabled = true } = {}) {
  const pathKey = (categoryPath || []).map(String).filter(Boolean).join(',')
  const [filters, setFilters] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!enabled || !pathKey) {
      setFilters([])
      setError('')
      return undefined
    }

    let cancelled = false
    setLoading(true)
    setError('')

    fetchCategoryFiltersForPath(pathKey.split(','))
      .then(({ filters: list }) => {
        if (cancelled) return
        setFilters(list)
      })
      .catch((err) => {
        if (cancelled) return
        setFilters([])
        setError(err?.response?.data?.message || 'Failed to load filters')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [pathKey, enabled])

  const fields = useMemo(() => buildCategoryFilterFields(filters), [filters])

  return { fields, filters, loading, error }
}

export default useCategoryFilterFields
