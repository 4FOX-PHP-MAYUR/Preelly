import { FieldShell } from './FieldShell'
import { pillOptionClass } from './fieldStyles'

export function PillSingleSelectField({ field, value, error, required, onChange }) {
  const options = Array.isArray(field.options) ? field.options : []
  const loading = Boolean(field.isLoadingOptions)

  return (
    <FieldShell field={field} required={required} error={error}>
      {loading && <p className="text-sm text-gray-400">Loading...</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const selected = String(value ?? '') === String(opt.value)
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={pillOptionClass(selected)}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </FieldShell>
  )
}
