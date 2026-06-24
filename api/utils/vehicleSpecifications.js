/**
 * Normalized vehicleSpecifications document for MongoDB filtering and display.
 */

function parseNumber(v) {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = Number(String(v).replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : null
}

function formatCapacity(v) {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number' && Number.isFinite(v)) return `${Math.round(v)} CC`
  const s = String(v).trim()
  if (!s) return null
  if (/cc/i.test(s)) return s
  const n = parseNumber(s)
  if (n !== null) return `${Math.round(n)} CC`
  return s
}

function formatHorsepower(v) {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number' && Number.isFinite(v)) return `${Math.round(v)} HP`
  const s = String(v).trim()
  if (!s) return null
  if (/hp/i.test(s)) return s
  const n = parseNumber(s)
  if (n !== null) return `${Math.round(n)} HP`
  return s
}

function formatTorque(v) {
  if (v === null || v === undefined || v === '') return null
  const s = String(v).trim()
  if (!s) return null
  if (/nm/i.test(s)) return s
  const n = parseNumber(s)
  if (n !== null) return `${Math.round(n)} Nm`
  return s
}

function pickDimension(profile, key) {
  const dims = profile?.dimensions
  if (dims && typeof dims === 'object' && dims[key]) return String(dims[key]).trim() || null
  const flat = profile?.[key]
  if (flat) return String(flat).trim()
  return null
}

/**
 * @param {object} profile - normalized enrichment profile
 * @param {object} [extractedData] - transcript extraction
 * @param {object} [meta] - { source, confidence, region }
 */
function buildVehicleSpecifications(profile = {}, extractedData = {}, meta = {}) {
  if (!profile || typeof profile !== 'object') return null

  const brand = profile.brand || extractedData?.brand || extractedData?.make || null
  const model = profile.model || extractedData?.model || null
  if (!brand || !model) return null

  const year = parseNumber(profile.year ?? extractedData?.year)
  const seating = parseNumber(profile.seats ?? profile.seatingCapacity)
  const doors = parseNumber(profile.doors)
  const cylinders = parseNumber(profile.cylinders)

  const safetyFeatures = Array.isArray(profile.safetyFeatures)
    ? profile.safetyFeatures.map((s) => String(s).trim()).filter(Boolean)
    : []

  const features = Array.isArray(profile.features)
    ? profile.features.map((s) => String(s).trim()).filter(Boolean)
    : []

  return {
    brand: String(brand).trim(),
    model: String(model).trim(),
    variant: profile.variant || extractedData?.variant || extractedData?.trim || null,
    year,
    region:
      profile.regionalSpec ||
      extractedData?.regional_spec ||
      extractedData?.targetMarket ||
      extractedData?.country ||
      meta.region ||
      null,
    engineCapacity: formatCapacity(profile.engineCapacity ?? profile.engine_cc),
    fuelType: profile.fuelType || null,
    transmission: profile.transmission || null,
    driveType: profile.drivetrain || profile.driveType || null,
    horsepower: formatHorsepower(profile.horsepower),
    torque: formatTorque(profile.torque),
    bodyType: profile.bodyType || profile.vehicleType || null,
    seatingCapacity: seating,
    doors: doors,
    cylinders: cylinders,
    topSpeed: profile.topSpeed ? String(profile.topSpeed).trim() : null,
    fuelTankCapacity: profile.fuelTankCapacity ? String(profile.fuelTankCapacity).trim() : null,
    kerbWeight: profile.kerbWeight ? String(profile.kerbWeight).trim() : null,
    airbags: profile.airbags != null ? String(profile.airbags).trim() : null,
    dimensions: {
      length: pickDimension(profile, 'length'),
      width: pickDimension(profile, 'width'),
      height: pickDimension(profile, 'height'),
      wheelbase: pickDimension(profile, 'wheelbase'),
      groundClearance: pickDimension(profile, 'groundClearance'),
    },
    safetyFeatures,
    features,
    generation: profile.generation || null,
    enrichmentSource: meta.source || null,
    enrichmentConfidence:
      meta.confidence !== undefined && meta.confidence !== null ? parseNumber(meta.confidence) : null,
  }
}

module.exports = {
  buildVehicleSpecifications,
  parseNumber,
  formatCapacity,
  formatHorsepower,
}
