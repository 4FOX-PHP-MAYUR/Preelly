import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, Gauge, Loader2, Search, Star, User, X } from 'lucide-react'
import toast from 'react-hot-toast'
import ModalDialog from '../../../components/ui/ModalDialog'
import { productService } from '@shared/services/api'
import { formatPrice, getMediaUrl } from '@shared/utils/helpers'

const SOURCE_OPTIONS = [
  { value: 'friends_family', label: 'Friends or family' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'dubizzle', label: 'Dubizzle' },
  { value: 'other', label: 'Other marketplace' },
]

const PREELLY_REASON_OPTIONS = [
  'Easy to list products',
  'Fast buyer interest',
  'Useful seller tools',
  'Felt safe and trustworthy',
  'Quality buyer leads',
]

function relativeTime(date) {
  if (!date) return ''
  const diff = Date.now() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

function StarInput({ value = 0, onChange, size = 'h-7 w-7' }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = i < value
        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i + 1)}
            aria-label={`${i + 1} star${i === 0 ? '' : 's'}`}
            className="p-0.5"
          >
            <Star className={`${size} ${filled ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'}`} />
          </button>
        )
      })}
    </div>
  )
}

function ProductSummaryCard({ product }) {
  const image = product?.images?.[0]
  const imageSrc = image ? getMediaUrl(image) || image : null
  const seller = product?.seller || {}
  const sellerAvatar = seller.avatar ? getMediaUrl(seller.avatar) || seller.avatar : null

  const specs = [
    product?.year != null ? { icon: Calendar, label: String(product.year) } : null,
    product?.mileage != null ? { icon: Gauge, label: `${Number(product.mileage).toLocaleString()} km` } : null,
  ].filter(Boolean)

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5E7EB]">
      <div className="h-44 w-full bg-slate-100">
        {imageSrc ? (
          <img src={imageSrc} alt={product?.title || ''} className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="space-y-2 p-3">
        <h3 className="font-semibold text-slate-900">{product?.title}</h3>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          {specs.map((spec, i) => {
            const Icon = spec.icon
            return (
              <span key={i} className="inline-flex items-center gap-1">
                <Icon className="h-3.5 w-3.5" /> {spec.label}
              </span>
            )
          })}
        </div>
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 overflow-hidden rounded-full bg-slate-100">
              {sellerAvatar ? (
                <img src={sellerAvatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <User className="m-1 h-5 w-5 text-slate-400" />
              )}
            </div>
            <span className="text-xs text-slate-500">{seller.name || 'Seller'}</span>
          </div>
          <span className="font-bold text-brand">
            {formatPrice(Number(product?.price || 0), (product?.currency || 'AED').toUpperCase())}
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * Multi-step "Mark as Sold" flow: confirm -> (buyer pick -> buyer rating) or
 * (external source -> Preelly experience rating). Nothing is persisted until
 * the final submit in either branch (mirrors the reference designs/flow).
 */
export default function MarkAsSoldFlow({ open, product, onClose, onSold }) {
  const [step, setStep] = useState('confirm')
  const [submitting, setSubmitting] = useState(false)

  const [buyers, setBuyers] = useState([])
  const [buyersLoading, setBuyersLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedBuyer, setSelectedBuyer] = useState(null)

  const [rating, setRating] = useState({ responseRating: 0, behaviourRating: 0, overallRating: 0, comment: '' })
  const [platforms, setPlatforms] = useState([])
  const [sourceComment, setSourceComment] = useState('')
  const [preellyRating, setPreellyRating] = useState({ stars: 0, reasons: [], comment: '' })

  useEffect(() => {
    if (!open) return
    setStep('confirm')
    setBuyers([])
    setSearch('')
    setSelectedBuyer(null)
    setRating({ responseRating: 0, behaviourRating: 0, overallRating: 0, comment: '' })
    setPlatforms([])
    setSourceComment('')
    setPreellyRating({ stars: 0, reasons: [], comment: '' })
  }, [open, product?._id])

  useEffect(() => {
    if (step !== 'buyers' || !product?._id) return
    let cancelled = false
    setBuyersLoading(true)
    productService
      .getProductBuyers(product._id)
      .then((res) => {
        if (!cancelled) setBuyers(res.data || [])
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load conversations')
      })
      .finally(() => {
        if (!cancelled) setBuyersLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [step, product?._id])

  const filteredBuyers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return buyers
    return buyers.filter((c) => (c.buyer?.name || '').toLowerCase().includes(q))
  }, [buyers, search])

  if (!open || !product) return null

  const togglePlatform = (value) => {
    setPlatforms((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]))
  }

  const toggleReason = (reason) => {
    setPreellyRating((prev) => ({
      ...prev,
      reasons: prev.reasons.includes(reason)
        ? prev.reasons.filter((r) => r !== reason)
        : [...prev.reasons, reason],
    }))
  }

  const submitBuyerRating = async () => {
    setSubmitting(true)
    try {
      const res = await productService.markProductSold(product._id, {
        soldVia: 'preelly',
        buyerId: selectedBuyer.buyer._id,
        rating: {
          responseRating: rating.responseRating || undefined,
          behaviourRating: rating.behaviourRating || undefined,
          overallRating: rating.overallRating || undefined,
          comment: rating.comment,
        },
      })
      toast.success('Marked as sold')
      onSold?.(res.data.product)
      onClose?.()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to mark as sold')
    } finally {
      setSubmitting(false)
    }
  }

  const submitExternalFeedback = async () => {
    setSubmitting(true)
    try {
      const res = await productService.markProductSold(product._id, {
        soldVia: 'external',
        platform: platforms[0],
        saleComment: sourceComment,
        preellyRating: {
          stars: preellyRating.stars || undefined,
          reasons: preellyRating.reasons,
          comment: preellyRating.comment,
        },
      })
      toast.success('Marked as sold')
      onSold?.(res.data.product)
      onClose?.()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to mark as sold')
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'confirm') {
    return createPortal(
      <div
        className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/40 p-4"
        role="dialog"
        aria-modal="true"
        onClick={onClose}
      >
        <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between pb-3">
            <h2 className="text-lg font-bold text-slate-900">Confirmation</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 text-slate-400 hover:bg-slate-100">
              <X className="h-5 w-5" />
            </button>
          </div>
          <ProductSummaryCard product={product} />
          <p className="pt-4 text-center text-base font-semibold text-slate-900">
            Did you sell the above product from Preelly?
          </p>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setStep('source')}
              className="flex-1 rounded-full border border-brand px-6 py-3 text-base font-semibold text-brand transition hover:bg-brand-50"
            >
              No
            </button>
            <button
              type="button"
              onClick={() => setStep('buyers')}
              className="flex-1 rounded-full bg-brand px-6 py-3 text-base font-semibold text-white transition hover:opacity-90"
            >
              Yes
            </button>
          </div>
        </div>
      </div>,
      document.body,
    )
  }

  if (step === 'buyers') {
    return (
      <ModalDialog open onClose={onClose} title="Select the buyer" maxWidthClass="sm:max-w-md" zIndexClass="z-[10060]">
        <p className="pb-3 text-sm text-slate-500">Select the person to whom the product was sold.</p>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contact and messages…"
            className="w-full rounded-full border border-[#E5E7EB] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand"
          />
        </div>
        {buyersLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : filteredBuyers.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            No conversations found for this product yet.
          </div>
        ) : (
          <div className="max-h-[50vh] space-y-1 overflow-y-auto">
            {filteredBuyers.map((contact) => {
              const avatar = contact.buyer?.avatar ? getMediaUrl(contact.buyer.avatar) || contact.buyer.avatar : null
              return (
                <button
                  key={contact.chatId}
                  type="button"
                  onClick={() => {
                    setSelectedBuyer(contact)
                    setStep('rating')
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-slate-50"
                >
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-slate-100">
                    {avatar ? (
                      <img src={avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <User className="m-2.5 h-6 w-6 text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{contact.buyer?.name}</p>
                    <p className="truncate text-xs text-slate-400">{contact.lastMessage || 'last chat message will show here'}</p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">{relativeTime(contact.lastMessageAt)}</span>
                </button>
              )
            })}
          </div>
        )}
      </ModalDialog>
    )
  }

  if (step === 'rating') {
    return (
      <ModalDialog open onClose={onClose} title="Rating" maxWidthClass="sm:max-w-md" zIndexClass="z-[10060]">
        <div className="space-y-6 pb-2">
          <p className="text-center text-base font-semibold text-slate-900">
            Let us know your overall experience with {selectedBuyer?.buyer?.name || 'the buyer'}.
          </p>
          <div className="space-y-2 text-center">
            <p className="text-sm font-semibold text-brand">Buyer's response to your query</p>
            <StarInput value={rating.responseRating} onChange={(v) => setRating((p) => ({ ...p, responseRating: v }))} />
          </div>
          <div className="space-y-2 text-center">
            <p className="text-sm font-semibold text-brand">Buyer's behaviour</p>
            <StarInput value={rating.behaviourRating} onChange={(v) => setRating((p) => ({ ...p, behaviourRating: v }))} />
          </div>
          <div className="space-y-2 text-center">
            <p className="text-sm font-semibold text-brand">Overall experience</p>
            <StarInput value={rating.overallRating} onChange={(v) => setRating((p) => ({ ...p, overallRating: v }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-brand">Comments</label>
            <textarea
              value={rating.comment}
              onChange={(e) => setRating((p) => ({ ...p, comment: e.target.value }))}
              placeholder="Enter your comments here"
              rows={3}
              className="w-full rounded-xl border-0 bg-slate-50 p-3 text-sm outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={submitBuyerRating}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-base font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Submit Feedback
          </button>
        </div>
      </ModalDialog>
    )
  }

  if (step === 'source') {
    return (
      <ModalDialog open onClose={onClose} title="Confirmation" maxWidthClass="sm:max-w-md" zIndexClass="z-[10060]">
        <div className="space-y-4 pb-2">
          <p className="text-center text-base font-semibold text-slate-900">Where did you sell the product?</p>
          <div>
            <p className="mb-2 text-sm font-semibold text-brand">Select one or more options</p>
            <div className="flex flex-wrap gap-2">
              {SOURCE_OPTIONS.map((opt) => {
                const active = platforms.includes(opt.value)
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => togglePlatform(opt.value)}
                    className={`rounded-full border px-3.5 py-2 text-sm font-medium transition ${
                      active ? 'border-brand bg-brand-50 text-brand' : 'border-[#E5E7EB] text-slate-600 hover:border-brand/30'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-brand">Comments</label>
            <textarea
              value={sourceComment}
              onChange={(e) => setSourceComment(e.target.value)}
              placeholder="Enter your comments here"
              rows={3}
              className="w-full rounded-xl border-0 bg-slate-50 p-3 text-sm outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <button
            type="button"
            disabled={platforms.length === 0}
            onClick={() => setStep('preellyRating')}
            className="w-full rounded-full bg-brand px-6 py-3 text-base font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            Submit Feedback
          </button>
        </div>
      </ModalDialog>
    )
  }

  // step === 'preellyRating'
  return (
    <ModalDialog open onClose={onClose} title="Rating" maxWidthClass="sm:max-w-md" zIndexClass="z-[10060]">
      <div className="space-y-5 pb-2">
        <p className="text-center text-base font-semibold text-slate-900">How was your journey with Preelly so far?</p>
        <div className="space-y-2 text-center">
          <p className="text-sm text-slate-500">Rate your experience with Preelly</p>
          <StarInput value={preellyRating.stars} onChange={(v) => setPreellyRating((p) => ({ ...p, stars: v }))} />
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-brand">Choose at least one answer</p>
          <div className="flex flex-wrap gap-2">
            {PREELLY_REASON_OPTIONS.map((reason) => {
              const active = preellyRating.reasons.includes(reason)
              return (
                <button
                  key={reason}
                  type="button"
                  onClick={() => toggleReason(reason)}
                  className={`rounded-full border px-3.5 py-2 text-sm font-medium transition ${
                    active ? 'border-brand bg-brand-50 text-brand' : 'border-[#E5E7EB] text-slate-600 hover:border-brand/30'
                  }`}
                >
                  {reason}
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-brand">Comments</label>
          <textarea
            value={preellyRating.comment}
            onChange={(e) => setPreellyRating((p) => ({ ...p, comment: e.target.value }))}
            placeholder="Enter your comments here"
            rows={3}
            className="w-full rounded-xl border-0 bg-slate-50 p-3 text-sm outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>
        <button
          type="button"
          disabled={submitting}
          onClick={submitExternalFeedback}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-base font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Submit Feedback
        </button>
      </div>
    </ModalDialog>
  )
}
