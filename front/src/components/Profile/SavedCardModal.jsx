import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import ModalDialog from '../ui/ModalDialog'
import ToggleSwitch from './ToggleSwitch'

/** Card numbers are 16 digits here — the input stops accepting them past that. */
const CARD_DIGITS = 16
/** 16 digits rendered in groups of four: "4111 1111 1111 1111". */
const CARD_INPUT_MAX_LENGTH = CARD_DIGITS + Math.floor((CARD_DIGITS - 1) / 4)

function formatCardInput(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, CARD_DIGITS)
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
}

function formatExpiryInput(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

function detectBrand(digits) {
  if (/^4/.test(digits)) return 'Visa'
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard'
  if (/^3[47]/.test(digits)) return 'American Express'
  if (/^6(?:011|5)/.test(digits)) return 'Discover'
  return ''
}

function isValidLuhn(num) {
  let sum = 0
  let alt = false
  for (let i = num.length - 1; i >= 0; i -= 1) {
    let n = Number(num[i])
    if (alt) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    alt = !alt
  }
  return sum % 10 === 0
}

const fieldClass =
  'w-full rounded-[12px] border border-[#E8EAF5] bg-[#F4F5FB] px-4 py-3.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition duration-200 focus:border-brand/30 focus:bg-white focus:ring-2 focus:ring-brand/10'

export default function SavedCardModal({ onClose, onSave, initialData }) {
  const isEditing = Boolean(initialData?._id)
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState(initialData?.expiry || '')
  const [cvv, setCvv] = useState('')
  const [holderName, setHolderName] = useState(initialData?.holderName || '')
  const [nickname, setNickname] = useState(initialData?.nickname || '')
  const [isPrimary, setIsPrimary] = useState(
    initialData?.isPrimary !== undefined ? Boolean(initialData.isPrimary) : true
  )
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  const digits = cardNumber.replace(/\D/g, '')
  const brand = useMemo(() => detectBrand(digits), [digits])

  /**
   * Errors are computed on save, so a message left over from an earlier attempt
   * would otherwise keep claiming a field is invalid after it has been fixed.
   * Clearing on edit means the message only ever describes the current input.
   */
  const clearError = (key) =>
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))

  const validate = () => {
    const next = {}
    const cardNumberError =
      digits.length !== CARD_DIGITS
        ? `Enter all ${CARD_DIGITS} digits of the card number`
        : !isValidLuhn(digits)
          ? 'Enter a valid card number'
          : null

    // On edit the number is optional — it is only re-checked when replacing it.
    if (cardNumberError && (!isEditing || digits)) {
      next.cardNumber = cardNumberError
    }

    if (!/^\d{2}\/\d{2}$/.test(expiry)) {
      next.expiry = 'Use MM/YY format'
    } else {
      const [mm, yy] = expiry.split('/').map(Number)
      const now = new Date()
      const exp = new Date(2000 + yy, mm)
      if (mm < 1 || mm > 12 || exp <= now) next.expiry = 'Card is expired or invalid'
    }

    // CVV is optional (it is never stored or sent to the API), so an empty field is
    // fine — only check the length when the user actually typed one.
    if (cvv) {
      const amex = brand === 'American Express' || /^3[47]/.test(digits)
      if (amex ? cvv.length !== 4 : cvv.length !== 3) {
        next.cvv = amex ? 'Enter 4-digit CVV' : 'Enter 3-digit CVV'
      }
    }

    if (!holderName.trim()) next.holderName = 'Name on card is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      // CVV is validated client-side only and never sent to the API.
      const payload = {
        expiry: expiry.trim(),
        holderName: holderName.trim(),
        nickname: nickname.trim(),
        isPrimary,
      }
      if (digits) payload.cardNumber = digits
      await onSave(payload)
      toast.success(isEditing ? 'Card updated' : 'Card saved')
      onClose()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save card')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalDialog
      open
      onClose={onClose}
      title="Add Card Details"
      footer={
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-full bg-brand py-3.5 text-sm font-bold text-white transition duration-200 hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save Details'}
        </button>
      }
    >
      <div className="space-y-3 pt-1">
        {isEditing ? (
          <p className="text-xs text-slate-500">
            Current card •••• {initialData?.last4}. Enter a new number only if replacing it.
          </p>
        ) : null}

        <div>
          <input
            value={cardNumber}
            onChange={(e) => {
              setCardNumber(formatCardInput(e.target.value))
              clearError('cardNumber')
            }}
            placeholder="Card No."
            inputMode="numeric"
            autoComplete="cc-number"
            aria-label="Card number"
            maxLength={CARD_INPUT_MAX_LENGTH}
            className={fieldClass}
          />
          <div className="mt-1 flex items-center justify-between">
            {errors.cardNumber ? (
              <p className="text-xs text-red-500">{errors.cardNumber}</p>
            ) : (
              <span className="text-xs text-slate-400">{brand || ' '}</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-[1fr_100px] gap-3">
          <div>
            <input
              value={expiry}
              onChange={(e) => {
                setExpiry(formatExpiryInput(e.target.value))
                clearError('expiry')
              }}
              placeholder="Valid Through (MM/YY)"
              inputMode="numeric"
              autoComplete="cc-exp"
              aria-label="Expiry date"
              className={fieldClass}
            />
            {errors.expiry ? <p className="mt-1 text-xs text-red-500">{errors.expiry}</p> : null}
          </div>
          <div>
            <input
              value={cvv}
              onChange={(e) => {
                setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))
                clearError('cvv')
              }}
              placeholder="CVV"
              inputMode="numeric"
              autoComplete="cc-csc"
              aria-label="CVV"
              className={fieldClass}
            />
            {errors.cvv ? <p className="mt-1 text-xs text-red-500">{errors.cvv}</p> : null}
          </div>
        </div>

        <div>
          <input
            value={holderName}
            onChange={(e) => {
              setHolderName(e.target.value)
              clearError('holderName')
            }}
            placeholder="Name on card"
            autoComplete="cc-name"
            aria-label="Name on card"
            className={fieldClass}
          />
          {errors.holderName ? <p className="mt-1 text-xs text-red-500">{errors.holderName}</p> : null}
        </div>

        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Card Nickname (for easy identification)"
          aria-label="Card nickname"
          className={fieldClass}
        />

        <div className="flex items-center justify-end gap-3 pt-1">
          <span className="text-sm font-medium text-slate-800">Set as default</span>
          <ToggleSwitch checked={isPrimary} onChange={setIsPrimary} label="Set as default card" />
        </div>
      </div>
    </ModalDialog>
  )
}
