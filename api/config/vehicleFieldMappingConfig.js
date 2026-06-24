/**
 * Configurable vehicle field definitions for AI mapping.
 * Supports Cars, Motorcycles, and Bicycles with shared + type-specific fields.
 */

const CONDITION_OPTIONS = ['Brand New', 'Like New', 'Good', 'Fair', 'Poor']

const TRANSMISSION_OPTIONS = ['Manual', 'Automatic', 'CVT', 'Semi-Automatic']

const FUEL_TYPE_OPTIONS = ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG', 'LPG', 'Other']

const BODY_TYPE_OPTIONS = ['Sedan', 'SUV', 'Hatchback', 'Coupe', 'Convertible', 'Wagon', 'Pickup']

const DOORS_OPTIONS = ['2', '3', '4', '5', '5+', '5+ doors']

const SELLER_TYPE_OPTIONS = ['Private', 'Dealer']

const DRIVETRAIN_OPTIONS = ['FWD', 'RWD', 'AWD', '4WD']

const REGIONAL_SPEC_OPTIONS = ['GCC', 'American', 'Canadian', 'European', 'Japanese', 'Korean', 'Chinese', 'Other']

const STEERING_SIDE_OPTIONS = ['Left Hand Drive', 'Right Hand Drive']

const EXPORT_STATUS_OPTIONS = ['Can be exported', 'Not for export', 'Export only']

const ENGINE_CAPACITY_RANGES = [
  '0-999 cc',
  '1000-1499 cc',
  '1500-1999 cc',
  '2000-2499 cc',
  '2500-2999 cc',
  '3000-3999 cc',
  '4000+ cc',
]

const HORSEPOWER_RANGES = [
  '0-99 HP',
  '100-199 HP',
  '200-299 HP',
  '300-399 HP',
  '400-499 HP',
  '500+ HP',
]

const CYLINDER_OPTIONS = ['3', '4', '5', '6', '8', '10', '12', '16']

const WARRANTY_OPTIONS = ['Yes', 'No', 'Extended available']

/** @typedef {'string'|'number'|'enum'|'boolean'|'range'} FieldType */

/**
 * @param {object} def
 * @returns {object}
 */
function field(def) {
  return {
    inferrable: true,
    required: false,
    filterKey: null,
    ...def,
  }
}

const SHARED_FIELDS = [
  field({ key: 'title', aiKeys: ['title'], type: 'string', inferrable: false }),
  field({ key: 'description', aiKeys: ['description'], type: 'string', inferrable: false }),
  field({ key: 'price', aiKeys: ['price'], type: 'number', required: true }),
  field({ key: 'currency', aiKeys: ['currency'], type: 'string' }),
  field({
    key: 'condition',
    aiKeys: ['condition'],
    type: 'enum',
    options: CONDITION_OPTIONS,
    filterKey: 'condition',
  }),
  field({ key: 'make', aiKeys: ['brand', 'make'], type: 'string', required: true, filterKey: 'brand' }),
  field({ key: 'brand', aiKeys: ['brand', 'make'], type: 'string', filterKey: 'brand' }),
  field({ key: 'model', aiKeys: ['model'], type: 'string', required: true, filterKey: 'model' }),
  field({ key: 'year', aiKeys: ['year'], type: 'number', required: true, filterKey: 'year' }),
  field({ key: 'mileage', aiKeys: ['mileage', 'mileage_km', 'kilometers'], type: 'number', filterKey: 'mileage_km' }),
  field({ key: 'color', aiKeys: ['color', 'exterior_color', 'exteriorColor'], type: 'string' }),
  field({ key: 'city', aiKeys: ['city', 'location_city'], type: 'string', filterKey: 'location_city' }),
  field({ key: 'country', aiKeys: ['country'], type: 'string' }),
  field({ key: 'area', aiKeys: ['area'], type: 'string' }),
]

const CAR_FIELDS = [
  ...SHARED_FIELDS,
  field({
    key: 'regionalSpec',
    aiKeys: ['regional_spec', 'regionalSpec', 'target_market', 'targetMarket'],
    type: 'enum',
    options: REGIONAL_SPEC_OPTIONS,
  }),
  field({ key: 'targetMarket', aiKeys: ['target_market', 'targetMarket', 'regional_spec'], type: 'string' }),
  field({
    key: 'sellerType',
    aiKeys: ['seller_type', 'sellerType'],
    type: 'enum',
    options: SELLER_TYPE_OPTIONS,
  }),
  field({
    key: 'bodyType',
    aiKeys: ['body_type', 'bodyType'],
    type: 'enum',
    options: BODY_TYPE_OPTIONS,
    filterKey: 'body_type',
  }),
  field({ key: 'seatingCapacity', aiKeys: ['seats', 'seating_capacity', 'seatingCapacity'], type: 'number' }),
  field({
    key: 'transmission',
    aiKeys: ['transmission'],
    type: 'enum',
    options: TRANSMISSION_OPTIONS,
    filterKey: 'transmission',
  }),
  field({
    key: 'fuelType',
    aiKeys: ['fuel_type', 'fuelType'],
    type: 'enum',
    options: FUEL_TYPE_OPTIONS,
    filterKey: 'fuel_type',
  }),
  field({ key: 'badges', aiKeys: ['badges'], type: 'string' }),
  field({
    key: 'exportStatus',
    aiKeys: ['export_status', 'exportStatus'],
    type: 'enum',
    options: EXPORT_STATUS_OPTIONS,
  }),
  field({ key: 'interiorColor', aiKeys: ['interior_color', 'interiorColor'], type: 'string' }),
  field({
    key: 'horsepower',
    aiKeys: ['horsepower'],
    type: 'range',
    options: HORSEPOWER_RANGES,
    filterKey: 'horsepower',
  }),
  field({
    key: 'engineSize',
    aiKeys: ['engine_cc', 'engine_size', 'engineSize', 'engine_capacity', 'engineCapacity'],
    type: 'string',
    filterKey: 'engine_cc',
  }),
  field({
    key: 'doors',
    aiKeys: ['doors'],
    type: 'enum',
    options: DOORS_OPTIONS,
    filterKey: 'doors',
  }),
  field({ key: 'warranty', aiKeys: ['warranty'], type: 'enum', options: WARRANTY_OPTIONS }),
  field({ key: 'cylinders', aiKeys: ['cylinders', 'number_of_cylinders'], type: 'enum', options: CYLINDER_OPTIONS }),
  field({
    key: 'steeringSide',
    aiKeys: ['steering_side', 'steeringSide'],
    type: 'enum',
    options: STEERING_SIDE_OPTIONS,
  }),
  field({ key: 'driverAssistance', aiKeys: ['driver_assistance', 'driverAssistance'], type: 'string' }),
  field({ key: 'comfortFeatures', aiKeys: ['comfort_features', 'comfortFeatures', 'comfortConvenience'], type: 'string' }),
  field({ key: 'entertainmentFeatures', aiKeys: ['entertainment_features', 'entertainmentFeatures'], type: 'string' }),
  field({ key: 'exteriorFeatures', aiKeys: ['exterior_features', 'exteriorFeatures'], type: 'string' }),
  field({ key: 'otherFilters', aiKeys: ['other_filters', 'otherFilters'], type: 'string' }),
  field({ key: 'trim', aiKeys: ['trim', 'variant'], type: 'string' }),
  field({
    key: 'drivetrain',
    aiKeys: ['drivetrain', 'drive_train'],
    type: 'enum',
    options: DRIVETRAIN_OPTIONS,
  }),
  field({ key: 'vin', aiKeys: ['vin'], type: 'string', inferrable: false }),
  field({ key: 'accident_free', aiKeys: ['accident_free'], type: 'boolean', filterKey: 'accident_free' }),
]

const MOTORCYCLE_FIELDS = [
  ...SHARED_FIELDS.filter((f) => !['seatingCapacity'].includes(f.key)),
  field({ key: 'engineSize', aiKeys: ['engine_cc', 'engine_size', 'engineSize'], type: 'string', filterKey: 'engine_cc' }),
  field({ key: 'bikeType', aiKeys: ['bike_type', 'bikeType', 'body_type'], type: 'string' }),
  field({ key: 'topSpeed', aiKeys: ['top_speed', 'topSpeed'], type: 'string' }),
  field({
    key: 'transmission',
    aiKeys: ['transmission'],
    type: 'enum',
    options: TRANSMISSION_OPTIONS,
    filterKey: 'transmission',
  }),
  field({
    key: 'fuelType',
    aiKeys: ['fuel_type', 'fuelType'],
    type: 'enum',
    options: FUEL_TYPE_OPTIONS,
    filterKey: 'fuel_type',
  }),
  field({
    key: 'regionalSpec',
    aiKeys: ['regional_spec', 'regionalSpec', 'target_market'],
    type: 'enum',
    options: REGIONAL_SPEC_OPTIONS,
  }),
]

const BICYCLE_FIELDS = [
  ...SHARED_FIELDS.filter((f) => !['transmission', 'fuelType', 'mileage'].includes(f.key)),
  field({ key: 'bikeType', aiKeys: ['bike_type', 'bikeType'], type: 'string' }),
  field({ key: 'frameSize', aiKeys: ['frame_size', 'frameSize'], type: 'string' }),
  field({ key: 'gears', aiKeys: ['gears'], type: 'string' }),
  field({ key: 'brakeType', aiKeys: ['brake_type', 'brakeType'], type: 'string' }),
  field({ key: 'suspension', aiKeys: ['suspension'], type: 'string' }),
]

const VEHICLE_TYPE_CONFIG = {
  cars: {
    id: 'cars',
    label: 'Cars',
    match: /cars?|auto|sedan|suv|vehicle/i,
    fields: CAR_FIELDS,
    legacyRequiredFields: [
      'brand',
      'model',
      'year',
      'price',
      'currency',
      'location_city',
      'mileage_km',
      'engine_cc',
      'horsepower',
      'transmission',
      'fuel_type',
      'body_type',
      'condition',
      'accident_free',
    ],
  },
  motorcycles: {
    id: 'motorcycles',
    label: 'Motorcycles',
    match: /motorcycle|motorbike|scooter|moped/i,
    fields: MOTORCYCLE_FIELDS,
    legacyRequiredFields: ['brand', 'model', 'year', 'price', 'currency', 'location_city', 'mileage_km', 'condition'],
  },
  bicycles: {
    id: 'bicycles',
    label: 'Bicycles',
    match: /bicycle|bike|cycling/i,
    fields: BICYCLE_FIELDS,
    legacyRequiredFields: ['brand', 'model', 'year', 'price', 'currency', 'condition'],
  },
}

/**
 * Resolve vehicle type from subcategory / category name.
 * @param {string} [subcategoryName]
 * @param {string} [categoryName]
 * @returns {'cars'|'motorcycles'|'bicycles'}
 */
function resolveVehicleType(subcategoryName, categoryName) {
  const sub = String(subcategoryName || '').trim().toLowerCase()
  const cat = String(categoryName || '').trim().toLowerCase()

  if (/^bicycles?$|^cycling$/i.test(sub) || (/\bbicycle/i.test(sub) && !/motor/i.test(sub))) {
    return 'bicycles'
  }
  if (/^motorcycles?$|^motorbikes?$|^scooters?$|^moped/i.test(sub) || /motorcycle|motorbike|scooter|moped/i.test(sub)) {
    return 'motorcycles'
  }
  if (/^bicycles?$|^cycling$/i.test(cat) && !/motor/i.test(sub)) {
    return 'bicycles'
  }
  return 'cars'
}

/**
 * @param {'cars'|'motorcycles'|'bicycles'} vehicleType
 */
function getVehicleConfig(vehicleType) {
  return VEHICLE_TYPE_CONFIG[vehicleType] || VEHICLE_TYPE_CONFIG.cars
}

/**
 * Build a flat map of aiKey -> form field key for a vehicle type.
 * @param {'cars'|'motorcycles'|'bicycles'} vehicleType
 */
function buildAiKeyToFormKeyMap(vehicleType) {
  const config = getVehicleConfig(vehicleType)
  const map = {}
  for (const f of config.fields) {
    for (const aiKey of f.aiKeys || [f.key]) {
      map[aiKey] = f.key
    }
    if (f.filterKey) map[f.filterKey] = f.key
  }
  return map
}

module.exports = {
  CONDITION_OPTIONS,
  TRANSMISSION_OPTIONS,
  FUEL_TYPE_OPTIONS,
  BODY_TYPE_OPTIONS,
  DOORS_OPTIONS,
  SELLER_TYPE_OPTIONS,
  DRIVETRAIN_OPTIONS,
  REGIONAL_SPEC_OPTIONS,
  STEERING_SIDE_OPTIONS,
  EXPORT_STATUS_OPTIONS,
  ENGINE_CAPACITY_RANGES,
  HORSEPOWER_RANGES,
  CYLINDER_OPTIONS,
  WARRANTY_OPTIONS,
  VEHICLE_TYPE_CONFIG,
  resolveVehicleType,
  getVehicleConfig,
  buildAiKeyToFormKeyMap,
}
