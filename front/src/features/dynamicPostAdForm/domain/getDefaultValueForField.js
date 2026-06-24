export function getDefaultValueForField(field) {
  if (field && Object.prototype.hasOwnProperty.call(field, 'defaultValue')) {
    return field.defaultValue
  }

  switch (field?.type) {
    case 'checkbox':
      return false
    case 'file':
      return field?.multiple ? [] : null
    case 'number':
      return ''
    case 'radio':
    case 'select':
    case 'text':
    default:
      return ''
  }
}

