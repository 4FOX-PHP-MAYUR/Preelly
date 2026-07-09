// Shared label/error chrome for every dynamic field — mirrors the field layout
// already used throughout PostAdPage's other steps (label, red asterisk, error text).
export function FieldShell({ field, required, error, htmlFor, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-800 mb-2">
        {field.fieldTitle}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}
