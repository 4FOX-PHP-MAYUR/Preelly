import { useEffect, useMemo, useRef, useState } from 'react'
import { categoryService } from '@shared/services/api'
import SearchableDropdown from './SearchableDropdown'

export default function MotorsCategoryCascadingDropdowns({
  rootLabel = 'Subcategory',
  subcategories = [],
  selectedHierarchy,
  layout = 'column',
  onSubcategoryChange,
  onBrandChange,
  onModelChange,
  onTrimChange,
}) {
  const childrenCacheRef = useRef(new Map())

  const [brandCategories, setBrandCategories] = useState([])
  const [modelCategories, setModelCategories] = useState([])
  const [trimCategories, setTrimCategories] = useState([])

  const [loadingBrand, setLoadingBrand] = useState(false)
  const [loadingModel, setLoadingModel] = useState(false)
  const [loadingTrim, setLoadingTrim] = useState(false)

  const selectedSubcategoryId = selectedHierarchy?.subcategory || ''
  const selectedBrandId = selectedHierarchy?.brand || ''
  const selectedModelId = selectedHierarchy?.model || ''

  const subcategoryOptions = useMemo(
    () =>
      (subcategories || [])
        .filter((c) => c && c._id)
        .map((c) => ({
          value: c._id,
          label: c.name || '',
        })),
    [subcategories],
  )

  const brandOptions = useMemo(
    () =>
      (brandCategories || [])
        .filter((c) => c && c._id)
        .map((c) => ({
          value: c._id,
          label: c.name || '',
        })),
    [brandCategories],
  )

  const modelOptions = useMemo(
    () =>
      (modelCategories || [])
        .filter((c) => c && c._id)
        .map((c) => ({
          value: c._id,
          label: c.name || '',
        })),
    [modelCategories],
  )

  const trimOptions = useMemo(
    () =>
      (trimCategories || [])
        .filter((c) => c && c._id)
        .map((c) => ({
          value: c._id,
          label: c.name || '',
        })),
    [trimCategories],
  )

  const emit = (handler, nextId, options) => {
    if (!handler) return
    const next = String(nextId || '').trim()
    const meta = next ? options.find((o) => String(o.value) === String(next)) || null : null
    // Backwards compatible: existing call sites expect (id).
    // New behavior: also pass meta as 2nd argument so pages can filter by label.
    handler(next, meta)
  }

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!selectedSubcategoryId) {
        setBrandCategories([])
        return
      }

      const cacheKey = `brand:${String(selectedSubcategoryId)}`
      const cached = childrenCacheRef.current.get(cacheKey)
      if (cached && Array.isArray(cached)) {
        setBrandCategories(cached)
        return
      }

      setLoadingBrand(true)
      try {
        const res = await categoryService.getCategoryChildren(selectedSubcategoryId)
        if (cancelled) return
        const items = Array.isArray(res.data) ? res.data : []
        childrenCacheRef.current.set(cacheKey, items)
        setBrandCategories(items)
      } catch {
        if (cancelled) return
        setBrandCategories([])
      } finally {
        if (cancelled) return
        setLoadingBrand(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [selectedSubcategoryId])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!selectedBrandId) {
        setModelCategories([])
        return
      }

      const cacheKey = `model:${String(selectedBrandId)}`
      const cached = childrenCacheRef.current.get(cacheKey)
      if (cached && Array.isArray(cached)) {
        setModelCategories(cached)
        return
      }

      setLoadingModel(true)
      try {
        const res = await categoryService.getCategoryChildren(selectedBrandId)
        if (cancelled) return
        const items = Array.isArray(res.data) ? res.data : []
        childrenCacheRef.current.set(cacheKey, items)
        setModelCategories(items)
      } catch {
        if (cancelled) return
        setModelCategories([])
      } finally {
        if (cancelled) return
        setLoadingModel(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [selectedBrandId])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!selectedModelId) {
        setTrimCategories([])
        return
      }

      const cacheKey = `trim:${String(selectedModelId)}`
      const cached = childrenCacheRef.current.get(cacheKey)
      if (cached && Array.isArray(cached)) {
        setTrimCategories(cached)
        return
      }

      setLoadingTrim(true)
      try {
        const res = await categoryService.getCategoryChildren(selectedModelId)
        if (cancelled) return
        const items = Array.isArray(res.data) ? res.data : []
        childrenCacheRef.current.set(cacheKey, items)
        setTrimCategories(items)
      } catch {
        if (cancelled) return
        setTrimCategories([])
      } finally {
        if (cancelled) return
        setLoadingTrim(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [selectedModelId])

  const isRow = layout === 'row'
  const containerClassName = isRow ? 'flex flex-wrap gap-3' : 'space-y-4'
  const itemClassName = isRow ? 'flex-[1_1_180px] min-w-[180px]' : ''

  return (
    <div className={containerClassName}>
      <div className={itemClassName}>
        <SearchableDropdown
          label={rootLabel}
          value={selectedSubcategoryId}
          options={subcategoryOptions}
          onChange={(id) => emit(onSubcategoryChange, id, subcategoryOptions)}
          placeholder={`All ${rootLabel}`}
          searchPlaceholder="Search subcategory..."
          allowClear
          clearLabel="All"
          loading={false}
        />
      </div>

      {selectedSubcategoryId && (
        <div className={itemClassName}>
          <SearchableDropdown
            label="Brand"
            value={selectedHierarchy?.brand || ''}
            options={brandOptions}
            onChange={(id) => emit(onBrandChange, id, brandOptions)}
            placeholder="Select brand"
            searchPlaceholder="Search brand..."
            allowClear
            clearLabel="Any brand"
            loading={loadingBrand}
          />
        </div>
      )}

      {selectedBrandId && (
        <div className={itemClassName}>
          <SearchableDropdown
            label="Model"
            value={selectedHierarchy?.model || ''}
            options={modelOptions}
            onChange={(id) => emit(onModelChange, id, modelOptions)}
            placeholder="Select model"
            searchPlaceholder="Search model..."
            allowClear
            clearLabel="Any model"
            loading={loadingModel}
          />
        </div>
      )}

      {selectedModelId && (
        <div className={itemClassName}>
          <SearchableDropdown
            label="Trim"
            value={selectedHierarchy?.trim || ''}
            options={trimOptions}
            onChange={(id) => emit(onTrimChange, id, trimOptions)}
            placeholder="Select trim"
            searchPlaceholder="Search trim..."
            allowClear
            clearLabel="Any trim"
            loading={loadingTrim}
          />
        </div>
      )}
    </div>
  )
}

