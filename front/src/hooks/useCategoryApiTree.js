import { useEffect, useMemo, useState } from 'react'
import { categoryService } from '@shared/services/api'
import {
  isClassifiedsCategoryName,
  isPropertyCategoryName,
} from '../components/Categories/categoryBrowseShared'

/**
 * Fetches property or classifieds category trees for dynamic filter forms.
 * Returns null apiType for categories that use the default form flow.
 */
export function useCategoryApiTree(categoryName) {
  const apiType = useMemo(() => {
    if (isPropertyCategoryName(categoryName)) return 'property'
    if (isClassifiedsCategoryName(categoryName)) return 'classifieds'
    return null
  }, [categoryName])

  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!apiType) {
      setCategories([])
      setError('')
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)
    setError('')

    const fetcher =
      apiType === 'property'
        ? categoryService.getPropertyCategories
        : categoryService.getClassifiedCategories

    fetcher()
      .then((res) => {
        if (cancelled) return
        const list = Array.isArray(res?.data) ? res.data : []
        setCategories(list)
        setError('')
      })
      .catch((err) => {
        if (cancelled) return
        setCategories([])
        setError(err?.response?.data?.message || 'Failed to load categories')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [apiType])

  return { apiType, categories, loading, error }
}
