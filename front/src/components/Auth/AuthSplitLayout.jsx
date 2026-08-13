import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, ChevronDown, Phone } from "lucide-react";
import BrandLogo from "@shared/components/BrandLogo";
import CountryFlag from "@shared/components/CountryFlag";
import { testimonialService } from "@shared/services/api";
import {
  findCountryByDialCode,
  getCountryByIso,
  searchCountries,
} from "@shared/data/countryCodes";
import BuySellWatch from "../../assets/icons/BuySellWatch";

const CUSTOMER_TYPE_ROLE_LABEL = {
  seller: "Seller",
  buyer: "Car Buyer",
};

export const AuthField = forwardRef(function AuthField(
  { label, icon: Icon, error, className = "", ...inputProps },
  ref,
) {
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
          className={`h-[52px] w-full rounded-[14px] border border-[#dfe1ec] bg-white pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-brand/10 sm:text-base ${Icon ? "pl-11" : "pl-4"} ${className}`.trim()}
        />
      </div>
      {error ? <p className="mt-2 text-sm text-red-500">{error}</p> : null}
    </div>
  );
});

function CountryCodePicker({ countryIso, onCountryIsoChange }) {
  const selected = getCountryByIso(countryIso);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(selected.code);

  useEffect(() => {
    if (!open) {
      setQuery(selected.code);
    }
  }, [selected.code, open]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredCountries = useMemo(
    () => searchCountries(open ? query : "", open ? Infinity : 0),
    [open, query],
  );

  const selectCountry = (iso) => {
    const country = getCountryByIso(iso);
    onCountryIsoChange?.(iso);
    setQuery(country.code);
    setOpen(false);
  };

  const handleBlur = () => {
    window.setTimeout(() => {
      if (containerRef.current?.contains(document.activeElement)) {
        return;
      }

      const matched = findCountryByDialCode(query);
      if (matched) {
        onCountryIsoChange?.(matched.iso);
        setQuery(matched.code);
      } else {
        setQuery(selected.code);
      }
      setOpen(false);
    }, 120);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-fit max-w-[42%] shrink-0 min-[1025px]:w-[128px] min-[1025px]:max-w-none"
    >
      <div
        className="relative flex h-[52px] w-fit items-center gap-1 rounded-[14px] border-0 bg-transparent py-0 pl-3 pr-1.5 transition min-[1025px]:w-full min-[1025px]:gap-1.5 min-[1025px]:border min-[1025px]:border-[#dfe1ec] min-[1025px]:bg-white min-[1025px]:px-2.5 min-[1025px]:focus-within:border-brand min-[1025px]:focus-within:ring-4 min-[1025px]:focus-within:ring-brand/10"
        onMouseDown={(event) => {
          if (event.target === inputRef.current) return;
          event.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <CountryFlag iso={selected.iso} />
        <input
          ref={inputRef}
          type="text"
          inputMode="tel"
          value={query}
          size={Math.max(String(query || selected.code || "+971").length, 4)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onBlur={handleBlur}
          onKeyDown={(event) => {
            if (event.key === "Enter" && filteredCountries[0]) {
              event.preventDefault();
              selectCountry(filteredCountries[0].iso);
            }
            if (event.key === "Escape") {
              setOpen(false);
              setQuery(selected.code);
            }
          }}
          placeholder="+971"
          aria-label="Country code"
          aria-expanded={open}
          aria-autocomplete="list"
          autoComplete="off"
          className="w-auto max-w-[7ch] shrink-0 bg-transparent text-sm font-helvetica text-[#919BBA] outline-none placeholder:text-[#919BBA] min-[1025px]:max-w-none min-[1025px]:min-w-0 min-[1025px]:flex-1"
        />
        <ChevronDown className="pointer-events-none h-4 w-4 shrink-0 text-slate-400" />
      </div>

      {open && filteredCountries.length > 0 ? (
        <ul
          role="listbox"
          className="absolute left-0 top-[calc(100%+4px)] z-30 max-h-56 w-[260px] max-w-[80vw] overflow-y-auto rounded-2xl border border-[#d8dbea] bg-white py-1 shadow-[0_16px_40px_rgba(15,23,42,0.12)]"
        >
          {filteredCountries.map((item) => (
            <li
              key={item.iso}
              role="option"
              aria-selected={item.iso === selected.iso}
            >
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectCountry(item.iso)}
                className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-[#f5f6fb] ${
                  item.iso === selected.iso ? "bg-[#f5f6fb]" : ""
                }`}
              >
                <CountryFlag iso={item.iso} />
                <span className="min-w-0 flex-1 truncate text-slate-800">
                  {item.label}
                </span>
                <span className="shrink-0 font-medium text-slate-600">
                  {item.code}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export const AuthPhoneField = forwardRef(function AuthPhoneField(
  {
    label = "Mobile Number",
    countryIso,
    onCountryIsoChange,
    error,
    className = "",
    ...inputProps
  },
  ref,
) {
  return (
    <div>
      <label className="mb-2 hidden text-lg font-helvetica text-slate-800 min-[1025px]:block">
        {label}
      </label>
      <div className="flex items-center rounded-[14px] border border-[#dfe1ec] bg-white transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10 min-[1025px]:gap-2 min-[1025px]:border-0 min-[1025px]:bg-transparent min-[1025px]:focus-within:border-transparent min-[1025px]:focus-within:ring-0">
        <CountryCodePicker
          countryIso={countryIso}
          onCountryIsoChange={onCountryIsoChange}
        />

        <span className="h-5 w-px shrink-0 bg-[#dfe1ec] min-[1025px]:hidden" aria-hidden="true" />

        <div className="relative min-w-0 flex-1">
          <Phone className="pointer-events-none absolute left-3.5 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-slate-400 min-[1025px]:block" />
          <input
            ref={ref}
            type="tel"
            inputMode="tel"
            {...inputProps}
            className={`h-[52px] w-full rounded-[14px] border-0 bg-transparent pl-3 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 min-[1025px]:border min-[1025px]:border-[#dfe1ec] min-[1025px]:bg-white min-[1025px]:pl-11 min-[1025px]:focus:border-brand min-[1025px]:focus:ring-4 min-[1025px]:focus:ring-brand/10 sm:text-base ${className}`.trim()}
          />
        </div>
      </div>
      {error ? <p className="mt-2 text-sm text-red-500">{error}</p> : null}
    </div>
  );
});

export function AuthSocialButton({
  label,
  onClick,
  disabled,
  children,
  active = false,
  className = "",
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-14 items-center justify-center rounded-2xl border bg-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
        active
          ? "border-brand shadow-[0_12px_30px_rgba(49,40,255,0.18)]"
          : "border-[#e4e7f1] hover:border-[#cfd5e6] hover:shadow-sm"
      } ${className}`.trim()}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
}

function NavArrow({ direction = "left" }) {
  const isLeft = direction === "left";

  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={isLeft ? "M19 12H5M11 6l-6 6 6 6" : "M5 12h14M13 6l6 6-6 6"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AuthSidePanel({ quote, quoteAuthor, quoteRole }) {
  const [testimonials, setTestimonials] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await testimonialService.listActiveTestimonials();
        if (cancelled) return;
        const items = res.data?.data || [];
        setTestimonials(
          items.map((item) => ({
            quote: item.testimonial,
            quoteAuthor: item.testimonialName,
            quoteRole:
              CUSTOMER_TYPE_ROLE_LABEL[item.customerType] || "Customer",
          })),
        );
      } catch {
        // Fall back to the static quote passed in via props.
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const slides = testimonials.length
    ? testimonials
    : [{ quote, quoteAuthor, quoteRole }];
  const activeSlide = slides[activeIndex] || slides[0];
  const hasMultipleSlides = slides.length > 1;

  const goToPrevious = () => {
    setActiveIndex((current) => (current - 1 + slides.length) % slides.length);
  };

  const goToNext = () => {
    setActiveIndex((current) => (current + 1) % slides.length);
  };

  const glassMask = `url("data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 630 335" preserveAspectRatio="none"><path fill="white" d="M32 0H598A32 32 0 0 1 630 32V205A32 32 0 0 1 598 237H476A48 48 0 0 0 428 285V303A32 32 0 0 1 396 335H32A32 32 0 0 1 0 303V32A32 32 0 0 1 32 0Z"/></svg>',
  )}")`;

  return (
    <aside className="relative hidden w-full max-w-[800px] min-[1366px]:max-w-[677px] min-h-[min(90dvh,900px)] justify-self-start overflow-hidden rounded-[40px] rounded-br-[0px] bg-[#3520d8] p-6 text-white min-[1025px]:flex min-[1025px]:flex-col">
      <div className="absolute inset-0 z-50 object-cover bg-[linear-gradient(312.92deg,rgba(220,31,255,0.45)_-2.04%,rgba(0,0,255,0.45)_90.02%)]" />
      <video
        className="w-full h-full absolute inset-0 object-cover z-40"
        src="/videos/login_bg.mp4"
        autoPlay
        loop
        muted
        playsInline
      />

      <div className="relative z-50 flex h-full flex-1 flex-col">
        <div className="mx-auto mt-6 flex w-full max-w-[519px] flex-col items-center text-center xl:mt-8">
          <BrandLogo variant="dark" className="h-16 w-auto xl:h-[78px] mb-2" />
          <BuySellWatch className={"max-w-[148px]"} />
        </div>

        <div className="mt-auto w-full max-w-[630px] self-center">
          <div
            className="min-h-[300px] border border-white/10 bg-white/[0.16] px-8 py-9 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md xl:min-h-[335px] xl:px-9 xl:py-10"
            style={{
              WebkitMaskImage: glassMask,
              WebkitMaskSize: "100% 100%",
              WebkitMaskRepeat: "no-repeat",
              maskImage: glassMask,
              maskSize: "100% 100%",
              maskRepeat: "no-repeat",
            }}
          >
            <p className="max-w-[34rem] text-[2rem] font-normal font-helvetica leading-[1.25] text-white xl:text-[clamp(1.875rem,1.125rem+0.9375vw,2.25rem)]">
              {activeSlide.quote}
            </p>
            <div className="mt-10 max-w-[calc(100%-202px)] xl:mt-[clamp(3.125rem,-1.875rem+6.25vw,5.625rem)]">
              <p className="text-[1.25rem] font-medium text-white">
                {activeSlide.quoteAuthor}
              </p>
              <p className="mt-1 text-base font-medium text-[#E1E1E1]">
                {activeSlide.quoteRole}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 right-0 z-50">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 h-10 w-10 -translate-x-full"
          style={{
            background:
              "radial-gradient(circle at 0 0, transparent 39px, #fff 40px)",
          }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-0 h-10 w-10 -translate-y-full"
          style={{
            background:
              "radial-gradient(circle at 0 0, transparent 39px, #fff 40px)",
          }}
        />
        <div className="flex items-center gap-[14px] rounded-tl-[40px] rounded-br-[0px] bg-white pt-5 pr-4 pb-4 pl-4">
          <button
            type="button"
            onClick={goToPrevious}
            disabled={!hasMultipleSlides}
            aria-label="Previous testimonial"
            className="flex h-[62px] w-[74px] items-center justify-center rounded-[24px] text-[#21357C] border border-[#E6E9F5] bg-white text-variant hover:shadow-[0_6px_18px_rgba(0,0,255,0.10)] transition-all hover:bg-[#f8faff] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <NavArrow direction="left" />
          </button>
          <button
            type="button"
            onClick={goToNext}
            disabled={!hasMultipleSlides}
            aria-label="Next testimonial"
            className="flex h-[62px] w-[74px] items-center justify-center rounded-[24px] text-[#21357C] border border-[#E6E9F5] bg-white text-variant hover:shadow-[0_6px_18px_rgba(0,0,255,0.10)] transition-all hover:bg-[#f8faff] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <NavArrow direction="right" />
          </button>
        </div>
      </div>
    </aside>
  );
}

function AuthSplitLayout({
  title,
  subtitle,
  mobileTitle,
  mobileSubtitle,
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
    <div className="min-h-dvh bg-white min-[1025px]:flex min-[1025px]:min-h-screen min-[1025px]:flex-col min-[1025px]:items-center min-[1025px]:justify-center min-[1025px]:px-8 min-[1025px]:py-8">
      <div className="relative flex min-h-[34vh] flex-col items-center justify-center overflow-hidden px-6 pb-16 pt-10 min-[1025px]:hidden">
        <div className="absolute inset-0 bg-[linear-gradient(312.92deg,rgba(220,31,255,0.45)_-2.04%,rgba(0,0,255,0.45)_90.02%)]" />
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src="/videos/login_bg.mp4"
          autoPlay
          loop
          muted
          playsInline
        />
        <div className="relative z-10 flex flex-col items-center text-center">
          <BrandLogo variant="dark" className="mb-2 h-14 w-auto" />
          <BuySellWatch className="max-w-[148px]" />
        </div>
      </div>

      <div className="relative z-10 mx-auto grid w-full -mt-10 rounded-t-[40px] bg-white px-5 pb-8 pt-8 min-[1025px]:mt-0 min-[1025px]:max-w-fit min-[1025px]:grid-cols-[minmax(0,552px)_minmax(0,1fr)] min-[1025px]:gap-0 min-[1366px]:gap-16 min-[1025px]:rounded-none min-[1025px]:bg-transparent min-[1025px]:px-0 min-[1025px]:py-0">
        <section className="mx-auto w-full max-w-[460px] min-[1366px]:max-w-[552px]">
          {modeLabel ? (
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-brand min-[1025px]:mb-6 min-[1025px]:text-sm">
              {modeLabel}
            </p>
          ) : null}
          <div className="mb-6 min-[1025px]:hidden">
            <h1 className="text-[32px] font-medium font-helvetica-neue tracking-tight text-slate-950">
              {mobileTitle || title}
            </h1>
            <p className="mt-2 text-base leading-6 font-helvetica text-[#7A7776]">
              {mobileSubtitle || subtitle}
            </p>
          </div>
          <div className="mb-6 hidden min-[1025px]:mb-8 min-[1025px]:block">
            <h1 className="text-3xl font-medium font-helvetica-neue tracking-tight text-slate-950 sm:text-5xl">
              {title}
            </h1>
            <p className="mt-3 text-sm leading-7 font-helvetica text-[#7A7776] sm:mt-5 sm:text-xl">
              {subtitle}
            </p>
          </div>

          {children}

          {switchTo && switchLabel ? (
            <p className="mt-8 text-center text-sm text-slate-500">
              {switchPrompt ? <>{switchPrompt} </> : null}
              <Link
                to={switchTo}
                onClick={switchOnClick}
                className="inline-flex items-center gap-1 align-middle font-semibold text-brand hover:text-brand-700"
              >
                {switchLabel}
                {switchArrow ? <ArrowRight className="h-4 w-4" /> : null}
              </Link>
            </p>
          ) : null}
        </section>

        <AuthSidePanel
          quote={quote}
          quoteAuthor={quoteAuthor}
          quoteRole={quoteRole}
        />
      </div>
    </div>
  );
}

export default AuthSplitLayout;
