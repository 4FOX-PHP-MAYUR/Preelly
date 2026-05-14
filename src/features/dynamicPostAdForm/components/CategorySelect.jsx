export function CategorySelect({ categories, value, onChange, isSwitching }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Category <span className="text-red-500">*</span>
      </label>

      <select
        className="input-field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isSwitching}
      >
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>

      {isSwitching ? (
        <p className="mt-2 text-xs text-gray-500">Loading fields...</p>
      ) : null}
    </div>
  )
}

