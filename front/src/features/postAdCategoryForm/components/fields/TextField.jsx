import { FieldShell } from './FieldShell'
import { fieldInputClass } from './fieldStyles'

export function TextField({ field, value, error, required, onChange }) {
  return (
    <FieldShell field={field} required={required} error={error} htmlFor={field.fieldName}>
      <input
        id={field.fieldName}
        name={field.fieldName}
        type="text"
        className={fieldInputClass(Boolean(error))}
        placeholder={field.placeholder || ''}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </FieldShell>
  )
}
