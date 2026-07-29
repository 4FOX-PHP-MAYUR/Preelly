import { Loader2 } from 'lucide-react'
import CategoryFilterFields from '@shared/components/CategoryFilterFields'
import useCategoryFilterFields from '@shared/hooks/useCategoryFilterFields'

/**
 * Admin-configured filters for the selected category, rendered by field type.
 *
 * Both the filter sidebar and the hierarchical search page (/search) load the
 * same fields through useCategoryFilterFields, so a search built on /search is
 * reflected here exactly — same fields, same selections.
 */
function CategoryDynamicFilters({
  categoryId,
  subcategoryId = '',
  childCategoryId = '',
  /** Full hierarchy (root → leaf); falls back to the level props when absent. */
  categoryPath,
  selectedFilterIds = [],
  filterValues = {},
  onChange,
  onFilterValuesChange,
  variant = 'default',
}) {
  const isFlat = variant === 'flat'
  const path =
    Array.isArray(categoryPath) && categoryPath.length
      ? categoryPath
      : [categoryId, subcategoryId, childCategoryId].filter(Boolean)

  const { fields, loading, error } = useCategoryFilterFields(path)

  if (!categoryId && !path.length) return null

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

  if (!fields.length) {
    if (isFlat) return null
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        No filters configured for this category yet. Select a subcategory if available.
      </p>
    )
  }

  const filterFields = (
    <CategoryFilterFields
      fields={fields}
      selectedFilterIds={selectedFilterIds}
      filterValues={filterValues}
      onFilterIdsChange={onChange}
      onFilterValuesChange={onFilterValuesChange}
      enableShowMore
    />
  )

  if (isFlat) return filterFields

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Category filters</h3>
        <p className="mt-1 text-xs text-slate-500">
          Filters from admin, scoped to your category and subcategory selection.
        </p>
      </div>
      {filterFields}
    </div>
  )
}

export default CategoryDynamicFilters
