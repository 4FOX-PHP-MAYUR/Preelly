import { memo, useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import useCategoryFilterFields from '@shared/hooks/useCategoryFilterFields'
import CategoryFilterFields, { optionIdsOf } from '@shared/components/CategoryFilterFields'
import FilterPanelShell from './FilterPanelShell'

/** The admin-configured filter that holds GCC / American / European / … */
const REGION_NAME_PATTERN = /region/i

/**
 * Dedicated Region panel — the same "Regional Specs" chip group the Advanced panel
 * shows, on its own so it can be reached straight from the toolbar's quick filter.
 * It reuses CategoryFilterFields, so the chips look and toggle exactly as they do
 * inside Advanced, and selections land in the same `selectedFilterIds`.
 */
function RegionFilterPanel({
  className = '',
  showClose = false,
  onClose,
  closing = false,
  categoryPath,
  selectedFilterIds = [],
  filterValues = {},
  onFilterIdsChange,
  onFilterValuesChange,
  onApply,
}) {
  const { fields, loading, error } = useCategoryFilterFields(categoryPath)

  const regionFields = useMemo(
    () => fields.filter((f) => REGION_NAME_PATTERN.test(String(f.name || ''))),
    [fields],
  )

  // Reset clears only this panel's own options, never the other filters'. Uses the
  // same id list CategoryFilterFields toggles on, which is every id a merged option
  // stands for — one chip can own the ids of several subcategories' copies.
  const regionOptionIds = useMemo(
    () => new Set(regionFields.flatMap((f) => (f.options || []).flatMap(optionIdsOf))),
    [regionFields],
  )

  const hasSelection = (selectedFilterIds || []).some((id) => regionOptionIds.has(String(id)))

  const handleReset = () => {
    if (!hasSelection) return
    onFilterIdsChange?.((selectedFilterIds || []).filter((id) => !regionOptionIds.has(String(id))))
  }

  return (
    <FilterPanelShell
      title="Region"
      className={className}
      showClose={showClose}
      onClose={onClose}
      closing={closing}
      onReset={hasSelection ? handleReset : undefined}
      onApply={onApply}
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[#64748B]">
          <Loader2 className="h-4 w-4 animate-spin text-brand" />
          Loading regions…
        </div>
      ) : error ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </p>
      ) : regionFields.length ? (
        <CategoryFilterFields
          fields={regionFields}
          selectedFilterIds={selectedFilterIds}
          filterValues={filterValues}
          onFilterIdsChange={onFilterIdsChange}
          onFilterValuesChange={onFilterValuesChange}
        />
      ) : (
        <p className="text-sm text-[#64748B]">No region filter is configured for this category.</p>
      )}
    </FilterPanelShell>
  )
}

export default memo(RegionFilterPanel)
