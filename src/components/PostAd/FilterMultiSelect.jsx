import { toFilterArray } from '../../utils/filterValueUtils'

/**
 * Checkbox multiselect for category filter options (explicit option lists).
 */
export default function FilterMultiSelect({
  label,
  required = false,
  options = [],
  value,
  onChange,
  error,
  placeholder,
}) {
  const selected = toFilterArray(value)

  const toggle = (optValue) => {
    if (selected.includes(optValue)) {
      onChange(selected.filter((v) => v !== optValue))
    } else {
      onChange([...selected, optValue])
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      <div className="rounded-lg border border-gray-200 bg-white p-3 max-h-52 overflow-y-auto space-y-2">
        {!options.length ? (
          <p className="text-sm text-gray-500">{placeholder || 'No options available'}</p>
        ) : (
          options.map((opt) => {
            const optValue = typeof opt === 'object' ? opt.value : opt
            const optLabel = typeof opt === 'object' ? opt.label : opt
            const checked = selected.includes(optValue)
            return (
              <label
                key={String(optValue)}
                className={`flex items-center gap-2.5 cursor-pointer rounded-md px-2 py-1.5 transition-colors ${
                  checked ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(optValue)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-800">{optLabel}</span>
              </label>
            )
          })
        )}
      </div>
      {selected.length > 0 ? (
        <p className="mt-1.5 text-xs text-gray-500">
          {selected.length} selected: {selected.join(', ')}
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-gray-400">{placeholder || `Select ${String(label || '').toLowerCase()}`}</p>
      )}
      {error ? <p className="mt-1 text-sm text-red-600">{error.message || error}</p> : null}
    </div>
  )
}
