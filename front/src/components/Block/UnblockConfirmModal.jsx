import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { userService } from '@shared/services/api'
import ModalDialog from '../ui/ModalDialog'
import { displayNameOf, usernameOf } from './blockReasons'

/**
 * Confirm unblock — Cancel / Unblock pills.
 */
export default function UnblockConfirmModal({ open, user, onClose, onUnblocked }) {
  const [submitting, setSubmitting] = useState(false)
  if (!open || !user) return null

  const name = displayNameOf(user)
  const username = usernameOf(user)
  const title = username ? `Unblock ${name} (${username})?` : `Unblock ${name}?`

  const handleUnblock = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await userService.unblockUser(user._id)
      toast.success(`${name} unblocked`)
      onUnblocked?.(user)
      onClose?.()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to unblock user')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalDialog open={open} onClose={onClose} maxWidthClass="sm:max-w-[400px]">
      <div className="relative px-1 pb-2 pt-2 text-center">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
        >
          <X className="h-5 w-5" strokeWidth={2.25} />
        </button>
        <h2 className="px-8 text-lg font-bold leading-snug text-slate-900">{title}</h2>
        <p className="mt-4 text-sm leading-relaxed text-slate-700">
          {name} and other accounts they may have or create will now be able to see your ads, follow and message you on
          Preelly.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-700">They won&apos;t be notified that you unblocked them.</p>

        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-full bg-[#E8EFFF] py-3 text-sm font-semibold text-brand transition hover:bg-[#DCE6FF] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUnblock}
            disabled={submitting}
            className="flex-1 rounded-full bg-brand py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> …
              </span>
            ) : (
              'Unblock'
            )}
          </button>
        </div>
      </div>
    </ModalDialog>
  )
}
