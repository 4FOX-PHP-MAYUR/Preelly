function BrandLogo({
  className = '',
  alt = 'Preelly',
  variant = 'light',
}) {
  const blueLogoSrc = '/images/preelly-logo-blue.png'
  const whiteLogoSrc = '/images/preelly-logo-white-transparent.png'

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
