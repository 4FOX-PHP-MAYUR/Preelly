export function SelectField({ field, value, onChange, options, error }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {field.label} {field.required ? <span className="text-red-500">*</span> : null}
      </label>
      <select
        className="input-field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{field.placeholder || `Select ${field.label}`}</option>
        {(options || []).map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
    </div>
  )
}

