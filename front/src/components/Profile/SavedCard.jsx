import { CreditCard } from 'lucide-react'
import ToggleSwitch from './ToggleSwitch'

function maskCard(value) {
  const raw = String(value || '').replace(/\s+/g, '')
  if (!raw) return 'XXXX XXXX XXXX XXXX'
  if (raw.length <= 4) return `XXXX XXXX XXXX ${raw}`
  const first4 = raw.length >= 8 ? raw.slice(0, 4) : ''
  const last4 = raw.slice(-4)
  if (first4 && first4 !== last4) return `${first4} XXXX XXXX ${last4}`
  return `XXXX XXXX XXXX ${last4}`
}

function DetailField({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] leading-5 text-[#9CA3AF]">{label}</p>
      <p className="mt-1 break-all text-[15px] font-semibold leading-6 text-[#111827]">
        {value || '—'}
      </p>
    </div>
  )
}

export default function SavedCard({
  card,
  onEdit,
  onDelete,
  onTogglePrimary,
  primaryLoading = false,
}) {
  // Title is the card name; nickname is shown separately in the grid
  const title = card?.nickname || card?.brand || 'Saved Card'
  const cardNumber = maskCard(card?.cardNumber || card?.last4)

  return (
    <div className="rounded-[16px] border border-[#D9E4F2] bg-[#F0F4FA] px-5 py-5 sm:px-6 sm:py-6">
      {/* Header: icon + card name | Set as Primary */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <CreditCard className="h-5 w-5 shrink-0 text-[#374151]" strokeWidth={1.75} />
          <h3 className="truncate text-base font-bold text-[#111827]">{title}</h3>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-[13px] text-[#9CA3AF]">Set as Primary</span>
          <ToggleSwitch
            checked={Boolean(card?.isPrimary)}
            disabled={primaryLoading || Boolean(card?.isPrimary)}
            label="Set as primary card"
            onChange={(next) => next && onTogglePrimary?.(card)}
          />
        </div>
      </div>

      {/*
        Body grid matching design rows:
        Row 1: Card No        | Valid through
        Row 2: Name on card   | (empty)
        Row 3: Card Nick Name | (empty)
      */}
      <div className="mt-5 grid grid-cols-1 gap-x-12 gap-y-5 sm:grid-cols-2">
        <DetailField label="Card No" value={cardNumber} />
        <DetailField label="Valid through" value={card?.expiry} />
        <DetailField label="Name on card" value={card?.holderName} />
        <div className="hidden sm:block" aria-hidden="true" />
        <DetailField label="Card Nick Name" value={card?.nickname} />
      </div>

      {/* Footer: Edit (blue) + Delete (grey) */}
      <div className="mt-6 flex items-center justify-end gap-6">
        <button
          type="button"
          onClick={() => onEdit?.(card)}
          className="text-sm font-semibold text-brand transition hover:text-brand-700"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete?.(card)}
          className="text-sm font-semibold text-[#6B7280] transition hover:text-red-500"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
