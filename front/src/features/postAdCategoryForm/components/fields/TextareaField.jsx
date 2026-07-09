import { FieldShell } from './FieldShell'
import { fieldInputClass } from './fieldStyles'

export function TextareaField({ field, value, error, required, onChange }) {
  return (
    <FieldShell field={field} required={required} error={error} htmlFor={field.fieldName}>
      <textarea
        id={field.fieldName}
        name={field.fieldName}
        rows={4}
        className={fieldInputClass(Boolean(error))}
        placeholder={field.placeholder || ''}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </FieldShell>
  )
}
