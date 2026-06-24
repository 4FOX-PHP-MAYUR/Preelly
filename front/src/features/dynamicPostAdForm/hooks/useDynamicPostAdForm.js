import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildPostAdPayload } from '../domain/buildPostAdPayload'
import { getDefaultValueForField } from '../domain/getDefaultValueForField'
import { pruneInvalidDependentValues } from '../domain/pruneInvalidDependentValues'
import { validateRequired } from '../domain/validateRequired'

function getCategoryById(config, categoryId) {
  if (!config || !Array.isArray(config.categories)) return null
  return config.categories.find((c) => c.id === categoryId) || null
}

export function useDynamicPostAdForm({ config, initialCategoryId }) {
  const categories = useMemo(() => config?.categories || [], [config])

  const resolvedInitialCategoryId =
    initialCategoryId || categories[0]?.id || ''

  const [selectedCategoryId, setSelectedCategoryId] = useState(resolvedInitialCategoryId)
  const [isSwitching, setIsSwitching] = useState(false)

  const category = useMemo(
    () => getCategoryById(config, selectedCategoryId),
    [config, selectedCategoryId]
  )

  const fields = useMemo(() => category?.fields || [], [category])

  const [formData, setFormData] = useState({})
  const [filters, setFilters] = useState({})
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [hasSubmitted, setHasSubmitted] = useState(false)

  const didMountRef = useRef(false)

  const initStateForFields = useCallback(
    (activeFields) => {
      const next = {}
      for (const field of activeFields) {
        next[field.name] = getDefaultValueForField(field)
      }
      setFormData(next)
      setFilters(next)
      setErrors({})
      setTouched({})
      setHasSubmitted(false)
    },
    []
  )

  useEffect(() => {
    // If the selected category no longer exists in the (newly loaded) config, reset it.
    if (!Array.isArray(categories) || categories.length === 0) return
    const exists = categories.some((c) => c.id === selectedCategoryId)
    if (!selectedCategoryId || !exists) {
      setSelectedCategoryId(categories[0].id)
    }
  }, [categories, selectedCategoryId])

  useEffect(() => {
    const activeFields = fields
    if (!didMountRef.current) {
      initStateForFields(activeFields)
      didMountRef.current = true
      return
    }

    setIsSwitching(true)
    const timer = setTimeout(() => {
      initStateForFields(activeFields)
      setIsSwitching(false)
    }, 450)

    return () => clearTimeout(timer)
  }, [fields, initStateForFields, selectedCategoryId])

  // Keep filters in sync with formData (filters are field-driven state).
  useEffect(() => {
    setFilters(formData)
  }, [formData])

  const setFieldValue = useCallback(
    (field, nextValue) => {
      if (!field) return

      setHasSubmitted(false)
      setTouched((prev) => ({ ...prev, [field.name]: true }))

      setFormData((prevFormData) => {
        const next = { ...(prevFormData || {}), [field.name]: nextValue }
        const pruned = pruneInvalidDependentValues(fields, next)
        // Validate required fields as user types (so errors appear instantly).
        const nextErrors = validateRequired(fields, pruned)
        setErrors(nextErrors)
        return pruned
      })
    },
    [fields]
  )

  const previewPayload = useMemo(() => {
    return buildPostAdPayload(selectedCategoryId, fields, formData)
  }, [selectedCategoryId, fields, formData])

  const submit = useCallback(() => {
    setHasSubmitted(true)
    const nextErrors = validateRequired(fields, formData)
    setErrors(nextErrors)

    const isValid = Object.keys(nextErrors).length === 0
    if (!isValid) return null
    return buildPostAdPayload(selectedCategoryId, fields, formData)
  }, [fields, formData, selectedCategoryId])

  return {
    categories,
    selectedCategoryId,
    setSelectedCategoryId,
    fields,
    isSwitching,
    formData,
    filters,
    errors,
    touched,
    hasSubmitted,
    previewPayload,
    setFieldValue,
    submit
  }
}

