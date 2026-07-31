// What "Featured Listings" means, in one place — shared by the detail page's rail and
// the /featured page it links to, so the two can never show different sets.
//
// There is no promotion flag on a listing yet (every Product is adType 'free', and the
// list endpoint has no featured/adType filter), so featured currently resolves to the
// newest active listings. When real promotion lands, change the query here and both
// surfaces follow.

export const FEATURED_LISTINGS_QUERY = { sortBy: 'newest' }

/** How many tiles the detail-page rail shows before "See all". */
export const FEATURED_RAIL_LIMIT = 6

export const FEATURED_LISTINGS_PATH = '/featured'

export const FEATURED_LISTINGS_TITLE = 'Featured Listings'
