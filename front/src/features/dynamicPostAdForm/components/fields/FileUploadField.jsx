function getFileNames(field, value) {
  if (!value) return []

  if (field.multiple) {
    if (!Array.isArray(value)) return []
    return value
      .map((f) => (f && typeof f === 'object' && 'name' in f ? f.name : ''))
      .filter(Boolean)
  }

  if (typeof value === 'object' && 'name' in value) return [value.name]
  if (typeof value === 'string') return [value]

  return []
}

export function FileUploadField({ field, value, onChange, error }) {
  const fileNames = getFileNames(field, value)

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {field.label} {field.required ? <span className="text-red-500">*</span> : null}
      </label>
      <input
        className="input-field"
        type="file"
        accept={field.accept || undefined}
        multiple={field.multiple || false}
        onChange={(e) => {
          const fileList = e.target.files ? Array.from(e.target.files) : []
          if (field.multiple) onChange(fileList)
          else onChange(fileList[0] || null)
        }}
      />
      {fileNames.length ? (
        <div className="mt-2 text-xs text-gray-500">
          Selected: {fileNames.join(', ')}
        </div>
      ) : null}
      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
    </div>
  )
}

