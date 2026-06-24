import { Fragment } from 'react'

const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/

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

function isObjectIdString(v) {
  const s = safeToString(v)
  return Boolean(s && OBJECT_ID_RE.test(s))
}

/** Prefer API *IdValue labels; skip raw ObjectId strings from legacy fields. */
function pickDisplay(...candidates) {
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined || candidate === '') continue

    if (Array.isArray(candidate)) {
      const labels = candidate
        .map((item) => safeToString(item))
        .filter((item) => item && !isObjectIdString(item))
      if (labels.length) return labels.join(', ')
      continue
    }

    const s = safeToString(candidate)
    if (s && !isObjectIdString(s)) return s
  }
  return null
}

function vehicleLabel(product, idField, ...legacyKeys) {
  const enriched = product?.[`${idField}Value`]
  const legacy = legacyKeys.map((key) => product?.[key])
  return pickDisplay(enriched, ...legacy)
}

function getFromMixed(obj, keys) {
  if (!obj) return null
  for (const key of keys) {
    const v = obj[key]
    if (v !== undefined && v !== null && v !== '') {
      const s = safeToString(v)
      if (s && !isObjectIdString(s)) return s
    }
  }
  return null
}

function formatEngineCapacity(product) {
  const fromVehicle = vehicleLabel(product, 'engineCapacityId')
  if (fromVehicle) {
    const s = fromVehicle.toLowerCase()
    if (s.includes('cc') || s.includes('hp')) return fromVehicle
    return `${fromVehicle} cc`
  }

  const fromFilter = getFromMixed(product?.filter_data, ['engine_cc', 'engineCc', 'engineCapacityCc'])
  if (fromFilter) {
    const n = Number(fromFilter)
    if (Number.isFinite(n)) return `${n.toLocaleString()} cc`
    return `${fromFilter} cc`
  }

  const fromTop = safeToString(product?.engineSize)
  if (!fromTop || isObjectIdString(fromTop)) return null
  const s = fromTop.toLowerCase()
  if (s.includes('cc')) return fromTop
  if (s.includes('l')) {
    const liters = Number(s.replace(/l/g, '').trim())
    if (Number.isFinite(liters)) return `${Math.round(liters * 1000).toLocaleString()} cc`
  }
  return fromTop
}

function formatHorsepower(product) {
  const fromVehicle = vehicleLabel(product, 'horsepowerId')
  if (fromVehicle) return fromVehicle.includes('HP') ? fromVehicle : `${fromVehicle} HP`

  const hp = getFromMixed(product?.filter_data, ['horsepower', 'hp'])
  if (hp) {
    const n = Number(hp)
    if (Number.isFinite(n)) return `${n.toLocaleString()} HP`
    return `${hp} HP`
  }

  const hp2 = getFromMixed(product?.specifications, ['horsepower', 'hp'])
  if (hp2) {
    const n = Number(hp2)
    if (Number.isFinite(n)) return `${n.toLocaleString()} HP`
    return `${hp2} HP`
  }
  return null
}

function formatKilometers(product) {
  const km = product?.kilometers ?? product?.mileage ?? product?.filter_data?.mileage_km
  if (km === null || km === undefined || km === '') return null
  const n = Number(km)
  if (Number.isFinite(n)) return `${n.toLocaleString()} km`
  const s = safeToString(km)
  return s && !isObjectIdString(s) ? `${s} km` : null
}

function formatSeating(product) {
  const label = vehicleLabel(product, 'seatId', 'seatingCapacity')
  if (label) {
    if (/seater/i.test(label)) return label
    const n = Number(label)
    if (Number.isFinite(n)) return `${n} Seater`
    return label
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
  const leftItems = [
    { label: 'Engine Capacity (cc)', value: formatEngineCapacity(product) },
    {
      label: 'Fuel Type',
      value: pickDisplay(
        product?.fuelTypeIdValue,
        product?.fuelType,
        product?.filter_data?.fuel_type
      ),
    },
    {
      label: 'Transmission',
      value: pickDisplay(
        product?.transmissionTypeIdValue,
        product?.transmission,
        product?.filter_data?.transmission
      ),
    },
    {
      label: 'Body Type',
      value: pickDisplay(
        product?.bodyTypeIdValue,
        product?.bodyType,
        product?.filter_data?.body_type
      ),
    },
    {
      label: 'Doors',
      value: pickDisplay(product?.doorsIdValue, product?.doors, product?.additionalFields?.doors),
    },
    { label: 'Horsepower', value: formatHorsepower(product) },
    { label: 'Kilometers', value: formatKilometers(product) },
  ]

  const rightItems = [
    {
      label: 'Trim',
      value: pickDisplay(
        product?.trimIdValue,
        product?.trim,
        product?.variant,
        product?.additionalFields?.trim
      ),
    },
    { label: 'Seating Capacity', value: formatSeating(product) },
    {
      label: 'Interior Color',
      value: pickDisplay(
        product?.interiorColorIdValue,
        product?.interiorColor,
        product?.color,
        product?.specifications?.interiorColor,
        product?.additionalFields?.interiorColor
      ),
    },
    {
      label: 'Warranty',
      value: pickDisplay(
        product?.warrantyIdValue,
        product?.warranty,
        product?.specifications?.warranty,
        product?.additionalFields?.warranty
      ),
    },
    {
      label: 'No. of Cylinders',
      value: pickDisplay(
        product?.numberOfCylenderIdValue,
        product?.additionalFields?.no_of_cylinders,
        product?.additionalFields?.cylinders,
        product?.additionalFields?.noOfCylinders,
        product?.specifications?.no_of_cylinders,
        product?.specifications?.cylinders
      ),
    },
    { label: 'Condition', value: safeToString(product?.condition) },
  ]

  const hasAny = [...leftItems, ...rightItems].some((item) => item.value)
  if (!hasAny) return null

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
