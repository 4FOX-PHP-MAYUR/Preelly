/**
 * Shared helpers for option-based form field types.
 */
const SELECTION_TYPE_KEYWORDS = [
  'dropdown',
  'select',
  'radio',
  'checkbox',
  'multiselect',
  'choice',
]

function isSelectionFieldType(fieldValue) {
  const v = (fieldValue || '').toLowerCase().replace(/[\s_-]/g, '')
  return SELECTION_TYPE_KEYWORDS.some((keyword) => v.includes(keyword))
}

module.exports = {
  SELECTION_TYPE_KEYWORDS,
  isSelectionFieldType,
}
