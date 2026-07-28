import { useEffect, useMemo, useRef, useState } from 'react'
import { BellOff, CheckCircle2, ChevronRight, CircleSlash, Loader2, User } from 'lucide-react'
import toast from 'react-hot-toast'
import { userService } from '@shared/services/api'
import { getMediaUrl } from '@shared/utils/helpers'
import ModalDialog from '../ui/ModalDialog'
import {
  BLOCK_REASON_TREE,
  BLOCK_REVIEW_QUESTIONS,
  displayNameOf,
  roleLabelOf,
  usernameOf,
} from './blockReasons'

const LIGHT_BTN =
  'flex-1 rounded-full bg-[#E8EFFF] py-3 text-sm font-semibold text-brand transition hover:bg-[#DCE6FF] disabled:opacity-60'
const PRIMARY_BTN =
  'w-full rounded-full bg-brand py-3.5 text-[15px] font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60'

/**
 * Multi-step block flow:
 * confirm → reason tree → review → API block
 */
export default function BlockFlow({ open, user, onClose, onBlocked }) {
  const [step, setStep] = useState('confirm') // confirm | reason | review
  const [path, setPath] = useState([]) // selected nodes
  const [submitting, setSubmitting] = useState(false)
  const userRef = useRef(user)

  useEffect(() => {
    if (open) {
      userRef.current = user
      setStep('confirm')
      setPath([])
      setSubmitting(false)
    }
  }, [open, user])

  const target = user || userRef.current
  const name = displayNameOf(target)
  const username = usernameOf(target)
  const role = roleLabelOf(target)
  const avatarSrc = target?.avatar ? getMediaUrl(target.avatar) || target.avatar : null

  const currentNode = useMemo(() => {
    let nodes = BLOCK_REASON_TREE
    let node = null
    for (const item of path) {
      node = nodes.find((n) => n.id === item.id) || null
      nodes = node?.children || []
    }
    return { parent: node, options: path.length === 0 ? BLOCK_REASON_TREE : node?.children || [] }
  }, [path])

  const reasonPrompt =
    path.length === 0
      ? 'Why are you blocking this account?'
      : currentNode.parent?.prompt || 'Which best describes the problem?'

  const reviewRows = path.map((item, index) => ({
    question: BLOCK_REVIEW_QUESTIONS[Math.min(index, BLOCK_REVIEW_QUESTIONS.length - 1)],
    answer: item.label,
  }))

  const selectOption = (option) => {
    const next = [...path, { id: option.id, label: option.label }]
    setPath(next)
    if (option.children?.length) {
      setStep('reason')
    } else {
      setStep('review')
    }
  }

  const handleSubmit = async () => {
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

  if (step === 'confirm') {
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
            <button type="button" onClick={onClose} className={LIGHT_BTN}>
              No
            </button>
            <button type="button" onClick={() => setStep('reason')} className={LIGHT_BTN}>
              Yes
            </button>
          </div>
        </div>
      </ModalDialog>
    )
  }

  if (step === 'reason') {
    return (
      <ModalDialog
        open={open}
        onClose={onClose}
        title="Block"
        maxWidthClass="sm:max-w-[420px]"
      >
        <div className="pb-2">
          <h3 className="text-center text-base font-bold text-slate-900">{reasonPrompt}</h3>
          <p className="mt-2 text-center text-xs leading-relaxed text-slate-500">
            Your report is anonymous. If someone is in immediate danger, call the local emergency services - don&apos;t
            wait.
          </p>

          <div className="mt-5 divide-y divide-slate-100">
            {currentNode.options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => selectOption(option)}
                className="flex w-full items-center justify-between gap-3 py-3.5 text-left transition hover:bg-slate-50"
              >
                <span className="text-sm font-medium text-slate-900">{option.label}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
              </button>
            ))}
          </div>

          {path.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                const next = path.slice(0, -1)
                setPath(next)
                setStep(next.length === 0 ? 'confirm' : 'reason')
              }}
              className="mt-3 text-sm font-semibold text-brand hover:underline"
            >
              Back
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep('confirm')}
              className="mt-3 text-sm font-semibold text-brand hover:underline"
            >
              Back
            </button>
          )}
        </div>
      </ModalDialog>
    )
  }

  return (
    <ModalDialog open={open} onClose={onClose} title="Block" maxWidthClass="sm:max-w-[420px]">
      <div className="pb-1 text-center">
        <h3 className="text-base font-bold text-slate-900">You&apos;re about to block this account</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          We only remove content that goes against our Advertiser Standards. You can review or edit your block details
          below.
        </p>
      </div>

      <div className="mt-6 text-left">
        <h4 className="text-sm font-bold text-slate-900">Block details</h4>
        <div className="mt-4 space-y-4">
          {reviewRows.map((row) => (
            <div key={row.question}>
              <p className="text-sm font-semibold text-slate-900">{row.question}</p>
              <p className="mt-1 text-sm text-slate-400">{row.answer}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 space-y-3">
        <button type="button" onClick={handleSubmit} disabled={submitting} className={PRIMARY_BTN}>
          {submitting ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Blocking…
            </span>
          ) : (
            'Submit'
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            setPath((p) => p.slice(0, -1))
            setStep('reason')
          }}
          className="mx-auto block text-sm font-semibold text-brand hover:underline"
        >
          Edit details
        </button>
      </div>

      {username ? (
        <p className="mt-4 text-center text-xs text-slate-400">
          Blocking {name} ({username})
        </p>
      ) : null}
    </ModalDialog>
  )
}
