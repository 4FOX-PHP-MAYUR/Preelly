import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ChevronDown, Phone } from 'lucide-react'
import BrandLogo from '@shared/components/BrandLogo'
import { testimonialService } from '@shared/services/api'
import {
  findCountryByDialCode,
  getCountryByIso,
  searchCountries,
} from '@shared/data/countryCodes'

const CUSTOMER_TYPE_ROLE_LABEL = {
  seller: 'Seller',
  buyer: 'Car Buyer',
}

export const AuthField = forwardRef(function AuthField({
  label,
  icon: Icon,
  error,
  className = '',
  ...inputProps
}, ref) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-800">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        )}
        <input
          ref={ref}
          {...inputProps}
          className={`h-[52px] w-full rounded-[14px] border border-[#dfe1ec] bg-white pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#3128ff] focus:ring-4 focus:ring-[#3128ff]/10 sm:text-base ${Icon ? 'pl-11' : 'pl-4'} ${className}`.trim()}
        />
      </div>
      {error ? <p className="mt-2 text-sm text-red-500">{error}</p> : null}
    </div>
  )
})

function CountryCodePicker({ countryIso, onCountryIsoChange }) {
  const selected = getCountryByIso(countryIso)
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(selected.code)

  useEffect(() => {
    if (!open) {
      setQuery(selected.code)
    }
  }, [selected.code, open])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredCountries = useMemo(
    () => searchCountries(open ? query : '', open ? Infinity : 0),
    [open, query]
  )

  const selectCountry = (iso) => {
    const country = getCountryByIso(iso)
    onCountryIsoChange?.(iso)
    setQuery(country.code)
    setOpen(false)
  }

  const handleBlur = () => {
    window.setTimeout(() => {
      if (containerRef.current?.contains(document.activeElement)) {
        return
      }

      const matched = findCountryByDialCode(query)
      if (matched) {
        onCountryIsoChange?.(matched.iso)
        setQuery(matched.code)
      } else {
        setQuery(selected.code)
      }
      setOpen(false)
    }, 120)
  }

  return (
    <div
      ref={containerRef}
      className="relative w-[118px] shrink-0 sm:w-[128px]"
    >
      <div
        className="relative flex h-[52px] items-center gap-1.5 rounded-[14px] border border-[#dfe1ec] bg-white px-2.5 transition focus-within:border-[#3128ff] focus-within:ring-4 focus-within:ring-[#3128ff]/10"
        onMouseDown={(event) => {
          if (event.target === inputRef.current) return
          event.preventDefault()
          inputRef.current?.focus()
        }}
      >
        <span className="pointer-events-none text-base leading-none">{selected.flag}</span>
        <input
          ref={inputRef}
          type="text"
          inputMode="tel"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            setOpen(true)
            setQuery('')
          }}
          onBlur={handleBlur}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && filteredCountries[0]) {
              event.preventDefault()
              selectCountry(filteredCountries[0].iso)
            }
            if (event.key === 'Escape') {
              setOpen(false)
              setQuery(selected.code)
            }
          }}
          placeholder="+971"
          aria-label="Country code"
          aria-expanded={open}
          aria-autocomplete="list"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400"
        />
        <ChevronDown className="pointer-events-none h-4 w-4 shrink-0 text-slate-400" />
      </div>

      {open && filteredCountries.length > 0 ? (
        <ul
          role="listbox"
          className="absolute left-0 top-[calc(100%+4px)] z-30 max-h-56 w-[260px] max-w-[80vw] overflow-y-auto rounded-2xl border border-[#d8dbea] bg-white py-1 shadow-[0_16px_40px_rgba(15,23,42,0.12)]"
        >
          {filteredCountries.map((item) => (
            <li key={item.iso} role="option" aria-selected={item.iso === selected.iso}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectCountry(item.iso)}
                className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-[#f5f6fb] ${
                  item.iso === selected.iso ? 'bg-[#f5f6fb]' : ''
                }`}
              >
                <span className="text-base leading-none">{item.flag}</span>
                <span className="min-w-0 flex-1 truncate text-slate-800">{item.label}</span>
                <span className="shrink-0 font-medium text-slate-600">{item.code}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export const AuthPhoneField = forwardRef(function AuthPhoneField({
  label = 'Mobile Number',
  countryIso,
  onCountryIsoChange,
  error,
  className = '',
  ...inputProps
}, ref) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-800">
        {label}
      </label>
      <div className="flex gap-2">
        <CountryCodePicker
          countryIso={countryIso}
          onCountryIsoChange={onCountryIsoChange}
        />

        <div className="relative min-w-0 flex-1">
          <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            ref={ref}
            type="tel"
            inputMode="tel"
            {...inputProps}
            className={`h-[52px] w-full rounded-[14px] border border-[#dfe1ec] bg-white pl-11 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#3128ff] focus:ring-4 focus:ring-[#3128ff]/10 sm:text-base ${className}`.trim()}
          />
        </div>
      </div>
      {error ? <p className="mt-2 text-sm text-red-500">{error}</p> : null}
    </div>
  )
})

export function AuthSocialButton({ label, onClick, disabled, children, active = false }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-14 items-center justify-center rounded-2xl border bg-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
        active
          ? 'border-[#3128ff] shadow-[0_12px_30px_rgba(49,40,255,0.18)]'
          : 'border-[#e4e7f1] hover:border-[#cfd5e6] hover:shadow-sm'
      }`}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  )
}

export function AuthSidePanel({ quote, quoteAuthor, quoteRole }) {
  const [testimonials, setTestimonials] = useState([])
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await testimonialService.listActiveTestimonials()
        if (cancelled) return
        const items = res.data?.data || []
        setTestimonials(
          items.map((item) => ({
            quote: item.testimonial,
            quoteAuthor: item.testimonialName,
            quoteRole: CUSTOMER_TYPE_ROLE_LABEL[item.customerType] || 'Customer',
          }))
        )
      } catch {
        // Fall back to the static quote passed in via props.
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const slides = testimonials.length ? testimonials : [{ quote, quoteAuthor, quoteRole }]
  const activeSlide = slides[activeIndex] || slides[0]
  const hasMultipleSlides = slides.length > 1

  const goToPrevious = () => {
    setActiveIndex((current) => (current - 1 + slides.length) % slides.length)
  }

  const goToNext = () => {
    setActiveIndex((current) => (current + 1) % slides.length)
  }

  return (
    <aside className="relative hidden w-full max-w-[677px] min-h-[760px] justify-self-start overflow-hidden rounded-[40px] bg-[#3520d8] p-6 text-white shadow-[0_32px_100px_rgba(49,40,255,0.28)] lg:flex lg:flex-col">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          background:
            'radial-gradient(130% 90% at 10% 0%, rgba(137,174,255,0.22) 0%, rgba(137,174,255,0) 45%), linear-gradient(312.92deg, rgba(220, 31, 255, 0.45) -2.04%, rgba(0, 0, 255, 0.45) 90.02%), linear-gradient(180deg, #2432F7 0%, #5C25D8 50%, #7026D2 100%)',
        }}
      />

      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-[14%] top-[4%] h-24 w-[125%] rotate-[-8deg] rounded-full bg-white/12 blur-[2px]" />
        <div className="absolute -left-[6%] top-[13%] h-16 w-[120%] rotate-[-11deg] rounded-full bg-[#78a3ff]/18 blur-[2px]" />
        <div className="absolute -left-[12%] top-[21%] h-16 w-[120%] rotate-[-8deg] rounded-full bg-white/10 blur-[2px]" />
        <div className="absolute -right-[12%] top-[33%] h-20 w-[118%] rotate-[-14deg] rounded-full bg-[#78a3ff]/12 blur-[2px]" />
        <div className="absolute right-[-8%] top-[54%] h-24 w-[78%] rotate-[-24deg] rounded-full bg-[#f095ff]/12 blur-[8px]" />
        <div className="absolute bottom-0 left-0 right-0 h-52 bg-gradient-to-t from-black/12 to-transparent" />
      </div>
      <video className='w-full h-full absolute inset-0 object-cover z-40' src="/videos/login_bg.mp4" autoPlay loop muted playsInline></video>

      <div className="relative z-50 flex h-full flex-1 flex-col">
        <div className="mx-auto mt-6 flex w-full max-w-[519px] flex-col items-center text-center xl:mt-8">
          <BrandLogo variant="dark" className="h-16 w-auto xl:h-[78px]" />
          <p className="mt-3 text-[15px] font-medium tracking-[0.01em] text-white/95 xl:text-base">
            Buy. Sell. Watch.
          </p>
        </div>

        <div className="mt-auto w-full max-w-[630px] self-center">
          <div className="min-h-[300px] rounded-[32px] border border-white/10 bg-white/[0.16] px-8 py-9 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md xl:min-h-[335px] xl:px-9 xl:py-10">
            <p className="max-w-[34rem] text-[2rem] font-normal leading-[1.25] text-white xl:text-[36px] xl:leading-[45px]">
              {activeSlide.quote}
            </p>
            <div className="mt-10 xl:mt-[72px]">
              <p className="text-[1.25rem] font-medium text-white">{activeSlide.quoteAuthor}</p>
              <p className="mt-1 text-base font-medium text-[#E1E1E1]">{activeSlide.quoteRole}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom-right nav buttons, seated in a white notch carved from the panel corner. */}
      <div className="absolute bottom-0 right-0 z-50 flex items-center gap-[14px] rounded-tl-[32px] rounded-br-[40px] bg-white pb-5 pl-7 pr-5 pt-6">
        <button
          type="button"
          onClick={goToPrevious}
          disabled={!hasMultipleSlides}
          aria-label="Previous testimonial"
          className="flex h-[62px] w-[74px] items-center justify-center rounded-[18px] border border-[#E6E9F5] bg-white text-[#21357C] shadow-[0_6px_18px_rgba(20,0,255,0.10)] transition hover:bg-[#f8faff] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowLeft className="h-6 w-6 stroke-[1.75]" />
        </button>
        <button
          type="button"
          onClick={goToNext}
          disabled={!hasMultipleSlides}
          aria-label="Next testimonial"
          className="flex h-[62px] w-[74px] items-center justify-center rounded-[18px] border border-[#E6E9F5] bg-white text-[#21357C] shadow-[0_6px_18px_rgba(20,0,255,0.10)] transition hover:bg-[#f8faff] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowRight className="h-6 w-6 stroke-[1.75]" />
        </button>
      </div>
    </aside>
  )
}

function AuthSplitLayout({
  title,
  subtitle,
  modeLabel,
  switchPrompt,
  switchLabel,
  switchTo,
  switchArrow = false,
  switchOnClick,
  children,
  quote,
  quoteAuthor,
  quoteRole,
}) {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-white px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto grid max-w-fit gap-6 sm:gap-8 lg:grid-cols-[minmax(0,552px)_minmax(0,1fr)]">
        <section className="mx-auto w-full max-w-[552px] px-5 py-7 sm:px-8 lg:mx-0 lg:px-10 lg:py-10">
          {modeLabel ? (
            <p className="mb-4 sm:mb-6 text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#3128ff]">
              {modeLabel}
            </p>
          ) : null}
          <div className="mb-6 sm:mb-8">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-950">
              {title}
            </h1>
            <p className="mt-2 sm:mt-3 text-sm sm:text-base leading-7 text-slate-500">
              {subtitle}
            </p>
          </div>

          {children}

          {switchTo && switchLabel ? (
            <p className="mt-8 text-center text-sm text-slate-500">
              {switchPrompt ? <>{switchPrompt}{' '}</> : null}
              <Link
                to={switchTo}
                onClick={switchOnClick}
                className="inline-flex items-center gap-1 align-middle font-semibold text-[#3128ff] hover:text-[#221bc9]"
              >
                {switchLabel}
                {switchArrow ? <ArrowRight className="h-4 w-4" /> : null}
              </Link>
            </p>
          ) : null}
        </section>

        <AuthSidePanel quote={quote} quoteAuthor={quoteAuthor} quoteRole={quoteRole} />
      </div>
    </div>
  )
}

export default AuthSplitLayout
