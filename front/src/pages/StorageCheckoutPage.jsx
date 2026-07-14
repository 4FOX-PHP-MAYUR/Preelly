import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Calendar, Gauge, Info, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { checkoutService, storageFacilityService, couponService } from '@shared/services/api'
import { getMediaUrl } from '@shared/utils/helpers'
import { PostAdListingBreadcrumb } from '../components/PostAd/PostAdListingBreadcrumb'

// Shown before the add-on is ticked.
const STORAGE_FEATURES = [
  'Pick up form your place',
  'Drop to seller place (within 60 km of pickup location radius)',
  'Packaging included',
]
// Shown once it's ticked, above the duration tabs.
const STORAGE_BLURB = 'We pick up, store, and hand over your item. Packaging included.'

function money(value) {
  return Number(value ?? 0).toLocaleString('en-AE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Mirrors core/services/checkoutService.js — the server stays authoritative at payment. */
function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

function SummaryRow({ label, value, currency }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-sm text-[#1e3a8a]">{label}</span>
      <span className="text-sm font-bold text-[#1e3a8a]">
        {currency} {money(value)}
      </span>
    </div>
  )
}

function StorageCheckoutPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const productId = searchParams.get('productId') || ''
  const packageId = searchParams.get('packageId') || ''
  const breadcrumbItems = useMemo(() => location.state?.breadcrumbItems || [], [location.state])

  const [data, setData] = useState(null)
  const [facilities, setFacilities] = useState([])
  const [loading, setLoading] = useState(true)
  const [withStorage, setWithStorage] = useState(false)
  const [selectedFacilityId, setSelectedFacilityId] = useState('')
  const [discountCode, setDiscountCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [couponError, setCouponError] = useState('')
  const [applyingCoupon, setApplyingCoupon] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const [summaryRes, facilitiesRes] = await Promise.all([
          checkoutService.getSummary({ productId, packageId }),
          storageFacilityService.listActiveStorageFacilities(),
        ])
        if (cancelled) return
        setData(summaryRes.data?.data || null)
        setFacilities(facilitiesRes.data?.data || [])
      } catch (err) {
        if (!cancelled) {
          toast.error(err.response?.data?.message || 'Failed to load checkout')
          navigate('/dashboard')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (!productId) {
      toast.error('Missing listing reference')
      navigate('/dashboard')
      return
    }
    load()
    return () => { cancelled = true }
  }, [productId, packageId, navigate])

  const handleToggleStorage = (checked) => {
    setWithStorage(checked)
    // Opening the add-on pre-selects the first duration so a price always shows.
    if (checked && !selectedFacilityId && facilities.length > 0) {
      setSelectedFacilityId(facilities[0].id)
    }
  }

  const selectedFacility = useMemo(
    () => facilities.find((f) => f.id === selectedFacilityId) || null,
    [facilities, selectedFacilityId]
  )

  // Recomputed as the add-on/duration/coupon changes, from the server's unit amounts.
  const totals = useMemo(() => {
    if (!data) return null
    const active = withStorage && selectedFacility
    const fixedCost = data.storageFacility.fixedCost
    const durationCost = active ? Number(selectedFacility.facilityAmount ?? 0) : 0
    const storageAmount = active ? round2(fixedCost + durationCost) : 0

    const packageAmount = data.summary.packageAmount
    const vatPercentage = data.summary.vatPercentage

    // The coupon is validated against the pre-VAT base; VAT is then charged on
    // what's actually payable after the discount.
    const base = round2(packageAmount + storageAmount)
    const discountAmount = Math.min(Number(appliedCoupon?.discountAmount ?? 0), base)
    const taxableBase = round2(base - discountAmount)
    const vatValue = round2((taxableBase * vatPercentage) / 100)

    return {
      currency: data.summary.currency,
      packageAmount,
      fixedCost,
      durationCost,
      storageAmount,
      base,
      discountAmount: round2(discountAmount),
      vatPercentage,
      vatValue,
      total: round2(taxableBase + vatValue),
    }
  }, [data, withStorage, selectedFacility, appliedCoupon])

  /** Runs a code past the server. Returns the applied coupon, or throws with the reason. */
  const runCouponValidation = async (code, orderAmount) => {
    const res = await couponService.validate({
      couponCode: code,
      orderAmount,
      packageId: packageId || data?.package?.id,
      ...(withStorage && selectedFacilityId ? { storageFacilityId: selectedFacilityId } : {}),
      categoryIds: [data?.product?.categoryId, data?.product?.subcategoryId].filter(Boolean),
    })
    return res.data?.data
  }

  const handleApplyDiscount = async () => {
    const code = discountCode.trim().toUpperCase()
    if (!code || !totals) return

    setCouponError('')
    try {
      setApplyingCoupon(true)
      const result = await runCouponValidation(code, totals.base)
      setAppliedCoupon(result)
      toast.success(result?.message || 'Coupon applied')
    } catch (err) {
      // The API returns the exact reason (expired, limit reached, not applicable…).
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

  // Changing the storage add-on changes the order amount and what the coupon applies
  // to — so an already-applied coupon has to be re-checked rather than left to ride
  // on a stale discount (it may now fail a minimum-order or applicability rule).
  const appliedCode = appliedCoupon?.couponCode
  const currentBase = totals?.base
  useEffect(() => {
    if (!appliedCode || currentBase == null) return
    let cancelled = false
    const revalidate = async () => {
      try {
        const result = await runCouponValidation(appliedCode, currentBase)
        if (!cancelled) setAppliedCoupon(result)
      } catch (err) {
        if (cancelled) return
        const message = err.response?.data?.message || 'This coupon no longer applies'
        setAppliedCoupon(null)
        setCouponError(message)
        toast.error(`Coupon removed — ${message}`)
      }
    }
    revalidate()
    return () => { cancelled = true }
    // Deliberately keyed on the code + base only: re-running on `appliedCoupon`
    // itself would loop, since a successful re-check replaces that object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedCode, currentBase, withStorage, selectedFacilityId])

  const handlePay = () => {
    toast.error('Payment gateway is not connected yet')
  }

  if (loading) {
    return <p className="py-24 text-center text-sm text-slate-500">Loading checkout…</p>
  }
  if (!data || !totals) return null

  const { product, package: pkg } = data
  const imgSrc = product.image ? getMediaUrl(product.image) || product.image : null

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <h1 className="mb-6 text-center text-3xl font-semibold text-slate-900 sm:mb-8 sm:text-4xl">
        Secure Checkout
      </h1>

      <PostAdListingBreadcrumb items={breadcrumbItems} />

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
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
              {product.categoryName && (
                <p className="mt-0.5 text-sm text-slate-600">{product.categoryName}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                {product.year && (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" aria-hidden /> {product.year}
                  </span>
                )}
                {product.kilometers != null && (
                  <span className="inline-flex items-center gap-1.5">
                    <Gauge className="h-4 w-4" aria-hidden /> {Number(product.kilometers).toLocaleString()} km
                  </span>
                )}
              </div>
            </div>

            {/* Listing price — shown for context; the seller is charged for the package. */}
            <div className="flex shrink-0 items-end">
              <span className="text-xs font-bold text-[#1e3a8a]">AED </span>
              <span className="ml-1 text-2xl font-bold text-[#1e3a8a]">
                {Number(product.listingPrice ?? 0).toLocaleString()}
              </span>
            </div>
          </div>

          <h3 className="mt-8 text-xl font-semibold text-[#1e3a8a]">
            Make your ad stand out unique badges
          </h3>

          <div className="mt-4 rounded-xl bg-[#f5f8ff] p-5">
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <span className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={withStorage}
                  onChange={(e) => handleToggleStorage(e.target.checked)}
                  className="h-5 w-5 rounded border-2 border-[#2563eb] text-[#2563eb] focus:ring-[#2563eb]"
                />
                <span className="text-lg font-bold text-slate-900">Storage Facility</span>
              </span>
              <span className="shrink-0">
                <span className="text-xs font-bold text-[#1e3a8a]">AED </span>
                <span className="text-lg font-bold text-[#1e3a8a]">{money(totals.fixedCost)}</span>
              </span>
            </label>

            <hr className="my-4 border-slate-200" />

            {!withStorage ? (
              <>
                <ul className="list-inside list-disc space-y-2 text-sm text-[#1e3a8a]">
                  {STORAGE_FEATURES.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <div className="mt-4 text-right">
                  <button
                    type="button"
                    onClick={() => toast('Storage Facility details coming soon')}
                    className="text-xs font-bold uppercase tracking-wide text-[#2563eb] hover:underline"
                  >
                    Learn More
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-[#1e3a8a]">{STORAGE_BLURB}</p>

                {facilities.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">
                    No storage durations are available right now.
                  </p>
                ) : (
                  <>
                    {/* Duration tabs — sourced from the `storagefacilities` table */}
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {facilities.map((facility) => {
                        const active = facility.id === selectedFacilityId
                        return (
                          <button
                            key={facility.id}
                            type="button"
                            onClick={() => setSelectedFacilityId(facility.id)}
                            aria-pressed={active}
                            className={`rounded-xl border px-3 py-3 text-center transition ${
                              active
                                ? 'border-[#1414e6] bg-[#1414e6] text-white'
                                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                            }`}
                          >
                            <span className={`block text-xs ${active ? 'text-white/80' : 'text-slate-400'}`}>
                              {facility.facilityWeek}
                            </span>
                            <span className="mt-1 block text-base font-bold">
                              {money(facility.facilityAmount)}
                            </span>
                          </button>
                        )
                      })}
                    </div>

                    {/* Cost breakdown */}
                    <div className="mt-5 space-y-2">
                      <div className="flex items-center justify-between gap-4">
                        <span className="inline-flex items-center gap-1.5 text-sm text-[#1e3a8a]">
                          Fix Cost
                          <span
                            title="A one-off pickup, handling and packaging charge, added on top of the storage duration."
                            className="inline-flex"
                          >
                            <Info className="h-4 w-4 text-slate-400" aria-hidden />
                          </span>
                        </span>
                        <span className="text-sm text-[#1e3a8a]">
                          {totals.currency} {money(totals.fixedCost)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-[#1e3a8a]">
                          Storage Cost{' '}
                          {selectedFacility && (
                            <span className="font-bold">({selectedFacility.facilityWeek})</span>
                          )}
                        </span>
                        <span className="text-sm text-[#1e3a8a]">
                          {totals.currency} {money(totals.durationCost)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-4 pt-1">
                        <span className="text-base font-bold text-[#1e3a8a]">Total</span>
                        <span className="text-base font-bold text-[#1e3a8a]">
                          {totals.currency} {money(totals.storageAmount)}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Right: order summary ────────────────────────────────────── */}
        <aside>
          <h3 className="text-xl font-bold text-[#1e3a8a]">Order Summary</h3>

          <div className="mt-4">
            <SummaryRow
              label={`Product${pkg.packageName ? ` (${pkg.packageName})` : ''}`}
              value={totals.packageAmount}
              currency={totals.currency}
            />
            {totals.storageAmount > 0 && (
              <SummaryRow label="Storage Facility" value={totals.storageAmount} currency={totals.currency} />
            )}
            {totals.discountAmount > 0 && (
              <div className="flex items-center justify-between gap-4 py-1.5">
                <span className="text-sm text-emerald-700">
                  Discount ({appliedCoupon?.couponCode})
                </span>
                <span className="text-sm font-bold text-emerald-700">
                  − {totals.currency} {money(totals.discountAmount)}
                </span>
              </div>
            )}
            {totals.vatPercentage > 0 && (
              <SummaryRow
                label={`VAT ${totals.vatPercentage}%`}
                value={totals.vatValue}
                currency={totals.currency}
              />
            )}
          </div>

          {appliedCoupon ? (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-emerald-800">
                  {appliedCoupon.couponCode} applied
                </p>
                <p className="truncate text-xs text-emerald-700">
                  You saved {totals.currency} {money(totals.discountAmount)}
                </p>
              </div>
              <button
                type="button"
                onClick={handleRemoveCoupon}
                className="shrink-0 rounded-full p-1.5 text-emerald-700 hover:bg-emerald-100"
                aria-label="Remove coupon"
                title="Remove coupon"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  value={discountCode}
                  onChange={(e) => {
                    setDiscountCode(e.target.value.toUpperCase())
                    if (couponError) setCouponError('')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleApplyDiscount()
                    }
                  }}
                  placeholder="Apply discount code"
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
                <p className="mt-2 text-xs font-medium text-red-600" role="alert">
                  {couponError}
                </p>
              )}
            </>
          )}

          <hr className="my-5 border-slate-200" />

          <div className="flex items-center justify-between gap-4">
            <span className="text-lg font-bold text-[#1e3a8a]">Total</span>
            <span className="text-lg font-bold text-[#1e3a8a]">
              {totals.currency} {money(totals.total)}
            </span>
          </div>

          <button
            type="button"
            onClick={handlePay}
            className="mt-8 w-full rounded-full bg-[#1414e6] px-6 py-4 text-base font-bold text-white transition hover:bg-[#1010c4]"
          >
            Pay {totals.currency} {money(totals.total)}
          </button>
        </aside>
      </div>
    </div>
  )
}

export default StorageCheckoutPage
