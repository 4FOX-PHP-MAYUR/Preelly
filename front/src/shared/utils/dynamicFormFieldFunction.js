// Parses FormField.functionForField — a comma/pipe-delimited list of the *other*
// fieldNames a functionName-driven field depends on (e.g. "make,model" for a Trim
// field whose functionName is "getTrimByID").
export function parseFunctionForFieldNames(functionForField) {
  return String(functionForField || '')
    .split(/[,|]/)
    .map((name) => name.trim())
    .filter(Boolean)
}

export function hasFieldFunction(field) {
  return Boolean(field?.functionName)
}
