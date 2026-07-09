import { FieldShell } from './FieldShell'
import { fieldInputClass } from './fieldStyles'

export function DropdownField({ field, value, error, required, onChange }) {
  const options = Array.isArray(field.options) ? field.options : []
  const loading = Boolean(field.isLoadingOptions)
  return (
    <FieldShell field={field} required={required} error={error} htmlFor={field.fieldName}>
      <select
        id={field.fieldName}
        name={field.fieldName}
        className={fieldInputClass(Boolean(error))}
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
    </FieldShell>
  )
}
