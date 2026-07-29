import { FilterChip } from '../../components/Listing/FilterChips'

/**
 * The section + chip-row primitives used by the listing page's Advanced Filter
 * panel. Shared so the search page renders category levels and filters with the
 * exact same look, instead of a second set of look-alike styles.
 */

export function PanelSection({ title, children }) {
  return (
    <div className="border-b border-[#E8EBF2] py-4 last:border-b-0">
      <p className="mb-3 text-sm font-semibold text-[#0F172A]">{title}</p>
      {children}
    </div>
  )
}

export function ChipRow({ options = [], value = '', onChange, allowAny = true, anyLabel = 'Any' }) {
  return (
    <div className="flex flex-wrap gap-2">
      {allowAny ? <FilterChip label={anyLabel} active={!value} onClick={() => onChange?.('')} /> : null}
      {options.map((opt) => {
        const v = typeof opt === 'string' ? opt : opt.value
        const label = typeof opt === 'string' ? opt : opt.label
        const active = String(value) === String(v)
        return (
          <FilterChip
            key={String(v)}
            label={label}
            active={active}
            onClick={() => onChange?.(active ? '' : v)}
          />
        )
      })}
    </div>
  )
}

export default PanelSection
