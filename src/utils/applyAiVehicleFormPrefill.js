/**
 * Apply centralized AI vehicle mapping result to React Hook Form fields.
 */

import { getBrandOptionsForCategory, resolveCategoryKeyForFields, CONDITION_OPTIONS } from './categoryFields'
import { toFilterArray } from './filterValueUtils'

const TRANSMISSION_OPTIONS = ['Manual', 'Automatic', 'CVT', 'Semi-Automatic']
const FUEL_TYPE_OPTIONS = ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG', 'LPG', 'Other']
const BODY_TYPE_OPTIONS = ['Sedan', 'SUV', 'Hatchback', 'Coupe', 'Convertible', 'Wagon', 'Pickup']
const DOORS_OPTIONS = ['2', '3', '4', '5', '5+', '5+ doors']
const SELLER_TYPE_OPTIONS = ['Private', 'Dealer']
const DRIVETRAIN_OPTIONS = ['FWD', 'RWD', 'AWD', '4WD']

function normalizeToOption(raw, options) {
  if (raw === null || raw === undefined || raw === '') return null
  const r = String(raw).trim().toLowerCase()
  if (!r) return null
  const match = options.find((opt) => String(opt).trim().toLowerCase() === r)
  if (match) return match
  const normalized = r.replace(/[\s\-_]+/g, '_')
  const match2 = options.find(
    (opt) => String(opt).trim().toLowerCase().replace(/[\s\-_]+/g, '_') === normalized,
  )
  return match2 || null
}

function setIfEmpty(getValues, setValue, key, value, opts = {}) {
  if (value === undefined || value === null || value === '') return false
  const current = getValues(key)
  if (current !== undefined && current !== null && current !== '' && !opts.force) return false
  setValue(key, value, { shouldDirty: true, shouldTouch: true })
  return true
}

/**
 * @param {object} params
 * @param {Function} params.setValue
 * @param {Function} params.getValues
 * @param {object|null} params.mappingResult - from /listings/ai-extract
 * @param {object} [params.context]
 * @param {string} [params.context.categoryName]
 * @param {string} [params.context.subcategoryName]
 * @param {boolean} [params.context.isVehicle]
 * @param {Function} [params.onOverrides] - callback for aiListingUserOverrides updates
 */
export function applyAiVehicleFormPrefill({
  setValue,
  getValues,
  mappingResult,
  context = {},
  onOverrides,
} = {}) {
  if (!mappingResult || typeof mappingResult !== 'object') return { applied: [] }

  const formValues = mappingResult.form_values || {}
  const display = mappingResult.display_data || {}
  const merged = { ...display, ...formValues }

  const { categoryName = '', subcategoryName = '', isVehicle = false } = context
  const categoryFieldKey = resolveCategoryKeyForFields(categoryName)
  const applied = []

  const apply = (key, value, opts) => {
    if (setIfEmpty(getValues, setValue, key, value, opts)) applied.push(key)
  }

  if (merged.title) apply('title', String(merged.title).trim())
  if (merged.description) apply('description', String(merged.description).trim())

  if (merged.price !== undefined && merged.price !== null) apply('price', Number(merged.price))
  if (merged.currency) apply('currency', String(merged.currency).trim().toUpperCase())

  const conditionOpt = normalizeToOption(merged.condition, CONDITION_OPTIONS)
  if (conditionOpt) apply('condition', [conditionOpt])

  const brandVal = merged.brand || merged.make
  if (brandVal) {
    const brandStr = String(brandVal).trim()
    apply('brand', brandStr)
    if (isVehicle) apply('make', brandStr)

    const brandOptions = getBrandOptionsForCategory(categoryFieldKey, subcategoryName) || []
    if (brandOptions.length === 0) {
      apply('brandChoice', [brandStr])
    } else if (brandOptions.includes(brandStr)) {
      apply('brandChoice', [brandStr])
    } else {
      apply('brandChoice', ['Other'])
    }
  }

  if (merged.make) apply('make', String(merged.make).trim())
  if (merged.model) apply('model', String(merged.model).trim())
  if (merged.year !== undefined && merged.year !== null) apply('year', Number(merged.year))

  const mileage = merged.mileage ?? merged.mileage_km
  if (mileage !== undefined && mileage !== null) apply('mileage', Number(mileage))

  if (merged.city || merged.location_city) apply('city', String(merged.city || merged.location_city).trim())
  if (merged.country) apply('country', String(merged.country).trim())
  if (merged.area) apply('area', String(merged.area).trim())

  // Color only from transcript/vision — skip AI enrichment guesses for paint color.
  if (merged.color && (!merged.colorSource || merged.colorSource === 'video_vision' || merged.colorSource === 'transcript')) {
    apply('color', String(merged.color).trim())
  }
  if (merged.interiorColor) apply('interiorColor', String(merged.interiorColor).trim())

  const txOpt = normalizeToOption(merged.transmission, TRANSMISSION_OPTIONS)
  if (txOpt) apply('transmission', txOpt)

  const fuelOpt = normalizeToOption(merged.fuelType || merged.fuel_type, FUEL_TYPE_OPTIONS)
  if (fuelOpt) apply('fuelType', fuelOpt)

  const bodyOpt = normalizeToOption(merged.bodyType || merged.body_type, BODY_TYPE_OPTIONS)
  if (bodyOpt) apply('bodyType', bodyOpt)

  const doorsOpt = normalizeToOption(merged.doors, DOORS_OPTIONS)
  if (doorsOpt) apply('doors', doorsOpt)

  const sellerOpt = normalizeToOption(merged.sellerType || merged.seller_type, SELLER_TYPE_OPTIONS)
  if (sellerOpt) apply('sellerType', sellerOpt)

  const drivetrainOpt = normalizeToOption(merged.drivetrain, DRIVETRAIN_OPTIONS)
  if (drivetrainOpt) apply('drivetrain', drivetrainOpt)

  if (merged.seatingCapacity !== undefined && merged.seatingCapacity !== null) {
    apply('seatingCapacity', Number(merged.seatingCapacity))
  }

  if (merged.engineSize || merged.engine_cc) {
    const engineVal = merged.engineSize || merged.engine_cc
    if (typeof engineVal === 'number') {
      apply('engineSize', `${engineVal}cc`)
    } else {
      apply('engineSize', String(engineVal).trim())
    }
  }

  if (merged.horsepower !== undefined && merged.horsepower !== null) {
    apply('horsepower', String(merged.horsepower).trim())
  }

  if (merged.regionalSpec || merged.targetMarket) {
    apply('targetMarket', String(merged.regionalSpec || merged.targetMarket).trim())
  }

  if (merged.trim) apply('trim', String(merged.trim).trim())
  if (merged.variant) apply('trim', String(merged.variant).trim())

  if (merged.torque) apply('torque', String(merged.torque).trim())
  if (merged.topSpeed) apply('topSpeed', String(merged.topSpeed).trim())
  if (merged.regionalSpec) apply('targetMarket', String(merged.regionalSpec).trim())
  if (merged.generation) apply('specifications', String(merged.generation).trim())
  if (merged.warranty) apply('warranty', String(merged.warranty).trim())
  if (merged.cylinders) apply('cylinders', String(merged.cylinders).trim())
  if (merged.vin) apply('vin', String(merged.vin).trim())
  if (merged.bikeType) apply('bikeType', String(merged.bikeType).trim())
  if (merged.frameSize) apply('frameSize', String(merged.frameSize).trim())
  if (merged.gears) apply('gears', String(merged.gears).trim())
  if (merged.brakeType) apply('brakeType', String(merged.brakeType).trim())
  if (merged.suspension) apply('suspension', String(merged.suspension).trim())
  if (merged.topSpeed) apply('topSpeed', String(merged.topSpeed).trim())

  // Purchase year fallback from model year
  if (merged.year && !getValues('purchaseYear')) {
    apply('purchaseYear', Number(merged.year))
  }

  if (typeof onOverrides === 'function') {
    const overrides = {}
    const engineCc = merged.engine_cc ?? merged.engineSize
    if (engineCc !== undefined && engineCc !== null) {
      const n = Number(String(engineCc).replace(/[^\d.]/g, ''))
      overrides.engine_cc = Number.isFinite(n) ? n : engineCc
    }
    if (merged.horsepower !== undefined && merged.horsepower !== null) {
      const n = Number(String(merged.horsepower).replace(/[^\d.]/g, ''))
      overrides.horsepower = Number.isFinite(n) ? n : merged.horsepower
    }
    if (merged.accident_free !== undefined && merged.accident_free !== null) {
      overrides.accident_free = merged.accident_free
    }
    if (Object.keys(overrides).length) onOverrides(overrides)
  }

  console.log('[PostAd] AI vehicle form prefill applied:', applied)
  return { applied, formValues: merged }
}

/**
 * Sync brandChoice dropdown with make/brand text (e.g. Infiniti → Other + text field).
 */
export function syncBrandChoiceFromMake({
  getValues,
  setValue,
  categoryName = '',
  subcategoryName = '',
} = {}) {
  if (!getValues || !setValue) return

  const make = getValues('make') || getValues('brand')
  if (!make || !String(make).trim()) return

  const brandStr = String(make).trim()
  const categoryFieldKey = resolveCategoryKeyForFields(categoryName)
  const brandOptions = getBrandOptionsForCategory(categoryFieldKey, subcategoryName) || []
  const current = getValues('brandChoice')

  if (brandOptions.length === 0) {
    if (JSON.stringify(toFilterArray(current)) !== JSON.stringify([brandStr])) {
      setValue('brandChoice', [brandStr], { shouldDirty: false })
    }
    return
  }

  if (brandOptions.includes(brandStr)) {
    if (JSON.stringify(toFilterArray(current)) !== JSON.stringify([brandStr])) {
      setValue('brandChoice', [brandStr], { shouldDirty: true, shouldTouch: true })
      setValue('brand', brandStr, { shouldDirty: true, shouldTouch: true })
    }
    return
  }

  const nextChoice = ['Other']
  if (JSON.stringify(toFilterArray(current)) !== JSON.stringify(nextChoice)) {
    setValue('brandChoice', nextChoice, { shouldDirty: true, shouldTouch: true })
  }
  if (getValues('brand') !== brandStr) {
    setValue('brand', brandStr, { shouldDirty: true, shouldTouch: true })
  }
}

export { normalizeToOption }
