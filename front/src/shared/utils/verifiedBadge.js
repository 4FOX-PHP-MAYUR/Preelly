import { assetUrl } from './constants'

// Verified badge image paths — resolved against the site URL so they also load in the
// admin app, which is served under the /admin/ base.
export const VERIFIED_BADGE_IMAGES = {
  // Small size (16px) - for avatar badges
  small: assetUrl('/images/verified-checkmark.svg'),
  // Medium size (20px) - for name badges
  medium: assetUrl('/images/verified-checkmark.svg'),
  // Large size (24px) - for profile headers
  large: assetUrl('/images/verified-checkmark.svg'),
}

// Alternative: If you want to use PNG, convert the SVG to PNG and update these paths
// You can use online tools like https://cloudconvert.com/svg-to-png
// Or use ImageMagick: convert verified-checkmark.svg verified-checkmark.png

