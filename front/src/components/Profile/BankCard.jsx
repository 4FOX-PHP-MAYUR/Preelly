import { Landmark } from 'lucide-react'
import ToggleSwitch from './ToggleSwitch'

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

export default function BankCard({
  account,
  onEdit,
  onDelete,
  onTogglePrimary,
  primaryLoading = false,
}) {
  return (
    <div className="rounded-[16px] border border-[#D9E4F2] bg-[#F0F4FA] px-5 py-5 sm:px-6 sm:py-6">
      {/* Header: icon + bank name | Set as Primary */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Landmark className="h-5 w-5 shrink-0 text-[#374151]" strokeWidth={1.75} />
          <h3 className="truncate text-base font-bold text-[#111827]">
            {account?.bankName || 'Bank Account'}
          </h3>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-[13px] text-[#9CA3AF]">Set as Primary</span>
          <ToggleSwitch
            checked={Boolean(account?.isPrimary)}
            disabled={primaryLoading || Boolean(account?.isPrimary)}
            label="Set as primary bank account"
            onChange={(next) => next && onTogglePrimary?.(account)}
          />
        </div>
      </div>

      {/* Body: 2-col grid — Account No | SWIFT, Account No(IBAN) | Branch */}
      <div className="mt-5 grid grid-cols-1 gap-x-12 gap-y-5 sm:grid-cols-2">
        <DetailField label="Account No." value={account?.accountNumber} />
        <DetailField label="SWIFT/BIC Code" value={account?.swift} />
        <DetailField label="Account No." value={account?.iban} />
        <DetailField label="Branch Name" value={account?.branchName} />
      </div>

      {/* Footer: Edit (blue) + Delete (grey) */}
      <div className="mt-6 flex items-center justify-end gap-6">
        <button
          type="button"
          onClick={() => onEdit?.(account)}
          className="text-sm font-semibold text-brand transition hover:text-brand-700"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete?.(account)}
          className="text-sm font-semibold text-[#6B7280] transition hover:text-red-500"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
