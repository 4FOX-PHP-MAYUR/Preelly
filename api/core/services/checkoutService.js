const AppError = require('../errors/AppError')
const Product = require('../../models/Product')
const Package = require('../../models/Package')
const StorageFacility = require('../../models/StorageFacility')

const DEFAULT_CURRENCY = 'AED'

/** Rounds to 2dp without float dust (0.1 + 0.2 style drift). */
function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

/** Flat price of the optional Storage Facility add-on, configured per environment. */
function getStorageFacilityAmount() {
  const raw = Number(process.env.STORAGE_FACILITY_AMOUNT)
  return Number.isFinite(raw) && raw >= 0 ? round2(raw) : 0
}

/**
 * Builds the checkout order summary for a submitted listing.
 *
 * The seller is charged for the PACKAGE they selected — not the listing's own
 * price. The listing price is shown for context only and never billed.
 *
 * The optional Storage Facility add-on costs a flat "fix cost" (STORAGE_FACILITY_AMOUNT)
 * PLUS the price of the chosen duration from the `storagefacilities` collection.
 *
 * VAT (a percentage carried on the package) applies to the combined taxable base
 * of package + storage facility.
 */
async function getCheckoutSummary({ productId, packageId, storageFacilityId, userId }) {
  const product = await Product.findById(productId)
    .select('title price productPrice currency images video videoScreenshots year kilometers mileage seller category subcategory isPaymentDone package')
    .populate('category', 'name')
    .populate('subcategory', 'name')
    .lean()

  if (!product) {
    throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND')
  }
  if (userId && String(product.seller) !== String(userId)) {
    throw new AppError('Not authorized to check out this listing', 403, 'FORBIDDEN')
  }

  // Fall back to the package already attached to the listing when none is passed.
  const resolvedPackageId = packageId || product.package
  if (!resolvedPackageId) {
    throw new AppError('No package selected for this listing', 400, 'PACKAGE_REQUIRED')
  }

  const pkg = await Package.findOne({ _id: resolvedPackageId, isDeleted: false, status: true }).lean()
  if (!pkg) {
    throw new AppError('Package not found', 404, 'PACKAGE_NOT_FOUND')
  }

  // Storage Facility add-on: only priced when the seller picked a duration.
  const storageFixedCost = getStorageFacilityAmount()
  let selectedFacility = null
  if (storageFacilityId) {
    const facility = await StorageFacility.findOne({
      _id: storageFacilityId,
      isDeleted: false,
      status: true,
    }).lean()
    if (!facility) {
      throw new AppError('Storage facility not found', 404, 'STORAGE_FACILITY_NOT_FOUND')
    }
    selectedFacility = facility
  }

  const storageDurationCost = selectedFacility ? round2(selectedFacility.facilityAmount ?? 0) : 0
  // Fix cost only applies when the add-on is actually taken.
  const storageAmount = selectedFacility ? round2(storageFixedCost + storageDurationCost) : 0

  const packageAmount = round2(pkg.packageAmount ?? 0)
  const vatPercentage = pkg.isVatApplicable ? Number(pkg.vatAmount ?? 0) : 0

  const taxableBase = round2(packageAmount + storageAmount)
  const vatValue = round2((taxableBase * vatPercentage) / 100)
  const total = round2(taxableBase + vatValue)

  const thumbnail =
    product.images?.[0] ||
    product.videoScreenshots?.[0]?.image ||
    null

  return {
    product: {
      id: String(product._id),
      title: product.title,
      categoryName: product.subcategory?.name || product.category?.name || null,
      // Needed so category-scoped coupons can be validated against this listing.
      categoryId: product.category?._id ? String(product.category._id) : null,
      subcategoryId: product.subcategory?._id ? String(product.subcategory._id) : null,
      year: product.year ?? null,
      kilometers: product.kilometers ?? product.mileage ?? null,
      // Listing price — displayed for context, never charged. Vehicle listings carry
      // `productPrice`; fall back to `price` for categories that don't set it.
      listingPrice: round2(product.productPrice ?? product.price ?? 0),
      image: thumbnail,
      isPaymentDone: product.isPaymentDone ?? 0,
    },
    package: {
      id: String(pkg._id),
      packageName: pkg.packageName,
      packageAmount,
      isVatApplicable: Boolean(pkg.isVatApplicable),
      vatPercentage,
    },
    storageFacility: {
      // Flat "Fix Cost" from STORAGE_FACILITY_AMOUNT, charged on top of the duration.
      fixedCost: storageFixedCost,
      selected: Boolean(selectedFacility),
      selectedFacility: selectedFacility
        ? {
            id: String(selectedFacility._id),
            facilityWeek: selectedFacility.facilityWeek,
            facilityAmount: storageDurationCost,
          }
        : null,
      durationCost: storageDurationCost,
      // Fix Cost + Storage Cost — the "Storage Facility" line in the order summary.
      total: storageAmount,
    },
    summary: {
      currency: product.currency || DEFAULT_CURRENCY,
      packageAmount,
      storageAmount,
      vatPercentage,
      vatValue,
      total,
    },
  }
}

module.exports = {
  getStorageFacilityAmount,
  getCheckoutSummary,
  round2,
}
