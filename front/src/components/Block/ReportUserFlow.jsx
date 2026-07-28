import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { userService } from '@shared/services/api'
import ModalDialog from '../ui/ModalDialog'
import { displayNameOf, REPORT_REASON_TREE } from './blockReasons'

const PRIMARY_BTN =
  'w-full rounded-full bg-brand py-3.5 text-[15px] font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60'

/**
 * Multi-step report flow for reporting another user from their profile.
 * reason tree → review → submit
 */
export default function ReportUserFlow({ open, user, onClose, onReported }) {
  const [step, setStep] = useState('reason') // reason | review
  const [path, setPath] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const userRef = useRef(user)

  useEffect(() => {
    if (open) {
      userRef.current = user
      setStep('reason')
      setPath([])
      setSubmitting(false)
    }
  }, [open, user])

  const target = user || userRef.current
  const name = displayNameOf(target)

  const currentNode = useMemo(() => {
    let nodes = REPORT_REASON_TREE
    let node = null
    for (const item of path) {
      node = nodes.find((n) => n.id === item.id) || null
      nodes = node?.children || []
    }
    return { parent: node, options: path.length === 0 ? REPORT_REASON_TREE : node?.children || [] }
  }, [path])

  const reasonPrompt =
    path.length === 0
      ? 'Why are you reporting this user?'
      : currentNode.parent?.prompt || 'Which best describes the problem?'

  const reviewRows = path.map((item) => ({
    question: item.prompt || 'Why are you reporting this user?',
    answer: item.label,
  }))

  const selectOption = (option) => {
    const next = [...path, { id: option.id, label: option.label, prompt: reasonPrompt }]
    setPath(next)
    if (option.children?.length) {
      setStep('reason')
    } else {
      setStep('review')
    }
  }

  const handleSubmit = async () => {
    if (!target?._id || submitting || path.length === 0) return
    setSubmitting(true)
    try {
      const reason = path.map((p) => p.label).join(' › ')
      const details = path.map((p, i) => `${reviewRows[i]?.question || 'Detail'}: ${p.label}`).join('\n')
      await userService.reportUser(target._id, { reason, details })
      toast.success('Report submitted')
      onReported?.(target)
      onClose?.()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to submit report')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open || !target) return null

  if (step === 'reason') {
    return (
      <ModalDialog open={open} onClose={onClose} title="Report" maxWidthClass="sm:max-w-[472px]">
        <div className="pb-2">
          <h3 className="text-center text-base font-bold text-slate-900 underline decoration-slate-900/20 underline-offset-4">
            {reasonPrompt}
          </h3>
          <p className="mt-3 text-center text-xs leading-relaxed text-slate-500">
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
              onClick={() => setPath((p) => p.slice(0, -1))}
              className="mt-3 text-sm font-semibold text-brand hover:underline"
            >
              Back
            </button>
          ) : null}
        </div>
      </ModalDialog>
    )
  }

  return (
    <ModalDialog open={open} onClose={onClose} title="Report" maxWidthClass="sm:max-w-[472px]">
      <div className="pb-1 text-center">
        <h3 className="text-base font-bold text-slate-900">You&apos;re about to submit a report</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          We only remove content that goes against our Community Guidelines. You can review or edit your report details
          below.
        </p>
      </div>

      <div className="mt-6 text-left">
        <h4 className="text-sm font-bold text-slate-900">Report details</h4>
        <div className="mt-4 space-y-4">
          {reviewRows.map((row) => (
            <div key={row.question + row.answer}>
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
              <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
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

      <p className="mt-3 text-center text-xs text-slate-400">Reporting {name}</p>
    </ModalDialog>
  )
}
