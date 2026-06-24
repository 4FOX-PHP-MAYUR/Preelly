/**
 * Lightweight vehicle specification lookup for AI inference.
 * Keys: normalized "brand|model|year" (year optional).
 * Values are best-effort defaults — only used when transcript lacks explicit specs.
 */

const SPECS = {
  'infiniti|qx50|2019': {
    variant: 'QX50 Luxe',
    generation: 'Second generation (P71)',
    bodyType: 'SUV',
    vehicleType: 'SUV',
    transmission: 'Automatic',
    fuelType: 'Petrol',
    seatingCapacity: 5,
    doors: '5',
    engineSize: '1997cc',
    horsepower: '268 HP',
    cylinders: '4',
    drivetrain: 'AWD',
    steeringSide: 'Left Hand Drive',
    features: [
      '360 Camera',
      'Blind Spot Monitor',
      'Cruise Control',
      'Lane Departure Warning',
      'Parking Sensors',
      'Apple CarPlay',
      'Android Auto',
      'Panoramic Roof',
      'Leather Seats',
    ],
  },
  'infiniti|qx50': {
    bodyType: 'SUV',
    transmission: 'Automatic',
    fuelType: 'Petrol',
    seatingCapacity: 5,
    doors: '5',
    engineSize: '2000cc',
    cylinders: '4',
  },
  'toyota|camry': {
    bodyType: 'Sedan',
    transmission: 'Automatic',
    fuelType: 'Petrol',
    seatingCapacity: 5,
    doors: '4',
    cylinders: '4',
  },
  'toyota|land cruiser': {
    bodyType: 'SUV',
    transmission: 'Automatic',
    fuelType: 'Petrol',
    seatingCapacity: 7,
    doors: '5',
    cylinders: '6',
    drivetrain: '4WD',
  },
  'toyota|fortuner|2022': {
    variant: 'VX 4x4',
    bodyType: 'SUV',
    vehicleType: 'SUV',
    transmission: 'Automatic',
    fuelType: 'Diesel',
    seatingCapacity: 7,
    doors: '5',
    engineSize: '2755cc',
    horsepower: '201 HP',
    cylinders: '4',
    drivetrain: '4WD',
    features: ['4WD', 'Cruise Control', 'Parking Sensors', 'Apple CarPlay'],
  },
  'toyota|fortuner': {
    bodyType: 'SUV',
    transmission: 'Automatic',
    fuelType: 'Diesel',
    seatingCapacity: 7,
    doors: '5',
    cylinders: '4',
    drivetrain: '4WD',
  },
  'nissan|patrol': {
    bodyType: 'SUV',
    transmission: 'Automatic',
    fuelType: 'Petrol',
    seatingCapacity: 7,
    doors: '5',
    cylinders: '6',
    drivetrain: '4WD',
  },
  'bmw|x5': {
    bodyType: 'SUV',
    transmission: 'Automatic',
    fuelType: 'Petrol',
    seatingCapacity: 5,
    doors: '5',
    cylinders: '6',
    drivetrain: 'AWD',
  },
  'mercedes|e class': {
    bodyType: 'Sedan',
    transmission: 'Automatic',
    fuelType: 'Petrol',
    seatingCapacity: 5,
    doors: '4',
    cylinders: '4',
    drivetrain: 'RWD',
  },
  'honda|civic': {
    bodyType: 'Sedan',
    transmission: 'Automatic',
    fuelType: 'Petrol',
    seatingCapacity: 5,
    doors: '4',
    cylinders: '4',
  },
  'tesla|model 3': {
    bodyType: 'Sedan',
    transmission: 'Automatic',
    fuelType: 'Electric',
    seatingCapacity: 5,
    doors: '4',
    drivetrain: 'AWD',
  },
  'harley|sportster': {
    bodyType: 'Cruiser',
    transmission: 'Manual',
    fuelType: 'Petrol',
    bikeType: 'Cruiser',
  },
}

function normalizeKeyPart(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-_]+/g, ' ')
}

/**
 * @param {{ brand?: string, make?: string, model?: string, year?: number|string }} params
 * @returns {Record<string, unknown>|null}
 */
function lookupVehicleSpecs({ brand, make, model, year } = {}) {
  const b = normalizeKeyPart(brand || make)
  const m = normalizeKeyPart(model)
  if (!b || !m) return null

  const y = year ? String(year).trim() : null
  const keys = y ? [`${b}|${m}|${y}`, `${b}|${m}`] : [`${b}|${m}`]

  for (const key of keys) {
    if (SPECS[key]) return { ...SPECS[key], _source: 'vehicle_spec_database', _lookupKey: key }
  }

  // Partial model match (e.g. "qx50 luxury" -> "qx50")
  for (const [specKey, spec] of Object.entries(SPECS)) {
    const [specBrand, specModel] = specKey.split('|')
    if (specBrand === b && (m.startsWith(specModel) || specModel.startsWith(m.split(' ')[0]))) {
      return { ...spec, _source: 'vehicle_spec_database', _lookupKey: specKey }
    }
  }

  return null
}

module.exports = { lookupVehicleSpecs, SPECS }
