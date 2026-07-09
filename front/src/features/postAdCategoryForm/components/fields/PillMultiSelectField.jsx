import { useState } from 'react'
import { CheckCircle2, Circle } from 'lucide-react'
import { FieldShell } from './FieldShell'
import { pillOptionClass, VIEW_ALL_PILL_CLASS } from './fieldStyles'

const COLLAPSED_COUNT = 6

// Checkbox fields always store an array of selected option values.
export function PillMultiSelectField({ field, value, error, required, onChange }) {
  const options = Array.isArray(field.options) ? field.options : []
  const selected = Array.isArray(value) ? value : []
  const [expanded, setExpanded] = useState(false)

  const toggle = (optValue) => {
    const next = selected.includes(optValue)
      ? selected.filter((v) => v !== optValue)
      : [...selected, optValue]
    onChange(next)
  }

  const canCollapse = options.length > COLLAPSED_COUNT
  const visibleOptions = expanded || !canCollapse ? options : options.slice(0, COLLAPSED_COUNT)

  return (
    <FieldShell field={field} required={required} error={error}>
      {field.isLoadingOptions ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : options.length ? (
        <div className="flex flex-wrap gap-2">
          {visibleOptions.map((opt) => {
            const isSelected = selected.includes(opt.value)
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                className={pillOptionClass(isSelected)}
              >
                {opt.label}
                {isSelected ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4 text-gray-300" />
                )}
              </button>
            )
          })}
          {canCollapse && (
            <button type="button" onClick={() => setExpanded((v) => !v)} className={VIEW_ALL_PILL_CLASS}>
              {expanded ? 'View Less' : 'View All'}
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-400">No options available.</p>
      )}
    </FieldShell>
  )
}
