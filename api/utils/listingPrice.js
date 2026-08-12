/**
 * The amount a listing should be sorted and displayed by.
 *
 * A product carries two price columns: `productPrice`, which the post-ad flow and
 * the admin dynamic form write, and `price`, the original required column that is
 * left at a placeholder (1) by those flows. Reading `price` alone therefore shows
 * "AED 1" and makes price sorting a no-op, since every such listing shares one key.
 *
 * Mirrors getProductListingPrice() in
 * front/src/shared/components/categoryBrowseShared.jsx — keep the two in step.
 */

// Value written to the legacy `price` column when the real amount lives in
// productPrice; it is a filler, never a real price.
const LEGACY_PRICE_PLACEHOLDER = 1

function normalizeAmount (raw) {
  if (raw === undefined || raw === null || raw === '') return null
  const amount = Number(raw)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

/**
 * @param {object} product product document or lean object
 * @returns {number|null} the real amount, or null when the listing has no price
 *   (a giveaway, or "price on request")
 */
function resolveListingPrice (product) {
  const productPrice = normalizeAmount(product?.productPrice)
  if (productPrice != null) return productPrice

  const legacyPrice = normalizeAmount(product?.price)
  if (legacyPrice != null && legacyPrice !== LEGACY_PRICE_PLACEHOLDER) return legacyPrice

  return null
}

module.exports = {
  resolveListingPrice,
  LEGACY_PRICE_PLACEHOLDER,
}
