import { Landmark } from 'lucide-react'
import ToggleSwitch from './ToggleSwitch'

function maskAccount(value) {
  const raw = String(value || '')
  if (raw.length <= 4) return raw || '—'
  return `${'•'.repeat(Math.min(8, raw.length - 4))}${raw.slice(-4)}`
}

export default function BankCard({
  account,
  onEdit,
  onDelete,
  onTogglePrimary,
  primaryLoading = false,
}) {
  return (
    <div className="rounded-[12px] border border-[#E5E7EB] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition duration-200 hover:border-slate-300 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand">
          <Landmark className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h3 className="text-sm font-semibold text-slate-900">{account?.bankName || 'Bank Account'}</h3>
              <p className="text-sm text-slate-500">
                Account No. {maskAccount(account?.accountNumber)}
              </p>
              {account?.iban ? (
                <p className="text-sm text-slate-500">IBAN (Account No.) {account.iban}</p>
              ) : null}
              {account?.swift ? (
                <p className="text-sm text-slate-500">SWIFT/BIC Code {account.swift}</p>
              ) : null}
              {account?.branchName ? (
                <p className="text-sm text-slate-500">Branch Name {account.branchName}</p>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Set as Primary</span>
              <ToggleSwitch
                checked={Boolean(account?.isPrimary)}
                disabled={primaryLoading || Boolean(account?.isPrimary)}
                label="Set as primary bank account"
                onChange={(next) => next && onTogglePrimary?.(account)}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={() => onEdit?.(account)}
              className="text-sm font-medium text-slate-500 transition duration-200 hover:text-brand"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete?.(account)}
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
