export function RadioField({ field, value, onChange, options, error }) {
  return (
    <div>
      <p className="block text-sm font-medium text-gray-700 mb-2">
        {field.label} {field.required ? <span className="text-red-500">*</span> : null}
      </p>
      <div className="space-y-2">
        {(options || []).map((opt) => (
          <label key={opt} className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name={field.name}
              checked={value === opt}
              onChange={() => onChange(opt)}
            />
            <span className="text-sm text-gray-700">{opt}</span>
          </label>
        ))}
      </div>
      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
    </div>
  )
}

