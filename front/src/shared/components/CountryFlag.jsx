/**
 * Renders a country flag from ISO 3166-1 alpha-2 code (e.g. "US", "AE").
 * Uses flag-icons (SVG backgrounds) so flags display on Windows, macOS, and mobile.
 */
export default function CountryFlag({ iso, className = '' }) {
  const code = String(iso || '').toLowerCase()
  if (!code) return null

  return (
    <span
      className={`fi fi-${code} inline-block shrink-0 text-[18px] leading-none ${className}`.trim()}
      aria-hidden="true"
    />
  )
}
