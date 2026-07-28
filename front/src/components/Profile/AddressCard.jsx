import { Building2, Home, MapPin } from 'lucide-react'
import ToggleSwitch from './ToggleSwitch'

function addressIcon(label = '') {
  const key = String(label).toLowerCase()
  if (key.includes('office') || key.includes('work')) return Building2
  if (key.includes('home')) return Home
  return MapPin
}

function formatAddress(loc) {
  return [loc?.building, loc?.apartment, loc?.city].filter(Boolean).join(', ') || 'No address details'
}

export default function AddressCard({
  location,
  onEdit,
  onDelete,
  onTogglePrimary,
  primaryLoading = false,
}) {
  const Icon = addressIcon(location?.label)

  return (
    <div className="rounded-[12px] border border-[#E5E7EB] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition duration-200 hover:border-slate-300 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand">
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900">{location?.label || 'Address'}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{formatAddress(location)}</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Set as Primary</span>
              <ToggleSwitch
                checked={Boolean(location?.isDefault)}
                disabled={primaryLoading || Boolean(location?.isDefault)}
                label="Set as primary address"
                onChange={(next) => next && onTogglePrimary?.(location)}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={() => onEdit?.(location)}
              className="text-sm font-medium text-slate-500 transition duration-200 hover:text-brand"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete?.(location)}
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
