import ModalDialog from '../ui/ModalDialog'

export default function DeleteArchiveModal({ open, item, saving, onClose, onConfirm }) {
  if (!item) return null
  const title = item.title || 'this ad'

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title="Delete Permanently"
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
            {saving ? 'Deleting…' : 'Delete Permanently'}
          </button>
        </div>
      }
    >
      <p className="pt-1 text-sm leading-relaxed text-slate-600">
        Permanently delete{' '}
        <span className="font-semibold text-slate-900">“{title}”</span>? This cannot be undone
        and the ad will be removed from My Archives.
      </p>
    </ModalDialog>
  )
}
