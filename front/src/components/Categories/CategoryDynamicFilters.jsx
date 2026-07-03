import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { categoryService } from '@shared/services/api'
import { buildCategoryFilterGroups } from '@shared/utils/buildCategoryFilterGroups'

function CategoryDynamicFilters({
  categoryId,
  subcategoryId = '',
  childCategoryId = '',
  selectedFilterIds = [],
  onChange,
}) {
  const [filters, setFilters] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const scopeKey = [categoryId, subcategoryId, childCategoryId].filter(Boolean).join('>')

  useEffect(() => {
    if (!categoryId) {
      setFilters([])
      setError('')
      return undefined
    }

    let cancelled = false
    setLoading(true)
    setError('')

    const levels = {
      categoryId,
      ...(subcategoryId ? { subcategoryId } : {}),
      ...(childCategoryId ? { childCategoryId } : {}),
    }

    categoryService
      .getCategoryFilters(levels)
      .then((res) => {
        if (cancelled) return
        const list = Array.isArray(res?.data?.filters) ? res.data.filters : []
        setFilters(list)
        setError('')
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
  }, [categoryId, subcategoryId, childCategoryId, scopeKey])

  const groups = useMemo(() => buildCategoryFilterGroups(filters), [filters])

  const selectedSet = useMemo(() => new Set((selectedFilterIds || []).map(String)), [selectedFilterIds])

  const toggleFilterId = (filterId) => {
    if (!filterId || !onChange) return
    const id = String(filterId)
    const next = new Set(selectedSet)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange([...next])
  }

  if (!categoryId) return null

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-6 text-sm text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin text-brand" />
        Loading filters for this category…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {error}
      </div>
    )
  }

  if (!groups.length) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        No filters configured for this category yet. Select a subcategory if available.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Category filters</h3>
        <p className="mt-1 text-xs text-slate-500">
          Filters from admin, scoped to your category and subcategory selection.
        </p>
      </div>

      {groups.map((group) => (
        <div key={String(group.root._id)} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <p className="mb-3 text-sm font-semibold text-slate-800">{group.root.name}</p>
          <div className="flex flex-wrap gap-2">
            {group.options.map((opt) => {
              const id = opt.filterId || opt.value
              const active = selectedSet.has(String(id))
              return (
                <button
                  key={`${group.root._id}-${opt.value}`}
                  type="button"
                  onClick={() => toggleFilterId(id)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    active
                      ? 'bg-brand text-white shadow-sm shadow-brand/25'
                      : 'bg-white text-[#64748B] ring-1 ring-[#E4E7EF] hover:text-brand hover:ring-brand/30'
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export default CategoryDynamicFilters
