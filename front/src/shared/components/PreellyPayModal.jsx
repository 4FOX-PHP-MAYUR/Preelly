import { useEffect, useState } from 'react'
import { Check, Plus } from 'lucide-react'
import toast from 'react-hot-toast'

// Shared "Opt For Preelly Pay" conditions popup, used by both the cart/checkout
// page and the chat screen. The conditions list is fetched from the DB (a
// product's resolved features) via derivePreellyConditions; the charge comes
// from the admin-managed checkout service.
export const MAX_PREELLY_CONDITIONS = 5
export const CURRENCY = 'AED'
// Default charge shown in the popup (front/.env → VITE_PREELLY_PAY_CHARGE).
export const PREELLY_PAY_CHARGE = Number(import.meta.env.VITE_PREELLY_PAY_CHARGE) || 7

export function money(value) {
  return Number(value ?? 0).toLocaleString('en-AE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// A product's selectable Preelly Pay conditions = the multi-select values the
// seller picked while posting. These are exposed two ways depending on the API:
//  • productMultiAttributes → [{ fieldTitle, fieldValues: [] }] (getProductById)
//  • features               → [{ title, values: [] }]           (resolved groups)
// We merge both so the popup works whether the product came from the product
// detail API or a populated cart item.
export function derivePreellyConditions(product) {
  const values = []

  const multiAttrs = Array.isArray(product?.productMultiAttributes)
    ? product.productMultiAttributes
    : []
  for (const attr of multiAttrs) {
    // Skip the category breadcrumb — it's not a user-selected condition.
    if (attr?.fieldKey === 'categoryPath') continue
    if (Array.isArray(attr?.fieldValues)) values.push(...attr.fieldValues)
  }

  const groups = Array.isArray(product?.features) ? product.features : []
  for (const group of groups) {
    if (Array.isArray(group?.values)) values.push(...group.values)
  }

  return [...new Set(values.map((v) => String(v).trim()).filter(Boolean))]
}

export function PreellyPayModal({
  open,
  conditions = [],
  charge = PREELLY_PAY_CHARGE,
  initialSelected,
  initialComment,
  onClose,
  onConfirm,
  onNotInterested,
}) {
  const [selected, setSelected] = useState(initialSelected || [])
  const [comment, setComment] = useState(initialComment || '')
  // Custom conditions the user typed via "Add More" (not in the base product list).
  const [extraConditions, setExtraConditions] = useState([])

  // Re-seed the modal each time it's (re)opened for editing.
  useEffect(() => {
    if (open) {
      setSelected(initialSelected || [])
      setComment(initialComment || '')
      // Restore any previously-selected custom conditions not in the base list.
      const base = new Set(conditions)
      setExtraConditions((initialSelected || []).filter((c) => !base.has(c)))
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null

  // Every condition shown = the product's list + user-added ones, de-duplicated.
  const allConditions = [...new Set([...conditions, ...extraConditions])]

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

  // Validate a user-typed condition: max 60 chars, no special characters (only
  // letters/numbers/space and a safe punctuation subset), and no SQL keywords or
  // comment markers. Returns an error string, or null when valid.
  const validateCondition = (raw) => {
    const value = String(raw || '').trim()
    if (!value) return 'Please enter a condition'
    if (value.length > 60) return 'Condition must be 60 characters or less'
    if (!/^[a-zA-Z0-9 ,.()/&-]+$/.test(value)) return 'No special characters allowed'
    if (value.includes('--')) return 'Invalid input'
    if (/\b(select|insert|update|delete|drop|alter|create|truncate|union|exec|where|table|database)\b/i.test(value)) {
      return 'Invalid input'
    }
    return null
  }

  const handleAddMore = () => {
    const error = validateCondition(comment)
    if (error) {
      toast.error(error)
      return
    }
    const value = comment.trim()
    if (allConditions.some((c) => c.toLowerCase() === value.toLowerCase())) {
      toast.error('This condition is already in the list')
      return
    }
    setExtraConditions((prev) => [...prev, value])
    // Auto-select the new condition if there's room (respecting the 5-option cap).
    setSelected((prev) =>
      prev.length < MAX_PREELLY_CONDITIONS ? [...prev, value] : prev,
    )
    setComment('')
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
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
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-bold text-slate-900">Preelly Pay Conditions</h3>
            <p className="text-sm font-semibold text-[#1e3a8a]">
              Charges <span className="text-base font-bold">{CURRENCY} {money(charge)}</span>
            </p>
          </div>

          <p className="mt-4 text-sm text-[#1e3a8a]">
            Select Preelly Pay conditions you can select up to {MAX_PREELLY_CONDITIONS} options
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            {allConditions.length === 0 && (
              <p className="text-sm text-slate-400">No conditions available for this product.</p>
            )}
            {allConditions.map((condition) => {
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
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddMore()
              }
            }}
            placeholder="Add more condition"
            rows={5}
            maxLength={60}
            className="mt-6 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/25"
          />

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={handleAddMore}
              className="inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-brand hover:underline"
            >
              <Plus className="h-4 w-4" strokeWidth={3} /> Add More
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-4">
          <div className="flex gap-3">
            {onNotInterested && (
              <button
                type="button"
                onClick={onNotInterested}
                className="flex-1 rounded-full border border-slate-300 px-6 py-4 text-base font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Not Interested
              </button>
            )}
            <button
              type="button"
              onClick={() => onConfirm(selected, comment)}
              className="flex-1 rounded-full bg-brand px-6 py-4 text-base font-bold text-white transition hover:bg-brand-700"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PreellyPayModal
