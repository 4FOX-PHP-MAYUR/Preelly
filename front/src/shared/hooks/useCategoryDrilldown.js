import { useCallback, useEffect, useRef, useState } from 'react'
import { categoryService } from '@shared/services/api'

/**
 * Depth-agnostic category drill-down, mirroring the Post Ad step-1 logic:
 *   - roots come from GET /api/categories?parent_id=
 *   - selecting a category with `isChild === 1` loads its children
 *     (GET /api/categories?parent_id=<id>) and opens the next level
 *   - `isChild !== 1`, or a category whose children come back empty, is a leaf
 *
 * Levels are appended until a leaf is reached, or until `maxLevels` if the
 * caller caps the depth.
 */

/** A category is a leaf when the API says it has no children. */
export const isLeafCategory = (category) => Number(category?.isChild) !== 1

/**
 * How many levels the picker walks before treating the selection as final:
 * root → subcategory → child category. Mirrors the Post Ad flow's
 * MAX_CATEGORY_LEVEL_INDEX (2) so both screens stop at the same depth.
 */
export const MAX_CATEGORY_PATH_LENGTH = 3

/**
 * @param {{ maxLevels?: number }} [options] cap on how deep the picker drills;
 *   defaults to unlimited nesting.
 */
export function useCategoryDrilldown({ maxLevels = Infinity } = {}) {
  // levelOptions[i] holds the options shown at level i; selectedPath[i] the pick.
  const [levelOptions, setLevelOptions] = useState([[]])
  const [selectedPath, setSelectedPath] = useState([])
  const [loadingRoots, setLoadingRoots] = useState(false)
  const [loadingChildren, setLoadingChildren] = useState(false)
  const [error, setError] = useState('')
  // Set once the deepest pick turned out to be a leaf — filters can be loaded.
  const [isComplete, setIsComplete] = useState(false)
  const requestIdRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    setLoadingRoots(true)
    categoryService
      .getCategoryChildren(null)
      .then((res) => {
        if (cancelled) return
        setLevelOptions([Array.isArray(res.data) ? res.data : []])
        setError('')
      })
      .catch((err) => {
        if (cancelled) return
        setLevelOptions([[]])
        setError(err?.response?.data?.message || 'Failed to load categories')
      })
      .finally(() => {
        if (!cancelled) setLoadingRoots(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  /**
   * Pick `categoryId` at `level`. Any deeper selection is discarded, then the
   * next level is loaded when the category has children.
   */
  const selectAtLevel = useCallback(
    async (level, categoryId) => {
      if (!categoryId) return
      const requestId = ++requestIdRef.current
      const options = levelOptions[level] || []
      const selected = options.find((c) => String(c._id) === String(categoryId))

      const nextPath = [...selectedPath.slice(0, level), categoryId]
      setSelectedPath(nextPath)
      setIsComplete(false)

      // A leaf, or the deepest level we're allowed to show, ends the selection.
      if (isLeafCategory(selected) || nextPath.length >= maxLevels) {
        setLevelOptions((prev) => prev.slice(0, level + 1))
        setIsComplete(true)
        return
      }

      setLoadingChildren(true)
      try {
        const res = await categoryService.getCategoryChildren(categoryId)
        if (requestId !== requestIdRef.current) return
        const children = Array.isArray(res.data) ? res.data : []
        if (children.length === 0) {
          // `isChild` claimed children but none are active — treat as a leaf.
          setLevelOptions((prev) => prev.slice(0, level + 1))
          setIsComplete(true)
          return
        }
        setLevelOptions((prev) => [...prev.slice(0, level + 1), children])
        setError('')
      } catch (err) {
        if (requestId !== requestIdRef.current) return
        setLevelOptions((prev) => prev.slice(0, level + 1))
        setError(err?.response?.data?.message || 'Failed to load subcategories')
      } finally {
        if (requestId === requestIdRef.current) setLoadingChildren(false)
      }
    },
    [levelOptions, selectedPath, maxLevels],
  )

  /**
   * Drop the selection at `level` and everything below it, keeping that level's
   * options on screen so the user can pick again.
   */
  const clearFromLevel = useCallback((level) => {
    requestIdRef.current += 1
    setSelectedPath((prev) => prev.slice(0, level))
    setLevelOptions((prev) => prev.slice(0, level + 1))
    setIsComplete(false)
  }, [])

  const reset = useCallback(() => {
    requestIdRef.current += 1
    setSelectedPath([])
    setLevelOptions((prev) => prev.slice(0, 1))
    setIsComplete(false)
  }, [])

  /**
   * Re-open a saved path (e.g. from URL params) by walking it level by level so
   * every level's options are available for editing.
   */
  const hydratePath = useCallback(async (pathIds) => {
    const ids = (pathIds || []).map(String).filter(Boolean)
    if (!ids.length) return
    const requestId = ++requestIdRef.current
    setLoadingChildren(true)
    try {
      const rootsRes = await categoryService.getCategoryChildren(null)
      const levels = [Array.isArray(rootsRes.data) ? rootsRes.data : []]
      const resolved = []

      for (let i = 0; i < Math.min(ids.length, maxLevels); i += 1) {
        const options = levels[i] || []
        const match = options.find((c) => String(c._id) === String(ids[i]))
        if (!match) break
        resolved.push(String(match._id))
        if (isLeafCategory(match) || resolved.length >= maxLevels) break
        const childRes = await categoryService.getCategoryChildren(match._id)
        const children = Array.isArray(childRes.data) ? childRes.data : []
        if (!children.length) break
        levels.push(children)
      }

      if (requestId !== requestIdRef.current) return
      setLevelOptions(levels)
      setSelectedPath(resolved)
      setIsComplete(resolved.length > 0 && levels.length === resolved.length)
    } catch (err) {
      if (requestId !== requestIdRef.current) return
      setError(err?.response?.data?.message || 'Failed to restore category selection')
    } finally {
      if (requestId === requestIdRef.current) setLoadingChildren(false)
    }
  }, [maxLevels])

  const selectedCategories = selectedPath.map(
    (id, level) => (levelOptions[level] || []).find((c) => String(c._id) === String(id)) || null,
  )
  const leafCategory = isComplete ? selectedCategories[selectedCategories.length - 1] : null

  return {
    levelOptions,
    selectedPath,
    selectedCategories,
    categoryPathNames: selectedCategories.filter(Boolean).map((c) => c.name),
    leafCategory,
    leafCategoryId: isComplete ? selectedPath[selectedPath.length - 1] || '' : '',
    isComplete,
    loading: loadingRoots || loadingChildren,
    loadingRoots,
    loadingChildren,
    error,
    selectAtLevel,
    clearFromLevel,
    hydratePath,
    reset,
  }
}

export default useCategoryDrilldown
