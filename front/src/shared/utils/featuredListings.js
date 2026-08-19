// What "Featured Listings" means, in one place — shared by the detail page's rail and
// the /featured page it links to, so the two can never show different sets.
//
// Backed by the `isFeature` flag on Product, set only from Admin Panel → Products →
// Edit Feature. `sortBy` is just the default sort applied on top of that filter.
//
// `status: 'active'` is sent explicitly rather than relying on the API's public
// gate, because that gate is skipped for admin accounts (they need to see every
// status to moderate). Without it, an admin browsing the site sees pending,
// paused and rejected listings in a rail that is meant to be public marketing —
// a different page than every other visitor gets.

export const FEATURED_LISTINGS_QUERY = { isFeature: true, status: 'active', sortBy: 'newest' }

/** How many tiles the detail-page rail shows before "See all". */
export const FEATURED_RAIL_LIMIT = 6

export const FEATURED_LISTINGS_PATH = '/featured'

export const FEATURED_LISTINGS_TITLE = 'Featured Listings'
