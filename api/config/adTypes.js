/**
 * Ad tiers (config-driven).
 * Backend stores a snapshot of the selected tier in `Product.adConfig`
 * so pricing/features remain consistent even if this config changes later.
 */
module.exports = {
  free: {
    price: 0,
    currency: 'USD',
    features: ['Standard visibility'],
  },
  basic: {
    price: 5,
    currency: 'USD',
    features: ['Boosted visibility', 'Higher placement in feed'],
  },
  premium: {
    price: 15,
    currency: 'USD',
    features: ['Top placement in feed', 'Priority moderation'],
  },
}

