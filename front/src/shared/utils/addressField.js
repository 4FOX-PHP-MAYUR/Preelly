// Which admin-configured text fields should offer address autocomplete.
//
// Field naming varies per category ("location", "locateyouritem", "address"), so match
// on fieldName first and fall back to a keyword in the admin-entered title.

const ADDRESS_FIELD_NAMES = new Set(['location', 'locateyouritem', 'address', 'fulladdress'])
const ADDRESS_TITLE_KEYWORDS = ['location', 'locate', 'address']

export function isAddressField(field) {
  const name = String(field?.fieldName || '').trim().toLowerCase().replace(/[\s_-]/g, '')
  if (ADDRESS_FIELD_NAMES.has(name)) return true
  const title = String(field?.fieldTitle || '').toLowerCase()
  return ADDRESS_TITLE_KEYWORDS.some((keyword) => title.includes(keyword))
}
