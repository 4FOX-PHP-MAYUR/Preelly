const mongoose = require('mongoose')

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Product title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    currency: {
      type: String,
      default: 'USD',
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
    },
    subcategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    // Full category hierarchy path: [rootId, level1Id, level2Id, ...]
    // e.g. [motorsId, newCarsId, landRoverId, discoveryId, hseLuxuryId]
    categoryPath: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    }],
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
    },
    video: {
      type: String,
      default: null,
    },
    // Keyframe-based screenshots extracted from the uploaded video.
    // `image` points to a file stored under `/uploads/videos/screenshots/...`
    // `timestamp` is the moment in seconds in the original (compressed) video.
    videoScreenshots: [
      {
        image: { type: String, required: true },
        timestamp: { type: Number, required: true },
        source: { type: String, default: 'auto', trim: true },
      },
    ],
    images: [
      {
        type: String,
      },
    ],
    // Ad category chosen at posting time (config-driven pricing/visibility tiers).
    adType: {
      type: String,
      enum: ['free', 'basic', 'premium'],
      default: 'free',
    },
    // Derived/config snapshot of what the selected ad tier means.
    // This keeps historical pricing/features even if config changes later.
    adConfig: {
      type: new mongoose.Schema(
        {
          price: { type: Number, default: 0, min: 0 },
          currency: { type: String, default: 'USD' },
          features: [{ type: String, trim: true }],
        },
        { _id: false },
      ),
      default: null,
    },
    brand: {
      type: String,
      trim: true,
    },
    condition: {
      type: String,
      enum: ['Brand New', 'Like New', 'Good', 'Fair', 'Poor'],
      required: [true, 'Condition is required'],
    },
    // Additional product details - Dynamic fields based on category
    material: {
      type: String,
      trim: true,
    },
    dimensions: {
      length: { type: Number },
      width: { type: Number },
      height: { type: Number },
      unit: { type: String, enum: ['cm', 'inch'], default: 'cm' },
    },
    seatingCapacity: {
      type: Number,
    },
    color: {
      type: String,
      trim: true,
    },
    assemblyStatus: {
      type: String,
      enum: ['Assembled', 'Needs Assembly'],
    },
    // Electronics fields
    model: { type: String, trim: true },
    warranty: { type: String, trim: true },
    // Used across categories:
    // - Electronics: can store a string
    // - Vehicles (AI): can store structured JSON (engine_cc, horsepower, etc.)
    specifications: { type: mongoose.Schema.Types.Mixed, default: null },
    storageCapacity: { type: String, trim: true }, // For electronics
    ram: { type: String, trim: true },
    screenSize: { type: String, trim: true },
    batteryCapacity: { type: String, trim: true },
    networkType: { type: String, trim: true },
    processor: { type: String, trim: true },
    graphicsCard: { type: String, trim: true },
    operatingSystem: { type: String, trim: true },
    connectivity: { type: String, trim: true },
    batteryLife: { type: String, trim: true },
    noiseCancellation: { type: Boolean },
    driverSize: { type: String, trim: true },
    megapixels: { type: String, trim: true },
    lensType: { type: String, trim: true },
    zoom: { type: String, trim: true },
    videoResolution: { type: String, trim: true },
    batteryType: { type: String, trim: true },
    controllerIncluded: { type: Boolean },
    gamesIncluded: { type: Boolean },
    onlineCapable: { type: Boolean },
    // Vehicle fields
    make: { type: String, trim: true },
    // trim = vehicle trim level (e.g. "A 220", "HSE Luxury")
    trim: { type: String },
    variant: { type: String, trim: true },
    year: { type: Number },
    mileage: { type: Number },
    fuelType: { type: String, trim: true },
    transmission: { type: String, trim: true },
    engineSize: { type: String, trim: true },
    horsepower: { type: String, trim: true },
    interiorColor: { type: String, trim: true },
    targetMarket: { type: String, trim: true },
    sellerType: { type: String, trim: true },
    cylinders: { type: String, trim: true },
    doors: { type: String, trim: true },
    bodyType: { type: String, trim: true },
    drivetrain: { type: String, trim: true },
    vin: { type: String, trim: true },
    bikeType: { type: String, trim: true },
    topSpeed: { type: String, trim: true },
    frameSize: { type: String, trim: true },
    gears: { type: String, trim: true },
    brakeType: { type: String, trim: true },
    suspension: { type: String, trim: true },
    beam: { type: Number },
    engineType: { type: String, trim: true },
    maxCapacity: { type: Number },
    hullMaterial: { type: String, trim: true },
    // Furniture fields
    cushionType: { type: String, trim: true },
    fabricType: { type: String, trim: true },
    reclining: { type: Boolean },
    tableType: { type: String, trim: true },
    shape: { type: String, trim: true },
    chairType: { type: String, trim: true },
    armrests: { type: Boolean },
    swivel: { type: Boolean },
    adjustable: { type: Boolean },
    bedSize: { type: String, trim: true },
    bedType: { type: String, trim: true },
    mattressIncluded: { type: Boolean },
    hasStorage: { type: Boolean }, // For furniture storage
    wardrobeDoors: { type: Number },
    shelves: { type: Number },
    hangingSpace: { type: String, trim: true },
    mirror: { type: Boolean },
    // Fashion fields
    size: { type: String, trim: true },
    fit: { type: String, trim: true },
    style: { type: String, trim: true },
    season: { type: String, trim: true },
    shoeType: { type: String, trim: true },
    heelHeight: { type: String, trim: true },
    closureType: { type: String, trim: true },
    accessoryType: { type: String, trim: true },
    watchType: { type: String, trim: true },
    movement: { type: String, trim: true },
    waterResistance: { type: String, trim: true },
    bandMaterial: { type: String, trim: true },
    // Home & Garden fields
    applianceType: { type: String, trim: true },
    energyRating: { type: String, trim: true },
    capacity: { type: String, trim: true },
    toolType: { type: String, trim: true },
    powerType: { type: String, trim: true },
    plantType: { type: String, trim: true },
    potSize: { type: String, trim: true },
    careLevel: { type: String, trim: true },
    age: { type: String, trim: true },
    decorType: { type: String, trim: true },
    // Sports fields
    equipmentType: { type: String, trim: true },
    weightCapacity: { type: Number },
    features: { type: String, trim: true },
    gearType: { type: String, trim: true },
    weatherResistance: { type: String, trim: true },
    accessoryType: { type: String, trim: true },
    // Books fields
    author: { type: String, trim: true },
    isbn: { type: String, trim: true },
    language: { type: String, trim: true },
    genre: { type: String, trim: true },
    edition: { type: String, trim: true },
    pages: { type: Number },
    subject: { type: String, trim: true },
    course: { type: String, trim: true },
    // Toys & Games fields
    ageRange: { type: String, trim: true },
    playerCount: { type: Number },
    playTime: { type: String, trim: true },
    gameType: { type: String, trim: true },
    piecesIncluded: { type: Boolean },
    platform: { type: String, trim: true },
    dlcIncluded: { type: Boolean },
    toyType: { type: String, trim: true },
    batteryRequired: { type: Boolean },
    // Dynamic fields storage (for any additional fields)
    additionalFields: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
    // Filter selections persisted from the post-ad form or auto-resolved from transcript.
    // Stores Filter ObjectIds (both parent/root filter IDs and child/value filter IDs).
    selectedFilters: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Filter',
      },
    ],
    // Readable filter data: { "Condition": { id: "...", value: "Brand New" }, "Color": { id: "...", value: "Black" } }
    filterData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // AI listing extraction payload (snake_case keys as returned by /api/listings/ai-extract)
    display_data: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // Indexed for query/search.
    filter_data: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    missing_fields: {
      type: [String],
      default: [],
    },
    ai_raw_response: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // Usage details
    purchaseYear: {
      type: Number,
    },
    usageDuration: {
      value: { type: Number },
      unit: { type: String, enum: ['months', 'years'] },
    },
    reasonForSelling: {
      type: String,
      trim: true,
    },
    // Price details
    priceType: {
      type: String,
      enum: ['Fixed', 'Negotiable'],
      default: 'Fixed',
    },
    // Location & Delivery
    country: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    area: {
      type: String,
      trim: true,
    },
    deliveryOptions: {
      buyerPickup: { type: Boolean, default: true },
      sellerDelivery: { type: Boolean, default: false },
      deliveryCharges: { type: Number, default: 0 },
    },
    // Contact preferences
    contactName: {
      type: String,
      trim: true,
    },
    contactPhone: {
      type: String,
      trim: true,
    },
    contactOptions: {
      inAppChat: { type: Boolean, default: true },
      call: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: false },
    },
    // Moderation
    rejectionReason: {
      type: String,
      trim: true,
    },
    moderationNotes: {
      type: String,
      trim: true,
    },
    rejectionDetails: {
      category: { type: String, default: null, trim: true },
      categories: [{ type: String, trim: true }],
      reasons: [{ type: String, trim: true }],
      reasonSelections: [
        {
          category: { type: String, required: true, trim: true },
          reasons: [{ type: String, trim: true }],
          _id: false,
        },
      ],
      customReason: { type: String, default: null, trim: true },
      rejectedAt: { type: Date, default: null },
      rejectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      _id: false,
    },
    // Explicit moderation state for UI consistency.
    // Keep `status` for backward compatibility (active/pending/rejected/etc.).
    moderationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    // Normalized, extraction-friendly listing details (used for autofill & recommendations).
    aiExtractedDetails: {
      type: new mongoose.Schema(
        {
          title: { type: String, trim: true, default: null },
          brand: { type: String, trim: true, default: null },
          model: { type: String, trim: true, default: null },
          year: { type: Number, default: null },
          price: { type: Number, default: null, min: 0 },
          currency: { type: String, trim: true, default: 'USD' },
          condition: { type: String, default: null },
          // The full normalized object (safe for storing extra platform-specific fields).
          raw: { type: mongoose.Schema.Types.Mixed, default: null },
        },
        { _id: false },
      ),
      default: null,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'rejected', 'sold', 'inactive', 'paused'],
      default: 'pending',
    },
    views: {
      type: Number,
      default: 0,
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
  }
)

// Index for search optimization
productSchema.index({ title: 'text', description: 'text' })
productSchema.index({ category: 1, location: 1 })
productSchema.index({ subcategory: 1 })
productSchema.index({ seller: 1 })
productSchema.index({ seller: 1, createdAt: -1 })
productSchema.index({ status: 1, createdAt: -1 })
productSchema.index({ createdAt: -1 })
// Helps membership checks for “liked by user” when querying by likes array.
productSchema.index({ likes: 1 })
productSchema.index({ selectedFilters: 1 })
productSchema.index({ categoryPath: 1 })

// AI listing extraction indexes (nested fields in `filter_data`)
productSchema.index({ 'filter_data.price': 1 })
productSchema.index({ 'filter_data.mileage_km': 1 })
productSchema.index({ 'filter_data.year': 1 })
productSchema.index({ 'filter_data.brand': 1 })
productSchema.index({ 'filter_data.model': 1 })
productSchema.index({ 'filter_data.location_city': 1 })
productSchema.index({ 'filter_data.engine_cc': 1 })
productSchema.index({ 'filter_data.horsepower': 1 })
productSchema.index({ 'filter_data.transmission': 1 })
productSchema.index({ 'filter_data.fuel_type': 1 })
productSchema.index({ 'filter_data.body_type': 1 })
productSchema.index({ 'filter_data.condition': 1 })
productSchema.index({ 'filter_data.accident_free': 1 })

productSchema.index({ 'filter_data.brand': 1, 'filter_data.model': 1 })

// Increment views
productSchema.methods.incrementViews = function () {
  this.views += 1
  return this.save()
}

module.exports = mongoose.model('Product', productSchema)

