export function CheckboxField({ field, value, onChange, error }) {
  return (
    <div className="flex items-start gap-3">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4"
        checked={value === true}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="flex-1">
        <label className="block text-sm font-medium text-gray-700">
          {field.label} {field.required ? <span className="text-red-500">*</span> : null}
        </label>
        {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
      </div>
    </div>
  )
}

