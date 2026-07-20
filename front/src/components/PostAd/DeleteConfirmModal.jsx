import { X } from 'lucide-react'

/**
 * Confirmation dialog shown before deleting a photo thumbnail on the post-ad flow.
 * Controlled: render when `open` is true; `onConfirm` deletes, `onCancel` just closes.
 */
function DeleteConfirmModal({
  open,
  onConfirm,
  onCancel,
  title = 'Confirmation Required',
  message = 'Are you sure you want to delete this thumbnail?',
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <img
          src="/images/deleteConfirmationPopupImg.png"
          alt=""
          aria-hidden="true"
          className="mx-auto my-6 h-auto w-full max-w-[300px]"
        />

        <p className="text-center text-lg text-gray-800">{message}</p>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-full border border-[#2563eb] px-6 py-3 text-base font-semibold text-[#2563eb] transition hover:bg-blue-50"
          >
            Yes
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-full bg-[#1414e6] px-6 py-3 text-base font-semibold text-white transition hover:bg-[#1010c4]"
          >
            No
          </button>
        </div>
      </div>
    </div>
  )
}

export default DeleteConfirmModal
