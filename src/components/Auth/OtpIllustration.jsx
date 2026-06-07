function OtpIllustration({
  src = '/images/verification-illustration.png',
  alt = 'Verification illustration',
}) {
  return (
    <div className="mx-auto flex w-full max-w-[320px] items-center justify-center">
      <img
        src={src}
        alt={alt}
        className="h-auto w-full object-contain"
        loading="eager"
      />
    </div>
  )
}

export default OtpIllustration
