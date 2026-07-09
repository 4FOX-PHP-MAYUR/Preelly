import { FieldShell } from './FieldShell'

export function FileUploadField({ field, value, error, required, onChange }) {
  return (
    <FieldShell field={field} required={required} error={error} htmlFor={field.fieldName}>
      <input
        id={field.fieldName}
        name={field.fieldName}
        type="file"
        className="input-field"
        onChange={(e) => onChange(e.target.files?.[0] || null)}
      />
      {value instanceof File && <p className="mt-1 text-xs text-gray-500">Selected: {value.name}</p>}
    </FieldShell>
  )
}
