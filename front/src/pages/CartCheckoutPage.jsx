import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api'
import { Calendar, Check, Clock, Gauge, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { cartService, buyerCouponService, checkoutServicePublicService, paymentService } from '@shared/services/api'
import { getMediaUrl } from '@shared/utils/helpers'
import MarketplaceTopBar from '../components/Layout/MarketplaceTopBar'
import MarketplaceLogoBlock from '../components/Layout/MarketplaceLogoBlock'
import { MARKETPLACE_LOGO_CELL } from '../components/Layout/marketplaceLayoutStyles'

// Fixed service fees for the two badges (AED). Kept here so the summary math is
// self-contained; move to config/.env if these ever become dynamic.
const PAY_VIA_PREELLY_FEE = 10
// Pick & Drop "Starts with"/Fix Cost — sourced from api/.env (VITE_PICK_DROP_FEE).
const PICK_DROP_FEE = Number(import.meta.env.VITE_PICK_DROP_FEE) || 29.99
// Additional delivery cost shown in the Pick & Drop popup (dummy value).
const PICK_DROP_DELIVERY_COST = 89.99
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
const MAP_LIBRARIES = ['places']
// Dubai, UAE — default map center when geolocation isn't available.
const DEFAULT_CENTER = { lat: 25.2048, lng: 55.2708 }
const TIME_SLOTS = [
  '09:00 AM - 11:00 AM',
  '11:00 AM - 01:00 PM',
  '01:00 PM - 03:00 PM',
  '03:00 PM - 05:00 PM',
  '05:00 PM - 07:00 PM',
]
// VAT % is sourced from api/.env (VITE_VAT_PERCENTAGE); falls back to 5.
const VAT_PERCENT = Number(import.meta.env.VITE_VAT_PERCENTAGE) || 5
// Charge shown in the Preelly Pay conditions popup (api/.env → VITE_PREELLY_PAY_CHARGE).
const PREELLY_PAY_CHARGE = Number(import.meta.env.VITE_PREELLY_PAY_CHARGE) || 7
const MAX_PREELLY_CONDITIONS = 5
const CURRENCY = 'AED'

// Dummy list of selectable Preelly Pay conditions.
const PREELLY_CONDITIONS = [
  'Odometer reading 1,05,000 KM',
  'Alarm / Anti-Theft System',
  'Sunroof',
  'Make & Model must match the add description',
  'No accident and flooded',
  'Daytime Running Lights (DRL)',
  'GCC Specification',
  'Exterior Colour White',
]

const PAY_PREELLY_FEATURES = [
  'Pick up form your place',
  'Drop to seller place (within 60 km of pickup location radius)',
  'Packaging included',
]
const PICK_DROP_FEATURES = [
  'Pick up form your place',
  'Drop to seller place (within 60 km of pickup location radius)',
  'Packaging included',
]

function money(value) {
  return Number(value ?? 0).toLocaleString('en-AE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

// "2026-07-18" → "18 Jul 2026"
function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Split a geocoded formatted address into two lines: street/building on line 1,
// area/city/country on line 2.
function splitAddress(formatted) {
  const parts = String(formatted || '').split(',').map((s) => s.trim()).filter(Boolean)
  return {
    line1: parts.slice(0, 2).join(', '),
    line2: parts.slice(2).join(', '),
  }
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-sm text-[#1e3a8a]">{label}</span>
      <span className="text-sm font-bold text-[#1e3a8a]">
        {CURRENCY} {money(value)}
      </span>
    </div>
  )
}

// Highlights come from the admin-managed service (array of { highlight }); fall
// back to the built-in bullet list when the service has none.
function serviceHighlights(svc, fallback) {
  const list = (svc?.highlights || [])
    .map((h) => (typeof h === 'string' ? h : h?.highlight))
    .filter(Boolean)
  return list.length ? list : fallback
}

// Which built-in behaviour a service maps to, by its name. "preelly" opens the
// conditions popup, "pick & drop" opens the booking popup, everything else is a
// plain checkbox add-on.
function kindOf(svc) {
  const n = svc?.serviceName?.toLowerCase() || ''
  if (n.includes('preelly')) return 'preelly'
  if (n.includes('pick') && n.includes('drop')) return 'pickdrop'
  return 'simple'
}

// Price label by price type: FIXED → "AED x", STARTING_FROM → "Starts with AED x",
// FREE → "Free".
function priceLabel(svc) {
  if (!svc) return null
  if (svc.priceType === 'FREE') return <span className="font-bold">Free</span>
  const amount = money(svc.price)
  if (svc.priceType === 'STARTING_FROM') {
    return (
      <>Starts with <span className="font-bold">{CURRENCY} {amount}</span></>
    )
  }
  return (
    <>{CURRENCY} <span className="font-bold">{amount}</span></>
  )
}

function LearnMore({ svc }) {
  const label = svc?.buttonText || 'Learn More'
  const url = svc?.learnMoreUrl
  return (
    <button
      type="button"
      onClick={() => (url ? window.open(url, '_blank', 'noopener') : toast('Details coming soon'))}
      className="text-xs font-bold uppercase tracking-wide text-[#2563eb] hover:underline"
    >
      {label}
    </button>
  )
}

// ── "Opt For Preelly Pay" conditions popup ────────────────────────────────────
function PreellyPayModal({ open, initialSelected, initialComment, onClose, onConfirm }) {
  const [selected, setSelected] = useState(initialSelected || [])
  const [comment, setComment] = useState(initialComment || '')

  // Re-seed the modal each time it's (re)opened for editing.
  useEffect(() => {
    if (open) {
      setSelected(initialSelected || [])
      setComment(initialComment || '')
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null

  const toggle = (condition) => {
    setSelected((prev) => {
      if (prev.includes(condition)) return prev.filter((c) => c !== condition)
      if (prev.length >= MAX_PREELLY_CONDITIONS) {
        toast.error(`You can select up to ${MAX_PREELLY_CONDITIONS} options`)
        return prev
      }
      return [...prev, condition]
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="relative flex items-center justify-center border-b border-slate-100 px-6 py-5">
          <h2 className="text-xl font-bold text-slate-900">Opt For Preelly Pay</h2>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-bold text-slate-900">Preelly Pay Conditions</h3>
            <p className="text-sm font-semibold text-[#1e3a8a]">
              Charges <span className="text-base font-bold">{CURRENCY} {money(PREELLY_PAY_CHARGE)}</span>
            </p>
          </div>

          <p className="mt-4 text-sm text-[#1e3a8a]">
            Select Preelly Pay conditions you can select up to {MAX_PREELLY_CONDITIONS} options
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            {PREELLY_CONDITIONS.map((condition) => {
              const active = selected.includes(condition)
              return (
                <button
                  key={condition}
                  type="button"
                  onClick={() => toggle(condition)}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm transition ${
                    active
                      ? 'border-[#c7d2fe] bg-[#e8ecfb] text-slate-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <span>{condition}</span>
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full ${
                      active ? 'bg-green-500 text-white' : 'bg-slate-300 text-white'
                    }`}
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                </button>
              )
            })}
          </div>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Enter comments here"
            rows={5}
            className="mt-6 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/25"
          />
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={() => onConfirm(selected, comment)}
            className="w-full rounded-full bg-[#1414e6] px-6 py-4 text-base font-bold text-white transition hover:bg-[#1010c4]"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Draggable-pin Google Map for the drop location ────────────────────────────
function PickDropMap({ position, onChange }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'preelly-google-maps',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: MAP_LIBRARIES,
  })
  const geocoderRef = useRef(null)

  // Google reverse geocode → formatted address string, or null on failure
  // (e.g. the Geocoding API isn't enabled on the key).
  const geocodeGoogle = useCallback(
    (next) =>
      new Promise((resolve) => {
        if (!geocoderRef.current) return resolve(null)
        geocoderRef.current.geocode({ location: next }, (results, status) => {
          resolve(status === 'OK' && results?.[0] ? results[0].formatted_address : null)
        })
      }),
    []
  )

  // Report the pin's address for a position. Try Google first; if reverse
  // geocoding isn't available, fall back to OpenStreetMap's free Nominatim
  // service (no key), and only then to raw coordinates.
  const reportPosition = useCallback(
    async (next) => {
      const googleAddress = await geocodeGoogle(next)
      if (googleAddress) return onChange(next, googleAddress)

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=en&lat=${next.lat}&lon=${next.lng}`,
          { headers: { Accept: 'application/json' } }
        )
        const data = await res.json()
        if (data?.display_name) return onChange(next, data.display_name)
      } catch {
        /* ignore — fall through to coordinates */
      }

      onChange(next, `Lat ${next.lat.toFixed(6)}, Lng ${next.lng.toFixed(6)}`)
    },
    [geocodeGoogle, onChange]
  )

  const onMapLoad = useCallback(() => {
    geocoderRef.current = new window.google.maps.Geocoder()
    // Resolve an address for wherever the pin starts.
    reportPosition(position)
  }, [position, reportPosition])

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <p className="text-sm text-yellow-800">
          Map unavailable: set VITE_GOOGLE_MAPS_API_KEY in api/.env.
        </p>
      </div>
    )
  }
  if (loadError) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <p className="text-sm text-yellow-800">Failed to load Google Maps.</p>
      </div>
    )
  }

  const mapContainerStyle = { width: '100%', height: '260px', borderRadius: '0.75rem' }

  return isLoaded ? (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={position}
      zoom={15}
      onLoad={onMapLoad}
      options={{
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      }}
    >
      <MarkerF
        position={position}
        draggable
        onDragEnd={(e) => reportPosition({ lat: e.latLng.lat(), lng: e.latLng.lng() })}
      />
    </GoogleMap>
  ) : (
    <div className="animate-pulse rounded-xl bg-gray-100" style={{ height: 260 }} />
  )
}

// ── "Pick & Drop Service" popup (date/time, drop location, cost breakdown) ─────
function PickDropModal({ open, initial, fixCost = PICK_DROP_FEE, onClose, onConfirm }) {
  const todayIso = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(initial?.date || todayIso)
  const [timeSlot, setTimeSlot] = useState(initial?.timeSlot || '')
  const [addr1, setAddr1] = useState(initial?.addr1 || '')
  const [addr2, setAddr2] = useState(initial?.addr2 || '')
  const [position, setPosition] = useState(initial?.location || DEFAULT_CENTER)
  const [address, setAddress] = useState(initial?.address || '')

  useEffect(() => {
    if (open) {
      setDate(initial?.date || todayIso)
      setTimeSlot(initial?.timeSlot || '')
      setAddr1(initial?.addr1 || '')
      setAddr2(initial?.addr2 || '')
      setPosition(initial?.location || DEFAULT_CENTER)
      setAddress(initial?.address || '')
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleMapChange = useCallback((next, formatted) => {
    setPosition(next)
    if (formatted) {
      setAddress(formatted)
      // Keep the address fields in sync with the pin.
      const { line1, line2 } = splitAddress(formatted)
      setAddr1(line1)
      setAddr2(line2)
    }
  }, [])

  if (!open) return null

  const total = round2(fixCost + PICK_DROP_DELIVERY_COST)

  const handleConfirm = () => {
    if (!date) { toast.error('Please select a date'); return }
    if (!timeSlot) { toast.error('Please select a time slot'); return }
    onConfirm({ date, timeSlot, addr1, addr2, location: position, address, total })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="relative flex items-center justify-center border-b border-slate-100 px-6 py-5">
          <h2 className="text-xl font-bold text-slate-900">Opt For Preelly Pay</h2>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-bold text-slate-900">Pick &amp; Drop Service</h3>
            <p className="text-sm text-[#1e3a8a]">
              Starts with AED <span className="text-base font-bold">{money(fixCost)}</span>
            </p>
          </div>

          <hr className="my-4 border-slate-200" />

          {/* Confirm Time */}
          <h4 className="text-lg font-bold text-slate-900">Confirm Time</h4>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-[#1e3a8a]">Select Date*</label>
              <div className="relative mt-1.5">
                <input
                  type="date"
                  value={date}
                  min={todayIso}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/25"
                />
                <Calendar className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-[#1e3a8a]">Select Time*</label>
              <div className="relative mt-1.5">
                <select
                  value={timeSlot}
                  onChange={(e) => setTimeSlot(e.target.value)}
                  className={`w-full appearance-none rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]/25 ${
                    timeSlot ? 'text-slate-900' : 'text-slate-400'
                  }`}
                >
                  <option value="">Select time slot</option>
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot} value={slot} className="text-slate-900">{slot}</option>
                  ))}
                </select>
                <Clock className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              </div>
            </div>
          </div>

          {/* Confirm Drop Location */}
          <h4 className="mt-6 text-lg font-bold text-slate-900">Confirm Drop Location</h4>
          <div className="mt-3 rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-900">Is the pin in the right location?</p>
            <p className="mt-1 text-sm text-slate-600">
              Click and drag the pin to the exact spot of your product location
            </p>
            <div className="mt-4">
              <PickDropMap position={position} onChange={handleMapChange} />
            </div>
            {address && (
              <p className="mt-3 rounded-lg bg-[#f5f8ff] px-4 py-2.5 text-sm text-slate-700">
                {address}
              </p>
            )}
          </div>

          {/* Address lines */}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-[#1e3a8a]">Address Line 1</label>
              <input
                type="text"
                value={addr1}
                onChange={(e) => setAddr1(e.target.value)}
                placeholder="Building or Street name"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/25"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#1e3a8a]">Address Line 2</label>
              <input
                type="text"
                value={addr2}
                onChange={(e) => setAddr2(e.target.value)}
                placeholder="Building or Street name"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/25"
              />
            </div>
          </div>

          {/* Cost breakdown */}
          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-base font-medium text-[#1e3a8a]">Fix Cost</span>
              <span className="text-base font-bold text-[#1e3a8a]">AED {money(fixCost)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-base font-medium text-[#1e3a8a]">Pick &amp; Drop cost</span>
              <span className="text-base font-bold text-[#1e3a8a]">AED {money(PICK_DROP_DELIVERY_COST)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-base font-medium text-[#1e3a8a]">Total</span>
              <span className="text-base font-bold text-[#1e3a8a]">AED {money(total)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full rounded-full bg-[#1414e6] px-6 py-4 text-base font-bold text-white transition hover:bg-[#1010c4]"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

function CartCheckoutPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const productId = searchParams.get('productId') || ''

  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [services, setServices] = useState([])

  const [payPreelly, setPayPreelly] = useState(false)
  const [pickDrop, setPickDrop] = useState(false)

  // Preelly Pay conditions popup + the user's selections.
  const [preellyModalOpen, setPreellyModalOpen] = useState(false)
  const [preellyConditions, setPreellyConditions] = useState([])
  const [preellyComment, setPreellyComment] = useState('')

  // Ticking "Pay Through Preelly" opens the conditions popup; unticking clears it.
  const handleTogglePayPreelly = (checked) => {
    if (checked) {
      setPreellyModalOpen(true)
    } else {
      setPayPreelly(false)
      setPreellyConditions([])
      setPreellyComment('')
    }
  }

  const handleConfirmPreelly = (conditions, comment) => {
    setPreellyConditions(conditions)
    setPreellyComment(comment)
    setPayPreelly(true)
    setPreellyModalOpen(false)
  }

  // Pick & Drop popup + the confirmed booking details.
  const [pickDropModalOpen, setPickDropModalOpen] = useState(false)
  const [pickDropInfo, setPickDropInfo] = useState(null)

  const handleTogglePickDrop = (checked) => {
    if (checked) {
      setPickDropModalOpen(true)
    } else {
      setPickDrop(false)
      setPickDropInfo(null)
    }
  }

  const handleConfirmPickDrop = (info) => {
    setPickDropInfo(info)
    setPickDrop(true)
    setPickDropModalOpen(false)
  }

  // Plain add-on services (anything that isn't Preelly Pay / Pick & Drop) are just
  // toggled on/off by id.
  const [simpleSelected, setSimpleSelected] = useState(() => new Set())
  const toggleSimple = (id, checked) => {
    setSimpleSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const [showDiscount, setShowDiscount] = useState(false)
  const [discountCode, setDiscountCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [couponError, setCouponError] = useState('')
  const [applyingCoupon, setApplyingCoupon] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        // Cart item + the admin-managed active checkout services (add-on cards).
        const [cartRes, servicesRes] = await Promise.all([
          cartService.getCart(),
          checkoutServicePublicService.listActiveCheckoutServices().catch(() => null),
        ])
        if (cancelled) return
        const items = cartRes?.data?.data || []
        const picked = productId
          ? items.find((i) => String(i.productId?._id || i.productId) === productId)
          : items[0]
        setItem(picked || null)
        setServices(servicesRes?.data?.data || [])
      } catch {
        if (!cancelled) toast.error('Failed to load cart')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [productId])

  const product = item?.productId && typeof item.productId === 'object' ? item.productId : null
  const listingPrice = Number(item?.unitPrice ?? product?.productPrice ?? product?.price ?? 0)
  const categoryLabel =
    product?.subcategory?.name || product?.category?.name || product?.condition || ''
  const imgSrc = useMemo(() => {
    if (!product) return null
    if (product.images?.length) return getMediaUrl(product.images[0]) || product.images[0]
    if (product.video) return getMediaUrl(product.video) || null
    return null
  }, [product])

  // Map the two known add-ons to their admin-managed checkout services (by name),
  // so name/price/highlights/Learn More come from the DB. Falls back to defaults
  // when the admin hasn't created them yet.
  const preellyService = useMemo(
    () => services.find((s) => s.serviceName?.toLowerCase().includes('preelly')) || null,
    [services]
  )
  const pickDropService = useMemo(
    () =>
      services.find((s) => {
        const n = s.serviceName?.toLowerCase() || ''
        return n.includes('pick') && n.includes('drop')
      }) || null,
    [services]
  )

  const payPreellyFeeAmount = Number(preellyService?.price ?? PAY_VIA_PREELLY_FEE)
  const pickDropFixCost = Number(pickDropService?.price ?? PICK_DROP_FEE)

  // Is a service currently selected?
  const isServiceSelected = (svc) => {
    const kind = kindOf(svc)
    if (kind === 'preelly') return payPreelly
    if (kind === 'pickdrop') return pickDrop
    return simpleSelected.has(svc.id)
  }

  // The amount a selected service contributes to the order.
  const serviceFee = (svc) => {
    const kind = kindOf(svc)
    if (kind === 'preelly') return payPreellyFeeAmount
    if (kind === 'pickdrop') return Number(pickDropInfo?.total ?? pickDropFixCost)
    return svc.priceType === 'FREE' ? 0 : Number(svc.price ?? 0)
  }

  // Rows for the order summary — one per selected service.
  const selectedServiceRows = useMemo(
    () =>
      services
        .filter(isServiceSelected)
        .map((svc) => ({ id: svc.id, name: svc.serviceName, fee: round2(serviceFee(svc)) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [services, payPreelly, pickDrop, pickDropInfo, simpleSelected, payPreellyFeeAmount, pickDropFixCost]
  )

  // Order summary — recomputed as add-ons / coupon change.
  const totals = useMemo(() => {
    const productFee = round2(listingPrice) // the agreed product amount
    const addonsTotal = selectedServiceRows.reduce((sum, r) => sum + r.fee, 0)

    const base = round2(productFee + addonsTotal)
    // Buyer coupons discount ONLY the checkout-service charges — never the product,
    // so the discount is capped at the add-ons total.
    const discountAmount = Math.min(Number(appliedCoupon?.discountAmount ?? 0), round2(addonsTotal))
    const taxableBase = round2(base - discountAmount)
    const vatValue = round2((taxableBase * VAT_PERCENT) / 100)

    return {
      productFee,
      addonsTotal: round2(addonsTotal),
      base,
      discountAmount: round2(discountAmount),
      vatValue,
      total: round2(taxableBase + vatValue),
    }
  }, [listingPrice, selectedServiceRows, appliedCoupon])

  const handleApplyDiscount = async () => {
    const code = discountCode.trim().toUpperCase()
    if (!code) return
    setCouponError('')
    // Buyer coupons apply to checkout services only — need at least one selected.
    if (!selectedServiceRows.length) {
      const message = 'Select a checkout service before applying a coupon'
      setCouponError(message)
      toast.error(message)
      return
    }
    try {
      setApplyingCoupon(true)
      const res = await buyerCouponService.validate({
        couponCode: code,
        services: selectedServiceRows.map((r) => ({ checkoutServiceId: r.id, amount: r.fee })),
      })
      setAppliedCoupon(res.data?.data)
      toast.success(res.data?.data?.message || 'Coupon applied')
    } catch (err) {
      const message = err.response?.data?.message || 'This coupon could not be applied'
      setAppliedCoupon(null)
      setCouponError(message)
      toast.error(message)
    } finally {
      setApplyingCoupon(false)
    }
  }

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null)
    setCouponError('')
    setDiscountCode('')
  }

  const [paying, setPaying] = useState(false)

  // Builds a hidden form and POSTs to CCAvenue — a full-page nav, as the gateway requires.
  const redirectToGateway = ({ paymentUrl, accessCode, encRequest }) => {
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = paymentUrl
    const fields = { encRequest, access_code: accessCode }
    Object.entries(fields).forEach(([name, value]) => {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = name
      input.value = value
      form.appendChild(input)
    })
    document.body.appendChild(form)
    form.submit()
  }

  const handleCheckout = async () => {
    if (totals.total <= 0) {
      toast.error('Select at least one service to continue')
      return
    }
    try {
      setPaying(true)
      const res = await paymentService.initiateCheckout({
        productId: product?._id || item?.productId?._id || item?.productId,
        services: selectedServiceRows.map((r) => ({ checkoutServiceId: r.id, amount: r.fee })),
        couponCode: appliedCoupon?.couponCode || null,
        // The rest of the checkout-page data, snapshotted onto the transaction.
        pickDrop: pickDropInfo || null,
        preelly: payPreelly ? { conditions: preellyConditions, comment: preellyComment } : null,
      })
      const data = res.data?.data
      if (!data?.paymentUrl || !data?.encRequest) throw new Error('Invalid payment session')
      redirectToGateway(data)
      // No setPaying(false): the page is navigating to the gateway.
    } catch (err) {
      setPaying(false)
      toast.error(err.response?.data?.message || err.message || 'Could not start payment')
    }
  }

  // ── Per-service card renderers (dispatched by kind in the add-ons list) ──────
  const cardShell = (svc, header, body) => (
    <div key={svc.id} className="rounded-xl border border-[#c7d2fe] bg-[#f5f8ff] p-5">
      {header}
      <hr className="my-4 border-slate-200" />
      {body}
    </div>
  )

  const cardHeader = (svc, checked, onToggle, price) => (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
          className="h-5 w-5 rounded border-2 border-[#2563eb] text-[#2563eb] focus:ring-[#2563eb]"
        />
        <span className="text-lg font-bold text-slate-900">{svc.serviceName}</span>
      </span>
      <span className="shrink-0 text-lg text-[#1e3a8a]">{price}</span>
    </label>
  )

  const defaultBody = (svc, fallback) => (
    <>
      <ul className="list-inside list-disc space-y-2 text-sm text-[#1e3a8a]">
        {serviceHighlights(svc, fallback).map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <div className="mt-4 text-right">
        <LearnMore svc={svc} />
      </div>
    </>
  )

  const renderPreellyCard = (svc) =>
    cardShell(
      svc,
      cardHeader(svc, payPreelly, handleTogglePayPreelly, <span className="font-bold">{CURRENCY} {money(payPreellyFeeAmount)}</span>),
      payPreelly && preellyConditions.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-3">
            {preellyConditions.map((condition) => (
              <span
                key={condition}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                {condition}
              </span>
            ))}
          </div>
          <div className="mt-4 text-right">
            <button
              type="button"
              onClick={() => setPreellyModalOpen(true)}
              className="text-xs font-bold uppercase tracking-wide text-[#2563eb] hover:underline"
            >
              Edit
            </button>
          </div>
        </>
      ) : (
        defaultBody(svc, PAY_PREELLY_FEATURES)
      )
    )

  const renderPickDropCard = (svc) =>
    cardShell(
      svc,
      cardHeader(
        svc,
        pickDrop,
        handleTogglePickDrop,
        pickDrop && pickDropInfo ? (
          <span className="text-sm">AED <span className="text-lg font-bold">{money(pickDropFixCost)}</span></span>
        ) : (
          <span className="text-sm">{priceLabel(svc) || <>Starts with <span className="font-bold">{CURRENCY} {money(pickDropFixCost)}</span></>}</span>
        )
      ),
      pickDrop && pickDropInfo ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-[#1e3a8a]">Select Date*</p>
              <div className="mt-1.5 flex items-center justify-between gap-2 rounded-xl bg-[#e8e8ea] px-4 py-3">
                <span className="text-sm text-slate-900">{formatDate(pickDropInfo.date)}</span>
                <Calendar className="h-5 w-5 text-slate-700" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-[#1e3a8a]">Select Time*</p>
              <div className="mt-1.5 flex items-center justify-between gap-2 rounded-xl bg-[#e8e8ea] px-4 py-3">
                <span className="text-sm text-slate-900">{pickDropInfo.timeSlot}</span>
                <Clock className="h-5 w-5 text-slate-700" />
              </div>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium text-[#1e3a8a]">Address</p>
            <div className="mt-1.5 rounded-xl bg-[#e8e8ea] px-4 py-3">
              <span className="text-sm text-slate-900">
                {[pickDropInfo.addr1, pickDropInfo.addr2].filter(Boolean).join(', ') || pickDropInfo.address}
              </span>
            </div>
          </div>
          <div className="mt-4 text-right">
            <button
              type="button"
              onClick={() => setPickDropModalOpen(true)}
              className="text-xs font-bold uppercase tracking-wide text-[#2563eb] hover:underline"
            >
              Edit
            </button>
          </div>
        </>
      ) : (
        defaultBody(svc, PICK_DROP_FEATURES)
      )
    )

  const renderSimpleCard = (svc) =>
    cardShell(
      svc,
      cardHeader(svc, simpleSelected.has(svc.id), (checked) => toggleSimple(svc.id, checked), priceLabel(svc)),
      defaultBody(svc, [])
    )

  const renderServiceCard = (svc) => {
    const kind = kindOf(svc)
    if (kind === 'preelly') return renderPreellyCard(svc)
    if (kind === 'pickdrop') return renderPickDropCard(svc)
    return renderSimpleCard(svc)
  }

  // Same header as the home page: logo block on the left, marketplace top bar
  // (search + nav + user) filling the rest.
  const topBar = (
    <div className="grid grid-cols-1 lg:grid-cols-[270px_minmax(0,1fr)]">
      <div className={MARKETPLACE_LOGO_CELL}>
        <MarketplaceLogoBlock />
      </div>
      <MarketplaceTopBar topBarColSpan="" onToggleMobileMenu={() => navigate('/')} />
    </div>
  )

  if (loading) {
    return (
      <>
        {topBar}
        <p className="py-24 text-center text-sm text-slate-500">Loading cart…</p>
      </>
    )
  }
  if (!item || !product) {
    return (
      <>
        {topBar}
        <div className="mx-auto w-full max-w-6xl px-4 py-24 text-center">
          <p className="text-lg font-semibold text-slate-700">Your cart is empty</p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-4 rounded-full bg-[#1414e6] px-6 py-3 text-sm font-bold text-white hover:bg-[#1010c4]"
          >
            Continue shopping
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      {topBar}
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <h1 className="mb-8 text-center text-3xl font-semibold text-slate-900 sm:text-4xl">
        Secure Checkout
      </h1>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ── Left: listing + add-ons ─────────────────────────────────── */}
        <div>
          <div className="flex items-stretch gap-4 rounded-xl border border-slate-200 p-3">
            {imgSrc ? (
              <img src={imgSrc} alt={product.title} className="h-24 w-32 shrink-0 rounded-lg object-cover" />
            ) : (
              <div className="h-24 w-32 shrink-0 rounded-lg bg-slate-100" />
            )}

            <div className="flex min-w-0 flex-1 flex-col justify-center">
              <h2 className="truncate text-lg font-bold text-slate-900">{product.title}</h2>
              {categoryLabel && <p className="mt-0.5 text-sm text-slate-600">{categoryLabel}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                {product.year && (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" aria-hidden /> {product.year}
                  </span>
                )}
                {(product.kilometers ?? product.mileage) != null && (
                  <span className="inline-flex items-center gap-1.5">
                    <Gauge className="h-4 w-4" aria-hidden />{' '}
                    {Number(product.kilometers ?? product.mileage).toLocaleString()} km
                  </span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-end">
              <span className="text-xs font-bold text-[#1e3a8a]">AED </span>
              <span className="ml-1 text-2xl font-bold text-[#1e3a8a]">
                {listingPrice.toLocaleString()}
              </span>
            </div>
          </div>

          <h3 className="mt-8 text-xl font-semibold text-[#1e3a8a]">
            Make your ad stand out unique badges
          </h3>

          <div className="mt-4 space-y-5">
            {services.length > 0 ? (
              services.map(renderServiceCard)
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">
                No checkout services are available right now.
              </p>
            )}
          </div>
        </div>

        {/* ── Right: order summary ────────────────────────────────────── */}
        <aside>
          <h3 className="text-xl font-bold text-[#1e3a8a]">Order Summary</h3>

          <div className="mt-4">
            <SummaryRow label="Product" value={totals.productFee} />
            {selectedServiceRows.map((row) => (
              <SummaryRow key={row.id} label={row.name} value={row.fee} />
            ))}
            {totals.discountAmount > 0 && (
              <div className="flex items-center justify-between gap-4 py-1.5">
                <span className="text-sm text-emerald-700">Discount ({appliedCoupon?.couponCode})</span>
                <span className="text-sm font-bold text-emerald-700">
                  − {CURRENCY} {money(totals.discountAmount)}
                </span>
              </div>
            )}
            <SummaryRow label={`VAT ${VAT_PERCENT}%`} value={totals.vatValue} />
          </div>

          <div className="mt-4">
            {appliedCoupon ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-emerald-800">
                    {appliedCoupon.couponCode} applied
                  </p>
                  <p className="truncate text-xs text-emerald-700">
                    You saved {CURRENCY} {money(totals.discountAmount)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveCoupon}
                  className="shrink-0 rounded-full p-1.5 text-emerald-700 hover:bg-emerald-100"
                  aria-label="Remove coupon"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : !showDiscount ? (
              <button
                type="button"
                onClick={() => setShowDiscount(true)}
                className="text-sm font-semibold text-[#2563eb] hover:underline"
              >
                Apply Discount Code
              </button>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={discountCode}
                    onChange={(e) => {
                      setDiscountCode(e.target.value.toUpperCase())
                      if (couponError) setCouponError('')
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); handleApplyDiscount() }
                    }}
                    placeholder="Discount code"
                    className={`min-w-0 flex-1 rounded-xl bg-[#eef0f6] px-4 py-3 text-sm uppercase text-slate-900 placeholder:normal-case placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                      couponError ? 'ring-2 ring-red-400' : 'focus:ring-[#2563eb]/25'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={handleApplyDiscount}
                    disabled={!discountCode.trim() || applyingCoupon}
                    className="shrink-0 rounded-full bg-slate-300 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {applyingCoupon ? 'Checking…' : 'Apply'}
                  </button>
                </div>
                {couponError && (
                  <p className="mt-2 text-xs font-medium text-red-600" role="alert">{couponError}</p>
                )}
              </>
            )}
          </div>

          <hr className="my-5 border-slate-200" />

          <div className="flex items-center justify-between gap-4">
            <span className="text-lg font-bold text-[#1e3a8a]">Total</span>
            <span className="text-lg font-bold text-[#1e3a8a]">
              {CURRENCY} {money(totals.total)}
            </span>
          </div>

          <button
            type="button"
            onClick={handleCheckout}
            disabled={paying}
            className="mt-8 w-full rounded-full bg-[#1414e6] px-6 py-4 text-base font-bold text-white transition hover:bg-[#1010c4] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {paying ? 'Redirecting to payment…' : `Pay ${CURRENCY} ${money(totals.total)}`}
          </button>
        </aside>
      </div>

      <PreellyPayModal
        open={preellyModalOpen}
        initialSelected={preellyConditions}
        initialComment={preellyComment}
        onClose={() => setPreellyModalOpen(false)}
        onConfirm={handleConfirmPreelly}
      />

      <PickDropModal
        open={pickDropModalOpen}
        initial={pickDropInfo}
        fixCost={pickDropFixCost}
        onClose={() => setPickDropModalOpen(false)}
        onConfirm={handleConfirmPickDrop}
      />
      </div>
    </>
  )
}

export default CartCheckoutPage
