import { useState } from 'react'
import { X, Landmark } from 'lucide-react'
import toast from 'react-hot-toast'
import ToggleSwitch from './ToggleSwitch'
import FormInput from './FormInput'

export default function BankAccountModal({ onClose, onSave, initialData }) {
  const isEditing = Boolean(initialData?._id)
  const [bankName, setBankName] = useState(initialData?.bankName || '')
  const [accountNumber, setAccountNumber] = useState(initialData?.accountNumber || '')
  const [iban, setIban] = useState(initialData?.iban || '')
  const [swift, setSwift] = useState(initialData?.swift || '')
  const [branchName, setBranchName] = useState(initialData?.branchName || '')
  const [isPrimary, setIsPrimary] = useState(Boolean(initialData?.isPrimary))
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!bankName.trim()) {
      toast.error('Bank name is required')
      return
    }
    if (!accountNumber.trim() || accountNumber.trim().length < 4) {
      toast.error('Enter a valid account number')
      return
    }
    setSaving(true)
    try {
      await onSave({
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        iban: iban.trim(),
        swift: swift.trim(),
        branchName: branchName.trim(),
        isPrimary,
      })
      onClose()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save bank account')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-md sm:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
          <div className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-brand" />
            <h2 className="text-base font-bold text-slate-900">
              {isEditing ? 'Edit Bank Account' : 'Add Bank Account'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto px-5 py-4">
          <FormInput value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Bank name" />
          <FormInput value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Account number" />
          <FormInput value={iban} onChange={(e) => setIban(e.target.value)} placeholder="IBAN (optional)" />
          <FormInput value={swift} onChange={(e) => setSwift(e.target.value)} placeholder="SWIFT / BIC (optional)" />
          <FormInput value={branchName} onChange={(e) => setBranchName(e.target.value)} placeholder="Branch name (optional)" />
          <div className="flex items-center justify-between rounded-[12px] border border-[#E5E7EB] px-4 py-3">
            <span className="text-sm font-medium text-slate-700">Set as Primary</span>
            <ToggleSwitch checked={isPrimary} onChange={setIsPrimary} label="Set as primary bank account" />
          </div>
        </div>

        <div className="flex shrink-0 gap-3 border-t border-[#E5E7EB] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-[12px] border border-[#E5E7EB] px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-[12px] bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : isEditing ? 'Update' : 'Add Account'}
          </button>
        </div>
      </div>
    </div>
  )
}
