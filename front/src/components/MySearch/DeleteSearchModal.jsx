import ModalDialog from '../ui/ModalDialog'
import { getSearchDisplayName } from './savedSearchUtils'

export default function DeleteSearchModal({ open, item, saving, onClose, onConfirm }) {
  if (!item) return null
  const name = getSearchDisplayName(item)

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title="Delete Search"
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
            onClick={() => onConfirm?.()}
            className="flex-1 rounded-[12px] bg-red-500 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-60"
          >
            {saving ? 'Deleting…' : 'Delete Search'}
          </button>
        </div>
      }
    >
      <p className="pt-1 text-sm leading-relaxed text-slate-600">
        Delete <span className="font-semibold text-slate-900">“{name}”</span>? It will be removed
        from My Search and stop receiving notifications for new matching ads.
      </p>
    </ModalDialog>
  )
}
