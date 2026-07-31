import { assetUrl } from '@shared/utils/constants'

function BrandLogo({
  className = '',
  alt = 'Preelly',
  variant = 'light',
}) {
  // Resolved against the site URL so the logo also loads in the admin app, which Vite
  // serves under the /admin/ base — a root-relative path 404s there.
  const blueLogoSrc = assetUrl('/images/preelly-logo-blue.png')
  const whiteLogoSrc = assetUrl('/images/preelly-logo-white-transparent.png')

  if (variant === 'auto') {
    return (
      <>
        <img
          src={blueLogoSrc}
          alt={alt}
          className={`${className} block dark:hidden`.trim()}
          loading="eager"
        />
        <img
          src={whiteLogoSrc}
          alt={alt}
          className={`${className} hidden dark:block`.trim()}
          loading="eager"
        />
      </>
    )
  }

  const src =
    variant === 'dark'
      ? whiteLogoSrc
      : blueLogoSrc

  return (
    <img
      src={src}
      alt={alt}
      className={`${className} block`.trim()}
      loading="eager"
    />
  )
}

export default BrandLogo
