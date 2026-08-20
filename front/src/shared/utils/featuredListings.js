// What "Featured Listings" means, in one place — shared by the detail page's rail and
// the /featured page it links to, so the two can never show different sets.
//
// Backed by the `isFeature` flag on Product, set only from Admin Panel → Products →
// Edit Feature. `sortBy` is just the default sort applied on top of that filter.
//
// The status filter comes from PUBLIC_LISTING_STATUS — see that file for why a
// public-facing rail has to send it explicitly.

import { PUBLIC_LISTING_STATUS } from '@shared/utils/publicListings'

export const FEATURED_LISTINGS_QUERY = {
  isFeature: true,
  status: PUBLIC_LISTING_STATUS,
  sortBy: 'newest',
}

/** How many tiles the detail-page rail shows before "See all". */
export const FEATURED_RAIL_LIMIT = 6

export const FEATURED_LISTINGS_PATH = '/featured'

export const FEATURED_LISTINGS_TITLE = 'Featured Listings'
