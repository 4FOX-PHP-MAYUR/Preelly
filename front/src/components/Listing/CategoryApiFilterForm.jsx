import { Loader2 } from 'lucide-react'
import { memo, useMemo } from 'react'
import CategoryIconGrid from './CategoryIconGrid'
import FilterChips from './FilterChips'
import FilterSection from './FilterSection'

/**
 * Dynamic filter form built from property-categories or classifieds/categories API trees.
 */
function CategoryApiFilterForm({
  categories = [],
  loading = false,
  error = '',
  selectedParentId = '',
  selectedSubcategoryId = '',
  onParentChange,
  onSubcategoryChange,
}) {
  const selectedParent = useMemo(
    () => categories.find((c) => String(c._id) === String(selectedParentId)),
    [categories, selectedParentId],
  )

  const subcategories = selectedParent?.subcategories || []

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-6 text-sm text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin text-brand" />
        Loading categories…
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

  if (!categories.length) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        No categories available.
      </p>
    )
  }

  return (
    <div className="space-y-1">
      <FilterSection title="Category" defaultOpen>
        <CategoryIconGrid
          items={categories}
          selectedId={selectedParentId}
          onSelect={(id) => onParentChange?.(id)}
        />
      </FilterSection>

      {selectedParentId && subcategories.length > 0 ? (
        <FilterSection title="Subcategory" defaultOpen>
          <FilterChips
            options={subcategories.map((s) => ({ value: s._id, label: s.name }))}
            value={selectedSubcategoryId}
            onChange={(id) => onSubcategoryChange?.(id)}
            allowAny
            anyLabel="All"
          />
        </FilterSection>
      ) : null}
    </div>
  )
}

export default memo(CategoryApiFilterForm)
