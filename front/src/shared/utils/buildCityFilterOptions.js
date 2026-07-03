function normalizeCityKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function facetCountForEmirate(emirateName, facetCities = []) {
  const target = normalizeCityKey(emirateName)
  if (!target) return 0

  let total = 0
  for (const facet of facetCities) {
    const label = normalizeCityKey(facet?.label || facet?.value)
    if (!label) continue
    if (label === target || label.includes(target) || target.includes(label)) {
      total += Number(facet?.count) > 0 ? Number(facet.count) : 1
    }
  }
  return total
}

/**
 * Build city filter options from emirates (cities table) with optional facet counts.
 * @param {Array<{id?:string,_id?:string,name:string}>} emirates
 * @param {Array<{value?:string,label?:string,count?:number}>} facetCities
 * @returns {Array<{value:string,label:string,count:number}>}
 */
export function buildCityFilterOptions(emirates = [], facetCities = []) {
  const tableOptions = (emirates || [])
    .map((row) => {
      const value = String(row?.id || row?._id || '').trim()
      const label = String(row?.name || '').trim()
      if (!value || !label) return null
      return {
        value,
        label,
        count: facetCountForEmirate(label, facetCities),
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.label.localeCompare(b.label))

  if (tableOptions.length) {
    const withListings = tableOptions.filter((opt) => opt.count > 0)
    return withListings.length ? withListings : tableOptions
  }

  return (facetCities || [])
    .map((facet) => {
      const label = String(facet?.label || facet?.value || '').trim()
      if (!label) return null
      return {
        value: String(facet?.value || label),
        label,
        count: Number(facet?.count) > 0 ? Number(facet.count) : 0,
      }
    })
    .filter(Boolean)
}

export function resolveCityNameById(cityId, emirates = []) {
  const id = String(cityId || '').trim()
  if (!id) return ''
  const match = (emirates || []).find((row) => String(row?.id || row?._id) === id)
  return match?.name ? String(match.name).trim() : ''
}
