import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { packageService } from '@shared/services/api'
import BrandLogo from '@shared/components/BrandLogo'
import { PostAdListingBreadcrumb } from '../components/PostAd/PostAdListingBreadcrumb'

function formatAmount(value) {
  const num = Number(value ?? 0)
  // Whole prices read as "329", not "329.00" — decimals only when they exist.
  return Number.isInteger(num) ? String(num) : num.toFixed(2)
}

function PackageCard({ pkg, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(pkg.id)}
      aria-pressed={selected}
      className={`relative flex w-full flex-col overflow-hidden rounded-2xl border bg-white p-6 text-left transition-all ${
        selected
          ? 'border-[#2563eb] ring-2 ring-[#2563eb]/25'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Faint brand watermark, as in the design */}
      <BrandLogo
        variant="light"
        className="pointer-events-none absolute -right-2 top-6 h-14 w-auto opacity-[0.06]"
      />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
              selected ? 'border-[#2563eb]' : 'border-slate-300'
            }`}
          >
            {selected && <span className="h-2.5 w-2.5 rounded-full bg-[#2563eb]" />}
          </span>
          <span className="text-xl font-bold text-slate-900">{pkg.packageName}</span>
        </div>

        {pkg.isRecomended && (
          <span className="shrink-0 rounded-md bg-[#1e3a8a] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
            Recommended
          </span>
        )}
      </div>

      <div className="mt-5 flex items-baseline gap-1.5">
        <span className="text-lg font-bold text-[#1e3a8a]">AED</span>
        <span className="text-3xl font-extrabold text-[#1e3a8a]">{formatAmount(pkg.packageAmount)}</span>
        {pkg.isVatApplicable && <span className="text-xs font-medium text-slate-500">+VAT</span>}
      </div>

      <hr className="my-5 border-slate-200" />

      <ul className="flex flex-col gap-4">
        {pkg.packageFeatures?.map((feature, i) => (
          <li key={`${feature}-${i}`} className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
            <span className="text-sm text-slate-700">{feature}</span>
          </li>
        ))}
      </ul>
    </button>
  )
}

function SelectPackagePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const productId = searchParams.get('productId') || ''
  // Passed through from the post-ad flow so the trail matches the previous step.
  const breadcrumbItems = useMemo(
    () => location.state?.breadcrumbItems || [],
    [location.state]
  )

  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const res = await packageService.listActivePackages()
        if (cancelled) return
        const items = res.data?.data || []
        setPackages(items)
        // Pre-select the recommended package, if the admin marked one.
        const recommended = items.find((p) => p.isRecomended)
        if (recommended) setSelectedId(recommended.id)
      } catch (err) {
        if (!cancelled) toast.error('Failed to load packages')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const handleContinue = async () => {
    if (!selectedId) {
      toast.error('Please select a package')
      return
    }
    if (!productId) {
      toast.error('Missing listing reference')
      return
    }
    try {
      setSaving(true)
      await packageService.selectPackageForProduct(productId, selectedId)
      navigate(`/post-ad/storage?productId=${productId}&packageId=${selectedId}`, {
        state: { breadcrumbItems },
      })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to select package')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="mb-6 text-center sm:mb-8">
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
          Select a package that works for you
        </h1>
        <p className="mt-2 text-base text-slate-500">
          Review your all details and we will be live soon
        </p>
      </div>

      <PostAdListingBreadcrumb items={breadcrumbItems} />

      {loading ? (
        <p className="py-20 text-center text-sm text-slate-500">Loading packages…</p>
      ) : packages.length === 0 ? (
        <p className="py-20 text-center text-sm text-slate-500">No packages are available right now.</p>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                selected={selectedId === pkg.id}
                onSelect={setSelectedId}
              />
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-slate-500">
            Select a package that works for you
          </p>

          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={handleContinue}
              disabled={saving || !selectedId}
              className="inline-flex items-center justify-center rounded-xl bg-[#2563eb] px-8 py-3 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Continue to Payment'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default SelectPackagePage
