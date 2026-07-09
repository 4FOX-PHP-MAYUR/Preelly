// Normalizes the free-text `fieldType` coming from the admin-managed FieldType
// collection (e.g. "Text", "Dropdown", "File Upload") into a small, fixed set of
// render "kinds" that the dynamic post-ad form knows how to draw.
//
// To support a new field type: add one entry to FIELD_KIND and one matcher below
// (order matters — first match wins), then add a matching component in
// features/postAdCategoryForm/components/fields and register it in FieldRenderer.

export const FIELD_KIND = {
  TEXT: 'text',
  TEXTAREA: 'textarea',
  NUMBER: 'number',
  DROPDOWN: 'dropdown',
  RADIO: 'radio',
  CHECKBOX: 'checkbox',
  DATE: 'date',
  FILE: 'file',
}

const FIELD_KIND_MATCHERS = [
  { kind: FIELD_KIND.TEXTAREA, test: (v) => v.includes('textarea') || v.includes('longtext') },
  { kind: FIELD_KIND.NUMBER, test: (v) => v.includes('number') || v.includes('numeric') },
  { kind: FIELD_KIND.DATE, test: (v) => v.includes('date') || v.includes('datetime') },
  { kind: FIELD_KIND.FILE, test: (v) => v.includes('file') || v.includes('upload') },
  { kind: FIELD_KIND.CHECKBOX, test: (v) => v.includes('checkbox') || v.includes('multiselect') },
  { kind: FIELD_KIND.RADIO, test: (v) => v.includes('radio') },
  { kind: FIELD_KIND.DROPDOWN, test: (v) => v.includes('dropdown') || v.includes('select') || v.includes('choice') },
  { kind: FIELD_KIND.TEXT, test: () => true },
]

export function normalizeFieldTypeValue(fieldType) {
  return String(fieldType || '').trim().toLowerCase().replace(/[\s_-]/g, '')
}

export function getFieldKind(fieldType) {
  const normalized = normalizeFieldTypeValue(fieldType)
  const match = FIELD_KIND_MATCHERS.find(({ test }) => test(normalized))
  return match ? match.kind : FIELD_KIND.TEXT
}

/** Kinds whose value is stored as an array (per spec: checkbox -> array). */
export function isMultiValueKind(kind) {
  return kind === FIELD_KIND.CHECKBOX
}
