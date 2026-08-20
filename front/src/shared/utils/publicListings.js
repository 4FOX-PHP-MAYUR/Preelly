// What counts as an "available" listing on public browse pages, in one place.
//
// Only `active` listings are available to a visitor: `pending` is awaiting admin
// approval, `sold`/`inactive`/`paused`/`rejected` are all off the market.
//
// This is sent explicitly rather than relying on the API's public gate, because
// that gate is skipped for admin accounts (they need every status to moderate).
// Without it an admin browsing the site sees pending and paused listings mixed
// into a public browse page — a different page than every other visitor gets.
export const PUBLIC_LISTING_STATUS = 'active'
