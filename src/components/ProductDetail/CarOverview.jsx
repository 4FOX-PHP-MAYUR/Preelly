import { Fragment } from 'react'

function safeToString(v) {
  if (v === null || v === undefined) return null
  if (typeof v === 'string') {
    const s = v.trim()
    return s ? s : null
  }
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v)
}

function getFromMixed(obj, keys) {
  if (!obj) return null
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key]
  }
  return null
}

function formatEngineCapacity(product) {
  const fromFilter = getFromMixed(product?.filter_data, ['engine_cc', 'engineCc', 'engineCapacityCc'])
  if (fromFilter !== null && fromFilter !== undefined) {
    const n = Number(fromFilter)
    if (Number.isFinite(n)) return `${n.toLocaleString()} cc`
    const s = safeToString(fromFilter)
    return s ? `${s} cc` : null
  }

  const fromTop = safeToString(product?.engineSize)
  if (!fromTop) return null
  // Handle "1.5L" -> "1500 cc" best-effort
  const s = fromTop.toLowerCase()
  if (s.includes('cc')) return fromTop
  if (s.includes('l')) {
    const liters = Number(s.replace(/l/g, '').trim())
    if (Number.isFinite(liters)) return `${Math.round(liters * 1000).toLocaleString()} cc`
  }
  return fromTop
}

function formatHorsepower(product) {
  const hp = getFromMixed(product?.filter_data, ['horsepower', 'hp'])
  if (hp !== null && hp !== undefined) {
    const n = Number(hp)
    if (Number.isFinite(n)) return `${n.toLocaleString()} HP`
    const s = safeToString(hp)
    return s ? `${s} HP` : null
  }

  const hp2 = getFromMixed(product?.specifications, ['horsepower', 'hp'])
  if (hp2 !== null && hp2 !== undefined) {
    const n = Number(hp2)
    if (Number.isFinite(n)) return `${n.toLocaleString()} HP`
    const s = safeToString(hp2)
    return s ? `${s} HP` : null
  }
  return null
}

function CarSpecGrid({ items }) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {items.map((it, idx) => (
        <Fragment key={`${it.label}-${idx}`}>
          {it.value ? (
            <div className="flex items-start justify-between gap-4">
              <div className="text-sm text-gray-600">{it.label}</div>
              <div className="text-sm font-semibold text-gray-900 text-right max-w-[60%] break-words">
                {it.value}
              </div>
            </div>
          ) : null}
        </Fragment>
      ))}
    </div>
  )
}

function CarOverview({ product }) {
  const fuelType = product?.fuelType || product?.filter_data?.fuel_type
  const transmission = product?.transmission || product?.filter_data?.transmission
  const bodyType = product?.bodyType || product?.filter_data?.body_type

  const doors = product?.doors || product?.additionalFields?.doors
  const mileageKm = product?.mileage || product?.filter_data?.mileage_km

  const trim = product?.trim || product?.variant || product?.additionalFields?.trim
  const seating = product?.seatingCapacity || product?.additionalFields?.seatingCapacity || product?.additionalFields?.seating_capacity
  const interiorColor = product?.color || product?.specifications?.interiorColor || product?.additionalFields?.interiorColor
  const warranty = product?.warranty || product?.specifications?.warranty || product?.additionalFields?.warranty

  const cylinders =
    product?.additionalFields?.no_of_cylinders ||
    product?.additionalFields?.cylinders ||
    product?.additionalFields?.noOfCylinders ||
    product?.specifications?.no_of_cylinders ||
    product?.specifications?.cylinders

  const leftItems = [
    { label: 'Engine Capacity (cc)', value: formatEngineCapacity(product) },
    { label: 'Fuel Type', value: safeToString(fuelType) },
    { label: 'Transmission', value: safeToString(transmission) },
    { label: 'Body Type', value: safeToString(bodyType) },
    { label: 'Doors', value: safeToString(doors) },
    { label: 'Horsepower', value: formatHorsepower(product) },
    { label: 'Kilometers', value: mileageKm ? `${Number(mileageKm).toLocaleString()} km` : null },
  ]

  const rightItems = [
    { label: 'Trim', value: safeToString(trim) },
    { label: 'Seating Capacity', value: seating ? `${Number(seating)} Seater` : null },
    { label: 'Interior Color', value: safeToString(interiorColor) },
    { label: 'Warranty', value: safeToString(warranty) },
    { label: 'No. of Cylinders', value: safeToString(cylinders) },
    { label: 'Condition', value: safeToString(product?.condition) },
  ]

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mt-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Car Overview</h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <CarSpecGrid items={leftItems} />
        <CarSpecGrid items={rightItems} />
      </div>
    </div>
  )
}

export default CarOverview

