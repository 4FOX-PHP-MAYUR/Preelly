import { FieldShell } from './FieldShell'
import { fieldInputClass } from './fieldStyles'

export function DateField({ field, value, error, required, onChange }) {
  return (
    <FieldShell field={field} required={required} error={error} htmlFor={field.fieldName}>
      <input
        id={field.fieldName}
        name={field.fieldName}
        type="date"
        className={fieldInputClass(Boolean(error))}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </FieldShell>
  )
}
