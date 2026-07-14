import { ChevronDown } from 'lucide-react'
import { FieldShell } from './FieldShell'
import { fieldInputClass } from './fieldStyles'

export function DropdownField({ field, value, error, required, onChange }) {
  const options = Array.isArray(field.options) ? field.options : []
  const loading = Boolean(field.isLoadingOptions)
  return (
    <FieldShell field={field} required={required} error={error} htmlFor={field.fieldName}>
      {/* Chrome paints the native select arrow flush against the border and ignores
          padding-right, so it's hidden and redrawn here to sit inset from the edge. */}
      <div className="relative">
        <select
          id={field.fieldName}
          name={field.fieldName}
          className={`${fieldInputClass(Boolean(error))} appearance-none pr-11`}
          value={value ?? ''}
          disabled={loading}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">
            {loading ? 'Loading...' : field.placeholder || `Select ${field.fieldTitle}`}
          </option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-900" />
      </div>
    </FieldShell>
  )
}
