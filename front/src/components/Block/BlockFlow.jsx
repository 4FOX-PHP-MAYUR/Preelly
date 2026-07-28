import { useEffect, useRef, useState } from 'react'
import { BellOff, CheckCircle2, CircleSlash, Loader2, User } from 'lucide-react'
import toast from 'react-hot-toast'
import { userService } from '@shared/services/api'
import { getMediaUrl } from '@shared/utils/helpers'
import ModalDialog from '../ui/ModalDialog'
import { displayNameOf, roleLabelOf } from './blockReasons'

const LIGHT_BTN =
  'flex-1 rounded-full bg-[#E8EFFF] py-3 text-sm font-semibold text-brand transition hover:bg-[#DCE6FF] disabled:opacity-60'

/**
 * Simple block confirmation (not the report reason flow).
 */
export default function BlockFlow({ open, user, onClose, onBlocked }) {
  const [submitting, setSubmitting] = useState(false)
  const userRef = useRef(user)

  useEffect(() => {
    if (open) {
      userRef.current = user
      setSubmitting(false)
    }
  }, [open, user])

  const target = user || userRef.current
  const name = displayNameOf(target)
  const role = roleLabelOf(target)
  const avatarSrc = target?.avatar ? getMediaUrl(target.avatar) || target.avatar : null

  const handleBlock = async () => {
    if (!target?._id || submitting) return
    setSubmitting(true)
    try {
      await userService.blockUser(target._id, { action: 'block' })
      toast.success(`${name} blocked`)
      onBlocked?.(target)
      onClose?.()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to block user')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open || !target) return null

  return (
    <ModalDialog open={open} onClose={onClose} title="Block this account?" maxWidthClass="sm:max-w-[400px]">
      <div className="flex flex-col items-center px-1 pb-2 pt-1 text-center">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-slate-100">
          {avatarSrc ? (
            <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            <User className="h-8 w-8 text-slate-400" />
          )}
        </div>
        <p className="mt-3 text-base font-bold text-slate-900">{name}</p>
        <p className="text-sm text-slate-500">{role}</p>

        <p className="mt-5 text-sm font-medium leading-relaxed text-brand">
          This will also block any other profile they have or create in future.
        </p>

        <ul className="mt-5 w-full space-y-4 text-left">
          <li className="flex gap-3">
            <CircleSlash className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
            <p className="text-sm leading-relaxed text-slate-700">
              They wont be able to message you or find your profile or ads on Preelly anymore.
            </p>
          </li>
          <li className="flex gap-3">
            <BellOff className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
            <p className="text-sm leading-relaxed text-slate-700">They wont be notified that you blocked them.</p>
          </li>
          <li className="flex gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
            <p className="text-sm leading-relaxed text-slate-700">You can unblock them anytime from settings.</p>
          </li>
        </ul>

        <div className="mt-7 flex w-full gap-3">
          <button type="button" onClick={onClose} disabled={submitting} className={LIGHT_BTN}>
            No
          </button>
          <button type="button" onClick={handleBlock} disabled={submitting} className={LIGHT_BTN}>
            {submitting ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> …
              </span>
            ) : (
              'Yes'
            )}
          </button>
        </div>
      </div>
    </ModalDialog>
  )
}
