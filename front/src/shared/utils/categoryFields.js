// Dynamic field configurations for different categories and subcategories
// This allows each category to have its own specific fields

/**
 * Level labels for cascading category dropdowns by root category name.
 * Index 0 = first dropdown (root), 1 = second, etc.
 * Different roots can have different depths and labels.
 */
export const CATEGORY_LEVEL_LABELS = {
  Electronics: ['Category', 'Sub Category', 'Brand', 'Model'],
  Vehicles: ['Category', 'Vehicle Type', 'Brand', 'Model', 'Variant'],
  Fashion: ['Category', 'Sub Category', 'Brand', 'Type'],
  Furniture: ['Category', 'Sub Category', 'Brand', 'Type'],
  'Home & Garden': ['Category', 'Sub Category', 'Brand', 'Type'],
}

const DEFAULT_LEVEL_LABELS = ['Category', 'Level 2', 'Level 3', 'Level 4', 'Level 5']

/**
 * Get dropdown labels for each hierarchy level based on the selected root category name.
 * @param {string} rootCategoryName - Name of the root category (e.g. "Electronics", "Vehicles")
 * @returns {string[]} Array of label strings for each level
 */
export function getLevelLabels(rootCategoryName) {
  if (!rootCategoryName || typeof rootCategoryName !== 'string') return [...DEFAULT_LEVEL_LABELS]
  const trimmed = rootCategoryName.trim().toLowerCase()
  const key = Object.keys(CATEGORY_LEVEL_LABELS).find((k) => k.toLowerCase() === trimmed)
  const labels = key ? CATEGORY_LEVEL_LABELS[key] : null
  return labels ? [...labels] : [...DEFAULT_LEVEL_LABELS]
}

export const CATEGORY_FIELD_CONFIGS = {
  // Electronics
  'Electronics': {
    commonFields: ['brand', 'model', 'warranty', 'specifications'],
    subcategoryFields: {
      'Mobile Phones': ['storageCapacity', 'ram', 'screenSize', 'batteryCapacity', 'networkType'],
      'Laptops': ['processor', 'ram', 'storageCapacity', 'screenSize', 'graphicsCard', 'operatingSystem'],
      'Tablets': ['storageCapacity', 'ram', 'screenSize', 'batteryCapacity', 'operatingSystem'],
      'Gaming Consoles': ['storageCapacity', 'controllerIncluded', 'gamesIncluded', 'onlineCapable'],
      'Cameras': ['megapixels', 'lensType', 'zoom', 'videoResolution', 'batteryType'],
      'Gaming Consoles': ['storage', 'controllerIncluded', 'gamesIncluded', 'onlineCapable'],
      'Headphones': ['connectivity', 'batteryLife', 'noiseCancellation', 'driverSize'],
    },
    brands: {
      'Mobile Phones': ['Apple', 'Samsung', 'Google', 'OnePlus', 'Xiaomi', 'Huawei', 'No Brand'],
      'Laptops': ['Apple', 'Dell', 'HP', 'Lenovo', 'ASUS', 'Acer', 'MSI', 'No Brand'],
      'Tablets': ['Apple', 'Samsung', 'Microsoft', 'Amazon', 'Lenovo', 'No Brand'],
      'Cameras': ['Canon', 'Nikon', 'Sony', 'Fujifilm', 'Panasonic', 'No Brand'],
      'Gaming Consoles': ['Sony', 'Microsoft', 'Nintendo', 'No Brand'],
      'Headphones': ['Sony', 'Bose', 'Apple', 'Sennheiser', 'JBL', 'No Brand'],
    },
  },

  // Vehicles – keys aligned with Product model and vehicle filter API (make, model, year, mileage, condition, transmission, fuelType)
  'Vehicles': {
    commonFields: ['make', 'model', 'year', 'mileage', 'transmission', 'fuelType', 'color'],
    subcategoryFields: {
      'Cars': [
        'trim',
        'engineSize',
        'horsepower',
        'targetMarket',
        'doors',
        'sellerType',
        'seatingCapacity',
        'interiorColor',
        'bodyType',
        'warranty',
        'cylinders',
        'drivetrain',
        'vin',
      ],
      'Motorcycles': ['engineSize', 'bikeType', 'topSpeed'],
      'Bicycles': ['bikeType', 'frameSize', 'gears', 'brakeType', 'suspension'],
    },
    brands: {
      'Cars': ['Toyota', 'Honda', 'Ford', 'BMW', 'Mercedes-Benz', 'Audi', 'Tesla', 'Other'],
      'Motorcycles': ['Honda', 'Yamaha', 'Harley-Davidson', 'Kawasaki', 'Suzuki', 'Other'],
      'Bicycles': ['Trek', 'Specialized', 'Giant', 'Cannondale', 'Schwinn', 'Other'],
    },
  },

  // Furniture
  'Furniture': {
    commonFields: ['brand', 'material', 'color', 'dimensions', 'assemblyStatus'],
    subcategoryFields: {
      'Sofas': ['seatingCapacity', 'cushionType', 'fabricType', 'reclining'],
      'Tables': ['tableType', 'shape', 'seatingCapacity'],
      'Chairs': ['chairType', 'armrests', 'swivel', 'adjustable'],
      'Beds': ['bedSize', 'bedType', 'mattressIncluded', 'hasStorage'],
      'Wardrobes': ['doors', 'shelves', 'hangingSpace', 'mirror'],
    },
    brands: {
      'Sofas': ['IKEA', 'Urban Ladder', 'Godrej', 'Nilkamal', 'Pepperfry', 'Home Centre', 'No Brand'],
      'Tables': ['IKEA', 'Urban Ladder', 'Godrej', 'Nilkamal', 'Pepperfry', 'No Brand'],
      'Chairs': ['IKEA', 'Herman Miller', 'Steelcase', 'Godrej', 'No Brand'],
      'Beds': ['IKEA', 'Urban Ladder', 'Godrej', 'Nilkamal', 'Wakefit', 'No Brand'],
      'Wardrobes': ['IKEA', 'Godrej', 'Nilkamal', 'Pepperfry', 'HomeTown', 'No Brand'],
    },
  },

  // Fashion
  'Fashion': {
    commonFields: ['brand', 'size', 'color', 'material', 'condition'],
    subcategoryFields: {
      "Men's Clothing": ['size', 'fit', 'style', 'season'],
      "Women's Clothing": ['size', 'fit', 'style', 'season'],
      'Shoes': ['size', 'shoeType', 'heelHeight', 'closureType'],
      'Accessories': ['accessoryType', 'material', 'style'],
      'Watches': ['watchType', 'movement', 'waterResistance', 'bandMaterial'],
    },
    brands: {
      "Men's Clothing": ['Nike', 'Adidas', 'Zara', 'H&M', 'Levi\'s', 'Tommy Hilfiger', 'No Brand'],
      "Women's Clothing": ['Zara', 'H&M', 'Forever 21', 'Mango', 'H&M', 'No Brand'],
      'Shoes': ['Nike', 'Adidas', 'Puma', 'Converse', 'Vans', 'No Brand'],
      'Accessories': ['Gucci', 'Louis Vuitton', 'Coach', 'Michael Kors', 'No Brand'],
      'Watches': ['Rolex', 'Omega', 'Apple', 'Casio', 'Fossil', 'No Brand'],
    },
  },

  // Home & Garden
  'Home & Garden': {
    commonFields: ['brand', 'condition', 'dimensions'],
    subcategoryFields: {
      'Appliances': ['applianceType', 'energyRating', 'capacity', 'warranty'],
      'Tools': ['toolType', 'powerType', 'condition'],
      'Plants': ['plantType', 'potSize', 'careLevel', 'age'],
      'Decor': ['decorType', 'material', 'style', 'dimensions'],
    },
    brands: {
      'Appliances': ['Samsung', 'LG', 'Whirlpool', 'Bosch', 'GE', 'No Brand'],
      'Tools': ['DeWalt', 'Bosch', 'Makita', 'Black+Decker', 'No Brand'],
      'Plants': ['No Brand'],
      'Decor': ['IKEA', 'HomeGoods', 'Target', 'No Brand'],
    },
  },

  // Sports
  'Sports': {
    commonFields: ['brand', 'condition', 'size'],
    subcategoryFields: {
      'Fitness Equipment': ['equipmentType', 'weightCapacity', 'dimensions', 'features'],
      'Outdoor Gear': ['gearType', 'material', 'capacity', 'weatherResistance'],
      'Sports Accessories': ['accessoryType', 'size', 'material'],
    },
    brands: {
      'Fitness Equipment': ['Bowflex', 'NordicTrack', 'ProForm', 'Weider', 'No Brand'],
      'Outdoor Gear': ['The North Face', 'Patagonia', 'Columbia', 'REI', 'No Brand'],
      'Sports Accessories': ['Nike', 'Adidas', 'Under Armour', 'No Brand'],
    },
  },

  // Books
  'Books': {
    commonFields: ['author', 'isbn', 'language', 'condition'],
    subcategoryFields: {
      'Fiction': ['genre', 'edition', 'pages'],
      'Non-Fiction': ['subject', 'edition', 'pages'],
      'Textbooks': ['subject', 'edition', 'year', 'course'],
    },
    brands: {
      'Fiction': ['No Brand'],
      'Non-Fiction': ['No Brand'],
      'Textbooks': ['No Brand'],
    },
  },

  // Toys & Games
  'Toys & Games': {
    commonFields: ['brand', 'ageRange', 'condition'],
    subcategoryFields: {
      'Board Games': ['playerCount', 'playTime', 'gameType', 'piecesIncluded'],
      'Video Games': ['platform', 'genre', 'edition', 'dlcIncluded'],
      'Toys': ['toyType', 'ageRange', 'batteryRequired'],
    },
    brands: {
      'Board Games': ['Hasbro', 'Mattel', 'Ravensburger', 'No Brand'],
      'Video Games': ['EA', 'Ubisoft', 'Activision', 'Nintendo', 'No Brand'],
      'Toys': ['LEGO', 'Hasbro', 'Mattel', 'Fisher-Price', 'No Brand'],
    },
  },
}

// Field type definitions
export const FIELD_TYPES = {
  text: 'text',
  number: 'number',
  select: 'select',
  textarea: 'textarea',
  checkbox: 'checkbox',
}

// Field configurations with types and options
export const FIELD_CONFIGS = {
  // Common fields
  brand: {
    type: FIELD_TYPES.select,
    label: 'Brand',
    placeholder: 'Select brand',
  },
  model: {
    type: FIELD_TYPES.text,
    label: 'Model',
    placeholder: 'Enter model name',
  },
  condition: {
    type: FIELD_TYPES.select,
    label: 'Condition',
    placeholder: 'Select condition',
    options: ['Brand New', 'Like New', 'Good', 'Fair', 'Poor'],
  },
  color: {
    type: FIELD_TYPES.text,
    label: 'Color',
    placeholder: 'e.g., Black, White, Red',
  },
  material: {
    type: FIELD_TYPES.select,
    label: 'Material',
    placeholder: 'Select material',
    options: ['Wood', 'Engineered Wood', 'Metal', 'Fabric', 'Leather', 'Plastic', 'Glass', 'Other'],
  },
  dimensions: {
    type: 'dimensions',
    label: 'Dimensions',
  },
  assemblyStatus: {
    type: FIELD_TYPES.select,
    label: 'Assembly Status',
    placeholder: 'Select status',
    options: ['Assembled', 'Needs Assembly'],
  },
  
  // Electronics fields
  warranty: {
    type: FIELD_TYPES.text,
    label: 'Warranty',
    placeholder: 'e.g., 1 year remaining',
  },
  specifications: {
    type: FIELD_TYPES.textarea,
    label: 'Specifications',
    placeholder: 'Enter detailed specifications',
    rows: 4,
  },
  storageCapacity: {
    type: FIELD_TYPES.select,
    label: 'Storage',
    placeholder: 'Select storage',
    options: ['32GB', '64GB', '128GB', '256GB', '512GB', '1TB', '2TB'],
  },
  ram: {
    type: FIELD_TYPES.select,
    label: 'RAM',
    placeholder: 'Select RAM',
    options: ['2GB', '4GB', '8GB', '16GB', '32GB', '64GB'],
  },
  screenSize: {
    type: FIELD_TYPES.text,
    label: 'Screen Size',
    placeholder: 'e.g., 6.1 inches, 15.6 inches',
  },
  batteryCapacity: {
    type: FIELD_TYPES.text,
    label: 'Battery Capacity',
    placeholder: 'e.g., 4000 mAh',
  },
  networkType: {
    type: FIELD_TYPES.select,
    label: 'Network Type',
    placeholder: 'Select network',
    options: ['4G', '5G', 'Both'],
  },
  processor: {
    type: FIELD_TYPES.text,
    label: 'Processor',
    placeholder: 'e.g., Intel i7, AMD Ryzen 7',
  },
  graphicsCard: {
    type: FIELD_TYPES.text,
    label: 'Graphics Card',
    placeholder: 'e.g., NVIDIA RTX 3060',
  },
  operatingSystem: {
    type: FIELD_TYPES.select,
    label: 'Operating System',
    placeholder: 'Select OS',
    options: ['Windows', 'macOS', 'Linux', 'iOS', 'Android', 'Other'],
  },
  
  // Vehicle fields
  make: {
    type: FIELD_TYPES.text,
    label: 'Make',
    placeholder: 'e.g., Toyota, Honda',
  },
  year: {
    type: FIELD_TYPES.number,
    label: 'Year',
    placeholder: 'e.g., 2020',
    min: 1900,
    max: new Date().getFullYear() + 1,
  },
  mileage: {
    type: FIELD_TYPES.number,
    label: 'Kilometers (km)',
    placeholder: 'e.g., 50000',
    min: 0,
  },
  fuelType: {
    type: FIELD_TYPES.select,
    label: 'Fuel Type',
    placeholder: 'Select fuel type',
    options: ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG', 'LPG'],
  },
  transmission: {
    type: FIELD_TYPES.select,
    label: 'Transmission',
    placeholder: 'Select transmission',
    options: ['Manual', 'Automatic', 'CVT', 'Semi-Automatic'],
  },
  engineSize: {
    type: FIELD_TYPES.text,
    label: 'Engine Size',
    placeholder: 'e.g., 1.5L, 2000cc',
  },
  seatingCapacity: {
    type: FIELD_TYPES.number,
    label: 'Seating Capacity',
    placeholder: 'e.g., 5',
    min: 1,
  },
  doors: {
    type: FIELD_TYPES.select,
    label: 'Doors',
    placeholder: 'Select doors',
    options: ['2', '3', '4', '5', '5+', '5+ doors'],
  },
  trim: {
    type: FIELD_TYPES.text,
    label: 'Trim',
    placeholder: 'e.g. M Sport, Essential',
  },
  horsepower: {
    type: FIELD_TYPES.text,
    label: 'Horsepower',
    placeholder: 'e.g. 300 HP',
  },
  targetMarket: {
    type: FIELD_TYPES.text,
    label: 'Target Market',
    placeholder: 'e.g. GCC / UAE',
  },
  sellerType: {
    type: FIELD_TYPES.select,
    label: 'Seller type',
    placeholder: 'Select seller type',
    options: ['Private', 'Dealer'],
  },
  interiorColor: {
    type: FIELD_TYPES.text,
    label: 'Interior Color',
    placeholder: 'e.g. Tan, Black',
  },
  cylinders: {
    type: FIELD_TYPES.text,
    label: 'No. of Cylinders',
    placeholder: 'e.g. 6',
  },
  bodyType: {
    type: FIELD_TYPES.select,
    label: 'Body Type',
    placeholder: 'Select body type',
    options: ['Sedan', 'SUV', 'Hatchback', 'Coupe', 'Convertible', 'Wagon', 'Pickup'],
  },
  drivetrain: {
    type: FIELD_TYPES.select,
    label: 'Drivetrain',
    placeholder: 'Select drivetrain',
    options: ['FWD', 'RWD', 'AWD', '4WD'],
  },
  vin: {
    type: FIELD_TYPES.text,
    label: 'VIN Number',
    placeholder: 'Enter VIN',
  },
  
  // Furniture fields
  cushionType: {
    type: FIELD_TYPES.select,
    label: 'Cushion Type',
    placeholder: 'Select cushion type',
    options: ['Foam', 'Spring', 'Memory Foam', 'Feather'],
  },
  fabricType: {
    type: FIELD_TYPES.text,
    label: 'Fabric Type',
    placeholder: 'e.g., Cotton, Polyester, Leather',
  },
  reclining: {
    type: FIELD_TYPES.checkbox,
    label: 'Reclining',
  },
  tableType: {
    type: FIELD_TYPES.select,
    label: 'Table Type',
    placeholder: 'Select table type',
    options: ['Dining', 'Coffee', 'Side', 'Console', 'Desk'],
  },
  shape: {
    type: FIELD_TYPES.select,
    label: 'Shape',
    placeholder: 'Select shape',
    options: ['Round', 'Square', 'Rectangular', 'Oval'],
  },
  bedSize: {
    type: FIELD_TYPES.select,
    label: 'Bed Size',
    placeholder: 'Select bed size',
    options: ['Single', 'Double', 'Queen', 'King'],
  },
  bedType: {
    type: FIELD_TYPES.select,
    label: 'Bed Type',
    placeholder: 'Select bed type',
    options: ['Platform', 'Panel', 'Sleigh', 'Canopy', 'Bunk'],
  },
  mattressIncluded: {
    type: FIELD_TYPES.checkbox,
    label: 'Mattress Included',
  },
  hasStorage: {
    type: FIELD_TYPES.checkbox,
    label: 'Storage',
  },
  
  // Fashion fields
  size: {
    type: FIELD_TYPES.select,
    label: 'Size',
    placeholder: 'Select size',
    options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
  },
  fit: {
    type: FIELD_TYPES.select,
    label: 'Fit',
    placeholder: 'Select fit',
    options: ['Slim', 'Regular', 'Relaxed', 'Oversized'],
  },
  style: {
    type: FIELD_TYPES.text,
    label: 'Style',
    placeholder: 'e.g., Casual, Formal, Sporty',
  },
  season: {
    type: FIELD_TYPES.select,
    label: 'Season',
    placeholder: 'Select season',
    options: ['Spring', 'Summer', 'Fall', 'Winter', 'All Season'],
  },
  shoeType: {
    type: FIELD_TYPES.select,
    label: 'Shoe Type',
    placeholder: 'Select shoe type',
    options: ['Sneakers', 'Boots', 'Sandals', 'Heels', 'Flats', 'Loafers'],
  },
  heelHeight: {
    type: FIELD_TYPES.text,
    label: 'Heel Height',
    placeholder: 'e.g., 2 inches',
  },
  closureType: {
    type: FIELD_TYPES.select,
    label: 'Closure Type',
    placeholder: 'Select closure',
    options: ['Laces', 'Velcro', 'Slip-on', 'Buckle', 'Zipper'],
  },
  
  // Add more field configs as needed...
}

/** Map DB category names (e.g. Motors) to config keys (e.g. Vehicles). */
export const resolveCategoryKeyForFields = (categoryName) => {
  if (!categoryName) return ''
  const raw = String(categoryName).trim()
  if (CATEGORY_FIELD_CONFIGS[raw]) return raw
  const lower = raw.toLowerCase()
  if (lower.includes('motor') || lower.includes('vehicle') || lower === 'cars' || lower.includes('auto')) {
    return 'Vehicles'
  }
  return raw
}

// Helper function to get fields for a category/subcategory
export const getFieldsForCategory = (categoryName, subcategoryName) => {
  const key = resolveCategoryKeyForFields(categoryName)
  const config = CATEGORY_FIELD_CONFIGS[key]
  if (!config) return []

  const commonFields = config.commonFields || []
  const subcategoryFields = subcategoryName && config.subcategoryFields?.[subcategoryName]
    ? config.subcategoryFields[subcategoryName]
    : []

  const merged = [...commonFields, ...subcategoryFields]
  return [...new Set(merged)]
}

// Helper function to get brand options for a category/subcategory
export const getBrandOptionsForCategory = (categoryName, subcategoryName) => {
  const config = CATEGORY_FIELD_CONFIGS[categoryName]
  if (!config || !config.brands) return []

  if (subcategoryName && config.brands[subcategoryName]) {
    return config.brands[subcategoryName]
  }
  
  // Return first available brand list or empty
  const firstSubcategory = Object.keys(config.brands || {})[0]
  return config.brands[firstSubcategory] || []
}

// Helper function to get field config
export const getFieldConfig = (fieldName) => {
  return FIELD_CONFIGS[fieldName] || {
    type: FIELD_TYPES.text,
    label: fieldName.charAt(0).toUpperCase() + fieldName.slice(1),
    placeholder: `Enter ${fieldName}`,
  }
}

/** Condition options shared with Product model and vehicle filters */
export const CONDITION_OPTIONS = ['Brand New', 'Like New', 'Good', 'Fair', 'Poor']

/** True if subcategory is Bicycles (used to hide transmission/fuelType in form and filters) */
export const isVehicleSubcategoryBicycle = (subcategoryName) =>
  /bicycle|bike/i.test(String(subcategoryName || ''))

