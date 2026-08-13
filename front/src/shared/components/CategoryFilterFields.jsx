import { memo, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import {
  FILTER_FIELD_KIND,
  FREE_FORM_FIELD_KINDS,
} from '@shared/utils/categoryFilterFields'
import { PanelSection } from '@shared/components/FilterPanelSection'

/** Option-list filters (radio/checkbox/chips) collapse to this many values until expanded. */
const VISIBLE_OPTION_LIMIT = 5

/**
 * Renders admin-configured category filters according to each filter's field
 * type. Shared by the hierarchical search page and the listing filter sidebar
 * so both show the same fields with the same selections.
 *
 * Value model:
 *   - option-backed fields (chips / checkbox / radio / dropdown) select filter
 *     ids, collected in `selectedFilterIds`
 *   - free-form fields (text / number / date) store a raw value per filter id
 *     in `filterValues`
 */

const INPUT_CLASS =
  'w-full rounded-xl border border-[#E4E7EF] bg-white px-3.5 py-2.5 text-sm text-[#475569] outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15'

function OptionChip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-2 text-sm font-medium transition ${
        active
          ? 'bg-brand text-white shadow-sm shadow-brand/25'
          : 'bg-white text-[#64748B] ring-1 ring-[#E4E7EF] hover:text-brand hover:ring-brand/30'
      }`}
    >
      {label}
    </button>
  )
}

/** Independent expand/collapse state per field, so toggling one filter never affects another. */
function useShowMoreOptions(options, enabled) {
  const [expanded, setExpanded] = useState(false)
  const hasMore = enabled && options.length > VISIBLE_OPTION_LIMIT
  const visibleOptions = hasMore && !expanded ? options.slice(0, VISIBLE_OPTION_LIMIT) : options
  return { visibleOptions, hasMore, expanded, toggle: () => setExpanded((v) => !v) }
}

function ShowMoreToggle({ expanded, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="mt-2.5 inline-flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-700"
    >
      {expanded ? 'Show Less' : 'Show More'}
      {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
    </button>
  )
}

function FieldShell({ field, children }) {
  return (
    <PanelSection
      title={
        <>
          {field.name}
          {field.required ? <span className="ml-1 text-red-500">*</span> : null}
        </>
      }
    >
      {children}
    </PanelSection>
  )
}

/** Every filter id an option stands for — several when duplicate groups were merged. */
export function optionIdsOf(option) {
  const ids = Array.isArray(option?.filterIds) ? option.filterIds.map(String).filter(Boolean) : []
  if (ids.length) return ids
  return [String(option?.filterId || option?.value)]
}

function FilterField({
  field,
  selectedIds,
  values,
  onToggleIds,
  onSetIds,
  onValueChange,
  enableShowMore,
}) {
  // A merged option (the same filter configured under several subcategories) owns
  // more than one filter id; they are selected and cleared together so the query
  // matches listings from every subcategory. Options that were not merged still
  // carry exactly one id, so behaviour there is unchanged.
  const optionIdGroups = useMemo(() => field.options.map(optionIdsOf), [field.options])
  const optionIds = useMemo(() => optionIdGroups.flat(), [optionIdGroups])
  const primaryOf = (opt) => optionIdsOf(opt)[0]
  const isOptionSelected = (opt) => optionIdsOf(opt).some((id) => selectedIds.has(id))
  const selectedOptionId =
    field.options.map(primaryOf).find((_, i) => optionIdGroups[i].some((id) => selectedIds.has(id))) || ''

  if (FREE_FORM_FIELD_KINDS.has(field.kind)) {
    const inputType =
      field.kind === FILTER_FIELD_KIND.NUMBER
        ? 'number'
        : field.kind === FILTER_FIELD_KIND.DATE
          ? 'date'
          : 'text'
    return (
      <FieldShell field={field}>
        <input
          type={inputType}
          value={values[field.id] ?? ''}
          onChange={(e) => onValueChange(field.id, e.target.value)}
          placeholder={inputType === 'text' ? `Enter ${field.name}` : ''}
          className={INPUT_CLASS}
        />
      </FieldShell>
    )
  }

  if (field.kind === FILTER_FIELD_KIND.DROPDOWN) {
    return (
      <FieldShell field={field}>
        <select
          value={selectedOptionId}
          onChange={(e) => {
            const chosen = field.options.find((opt) => primaryOf(opt) === e.target.value)
            onSetIds(optionIds, chosen ? optionIdsOf(chosen) : [])
          }}
          className={INPUT_CLASS}
        >
          <option value="">{`Any ${field.name}`}</option>
          {field.options.map((opt) => (
            <option key={String(opt.value)} value={primaryOf(opt)}>
              {opt.label}
            </option>
          ))}
        </select>
      </FieldShell>
    )
  }

  if (field.kind === FILTER_FIELD_KIND.RADIO) {
    return (
      <FieldShellWithShowMore field={field} options={field.options} enableShowMore={enableShowMore}>
        {(visibleOptions) => (
          <div className="space-y-2">
            {visibleOptions.map((opt) => {
              const ids = optionIdsOf(opt)
              return (
                <label key={ids[0]} className="flex cursor-pointer items-center gap-2 text-sm text-[#475569]">
                  <input
                    type="radio"
                    name={`filter-${field.id}`}
                    checked={isOptionSelected(opt)}
                    onChange={() => onSetIds(optionIds, ids)}
                    className="h-4 w-4 accent-brand"
                  />
                  {opt.label}
                </label>
              )
            })}
          </div>
        )}
      </FieldShellWithShowMore>
    )
  }

  if (field.kind === FILTER_FIELD_KIND.CHECKBOX) {
    return (
      <FieldShellWithShowMore field={field} options={field.options} enableShowMore={enableShowMore}>
        {(visibleOptions) => (
          <div className="space-y-2">
            {visibleOptions.map((opt) => {
              const ids = optionIdsOf(opt)
              return (
                <label key={ids[0]} className="flex cursor-pointer items-center gap-2 text-sm text-[#475569]">
                  <input
                    type="checkbox"
                    checked={isOptionSelected(opt)}
                    onChange={() => onToggleIds(ids)}
                    className="h-4 w-4 rounded accent-brand"
                  />
                  {opt.label}
                </label>
              )
            })}
          </div>
        )}
      </FieldShellWithShowMore>
    )
  }

  // Default: multi-select chips (how the listing sidebar has always looked).
  return (
    <FieldShellWithShowMore field={field} options={field.options} enableShowMore={enableShowMore}>
      {(visibleOptions) => (
        <div className="flex flex-wrap gap-2">
          {visibleOptions.map((opt) => (
            <OptionChip
              key={`${field.id}-${opt.value}`}
              label={opt.label}
              active={isOptionSelected(opt)}
              onClick={() => onToggleIds(optionIdsOf(opt))}
            />
          ))}
        </div>
      )}
    </FieldShellWithShowMore>
  )
}

/** FieldShell plus a "Show More/Less" toggle when a field has more than VISIBLE_OPTION_LIMIT options. */
function FieldShellWithShowMore({ field, options, enableShowMore, children }) {
  const { visibleOptions, hasMore, expanded, toggle } = useShowMoreOptions(options, enableShowMore)
  return (
    <FieldShell field={field}>
      {children(visibleOptions)}
      {hasMore ? <ShowMoreToggle expanded={expanded} onToggle={toggle} /> : null}
    </FieldShell>
  )
}

function CategoryFilterFields({
  fields = [],
  selectedFilterIds = [],
  filterValues = {},
  onFilterIdsChange,
  onFilterValuesChange,
  /** Opt-in: collapse option lists past 5 with a Show More/Less toggle. Off by
   * default so existing consumers (the listing filter sidebar) keep their
   * exact current look. */
  enableShowMore = false,
}) {
  const selectedIds = useMemo(
    () => new Set((selectedFilterIds || []).map(String)),
    [selectedFilterIds],
  )

  /**
   * Toggles every id an option stands for as one unit. A merged option (same filter
   * configured under several subcategories) counts as selected when any of its ids
   * is, and turning it off clears all of them.
   */
  const toggleIds = (filterIds) => {
    const ids = (Array.isArray(filterIds) ? filterIds : [filterIds]).map(String).filter(Boolean)
    if (!ids.length || !onFilterIdsChange) return
    const next = new Set(selectedIds)
    const active = ids.some((id) => next.has(id))
    ids.forEach((id) => (active ? next.delete(id) : next.add(id)))
    onFilterIdsChange([...next])
  }

  /** Single-select fields replace their own options rather than adding to them. */
  const setIdsForField = (fieldOptionIds, nextIds) => {
    if (!onFilterIdsChange) return
    const owned = new Set(fieldOptionIds.map(String))
    const next = [...selectedIds].filter((id) => !owned.has(id))
    onFilterIdsChange([...next, ...nextIds.map(String)])
  }

  const setValue = (filterId, value) => {
    if (!onFilterValuesChange) return
    const next = { ...(filterValues || {}) }
    if (value === '' || value == null) delete next[filterId]
    else next[filterId] = value
    onFilterValuesChange(next)
  }

  if (!fields.length) return null

  return (
    <>
      {fields.map((field) => (
        <FilterField
          key={field.id}
          field={field}
          selectedIds={selectedIds}
          values={filterValues || {}}
          onToggleIds={toggleIds}
          onSetIds={setIdsForField}
          onValueChange={setValue}
          enableShowMore={enableShowMore}
        />
      ))}
    </>
  )
}

export default memo(CategoryFilterFields)
