import { CreditCard } from 'lucide-react'
import ToggleSwitch from './ToggleSwitch'

function maskCard(value) {
  const raw = String(value || '').replace(/\s+/g, '')
  if (!raw) return '•••• •••• •••• ••••'
  const last4 = raw.slice(-4)
  return `•••• •••• •••• ${last4}`
}

export default function SavedCard({
  card,
  onEdit,
  onDelete,
  onTogglePrimary,
  primaryLoading = false,
}) {
  return (
    <div className="rounded-[12px] border border-[#E5E7EB] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition duration-200 hover:border-slate-300 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand">
          <CreditCard className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h3 className="text-sm font-semibold text-slate-900">
                {card?.nickname || card?.brand || 'Saved Card'}
              </h3>
              <p className="text-sm text-slate-500">{maskCard(card?.last4 || card?.cardNumber)}</p>
              {card?.expiry ? (
                <p className="text-sm text-slate-500">Valid through {card.expiry}</p>
              ) : null}
              {card?.holderName ? (
                <p className="text-sm text-slate-500">Name on card {card.holderName}</p>
              ) : null}
              {card?.nickname ? (
                <p className="text-sm text-slate-500">Card Nickname {card.nickname}</p>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Set as Primary</span>
              <ToggleSwitch
                checked={Boolean(card?.isPrimary)}
                disabled={primaryLoading || Boolean(card?.isPrimary)}
                label="Set as primary card"
                onChange={(next) => next && onTogglePrimary?.(card)}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={() => onEdit?.(card)}
              className="text-sm font-medium text-slate-500 transition duration-200 hover:text-brand"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete?.(card)}
              className="text-sm font-medium text-slate-500 transition duration-200 hover:text-red-500"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
