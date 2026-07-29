import { useEffect, useState } from 'react'
import ModalDialog from '../ui/ModalDialog'
import { getSearchDisplayName } from './savedSearchUtils'

export default function RenameSearchModal({ open, item, saving, onClose, onSave }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !item) return
    setValue(getSearchDisplayName(item))
    setError('')
  }, [open, item])

  if (!item) return null

  const submit = (e) => {
    e?.preventDefault?.()
    const next = value.trim()
    if (!next) {
      setError('Search name is required')
      return
    }
    if (next.length > 120) {
      setError('Name must be 120 characters or less')
      return
    }
    onSave?.(next)
  }

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title="Rename Search"
      maxWidthClass="sm:max-w-md"
      footer={
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-[12px] bg-[#EEF0FF] px-4 py-3.5 text-sm font-semibold text-brand transition hover:bg-[#E4E7FF] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={submit}
            className="flex-1 rounded-[12px] bg-brand px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-3 pt-1">
        <label htmlFor="rename-search-input" className="block text-sm font-medium text-slate-700">
          Search name
        </label>
        <input
          id="rename-search-input"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            if (error) setError('')
          }}
          maxLength={120}
          autoComplete="off"
          className="w-full rounded-[12px] border border-[#E5E7EB] px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
          placeholder="Enter a name for this search"
        />
        {error ? <p className="text-xs font-medium text-red-500">{error}</p> : null}
      </form>
    </ModalDialog>
  )
}
