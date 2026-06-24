export function InputField({ field, value, onChange, error }) {
  const inputType = field.type === 'number' ? 'number' : 'text'

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {field.label} {field.required ? <span className="text-red-500">*</span> : null}
      </label>
      <input
        className="input-field"
        type={inputType}
        value={value}
        onChange={(e) => {
          const v = e.target.value
          onChange(v === '' ? '' : v)
        }}
        placeholder={field.placeholder || ''}
        min={field.min}
        max={field.max}
        step={field.step}
      />
      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
    </div>
  )
}

