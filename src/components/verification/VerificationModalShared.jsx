import { X } from 'lucide-react'

/** Reference design colors */
export const VERIFY_BLUE = '#0044FF'
export const VERIFY_BLUE_LIGHT = '#EEF4FF'
export const VERIFY_PURPLE = '#6236FF'

const VERIFICATION_ILLUSTRATION = '/images/verification-illustration.png'

/** Reference illustration — phone + face scan + verified badge */
export function VerifyIllustration() {
  return (
    <img
      src={VERIFICATION_ILLUSTRATION}
      alt=""
      aria-hidden
      className="w-full max-w-[280px] mx-auto h-auto object-contain"
      draggable={false}
    />
  )
}

export function VerificationModalShell({ title, onClose, backLabel, onBack, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-[2px] p-4">
      <div
        className="relative w-full max-w-[360px] bg-white overflow-hidden"
        style={{ borderRadius: '24px', boxShadow: '0 24px 48px rgba(0,0,0,0.12)' }}
      >
        <div className="flex items-start justify-between px-6 pt-6 pb-2">
          <div className="flex-1 min-w-0 pr-3">
            {backLabel && onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="text-sm font-medium hover:underline mb-1 block"
                style={{ color: VERIFY_BLUE }}
              >
                {backLabel}
              </button>
            ) : null}
            <h2 className="text-[17px] font-bold text-gray-900 leading-tight tracking-tight">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-0.5 text-gray-400 hover:text-gray-600 transition"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Popup 1 — intro screen */
export function VerificationIntroBody({ onClose, onContinue, subtitle, continueLabel = 'Get Verified' }) {
  return (
    <div className="flex flex-col items-center text-center px-6 pb-7 pt-1">
      <div className="mb-5 w-full">
        <VerifyIllustration />
      </div>
      <p className="text-[14px] text-gray-800 leading-relaxed mb-2 px-1">
        {subtitle || 'Verification made easier - verify your account in one minute !'}
      </p>
      <a
        href="#"
        onClick={(e) => e.preventDefault()}
        className="text-[14px] font-medium hover:underline mb-7"
        style={{ color: VERIFY_BLUE }}
      >
        Learn more of verification on prelly
      </a>
      <div className="flex items-center gap-3 w-full">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-3 rounded-full text-[14px] font-bold bg-white transition hover:bg-blue-50/50"
          style={{ border: `2px solid ${VERIFY_BLUE}`, color: VERIFY_BLUE }}
        >
          Maybe Later
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="flex-1 py-3 rounded-full text-[14px] font-bold text-white transition hover:opacity-90"
          style={{ backgroundColor: VERIFY_BLUE }}
        >
          {continueLabel}
        </button>
      </div>
    </div>
  )
}

/** Popup 2 — method option card */
export function VerificationMethodCard({ icon: Icon, title, description, selected, disabled, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full flex items-center gap-4 rounded-2xl border-2 px-4 py-4 text-left transition ${
        disabled
          ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
          : selected
          ? 'hover:opacity-95'
          : 'border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50/30'
      }`}
      style={
        selected && !disabled
          ? { borderColor: VERIFY_BLUE, backgroundColor: VERIFY_BLUE_LIGHT }
          : undefined
      }
    >
      <div
        className="h-12 w-12 rounded-full flex items-center justify-center shrink-0"
        style={
          selected
            ? { backgroundColor: VERIFY_BLUE }
            : { backgroundColor: '#EEF4FF' }
        }
      >
        <Icon
          className="h-5 w-5"
          style={{ color: selected ? '#fff' : VERIFY_BLUE }}
          strokeWidth={2}
        />
      </div>
      <div className="min-w-0">
        <p className="text-[14px] font-bold text-gray-900">{title}</p>
        <p className="text-[12px] text-gray-500 mt-0.5 leading-relaxed">{description}</p>
      </div>
    </button>
  )
}

/** Popup 2 — method selection body */
export function VerificationMethodBody({ hint, children }) {
  return (
    <div className="px-6 pb-7 pt-2 space-y-4">
      <div
        className="rounded-xl border-2 border-dashed p-4"
        style={{ borderColor: '#C7D7FF', backgroundColor: VERIFY_BLUE_LIGHT }}
      >
        <p className="text-[14px] font-bold text-gray-900 mb-1">Please select an option</p>
        <p className="text-[12px] text-gray-500 leading-relaxed">
          {hint ||
            'To change sensitive information like your password or email, please choose a verification method to confirm your identity.'}
        </p>
      </div>
      {children}
    </div>
  )
}

export function VerificationPrimaryButton({ children, disabled, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-3.5 rounded-full text-[14px] font-bold text-white transition disabled:opacity-50 ${className}`}
      style={{ backgroundColor: VERIFY_BLUE }}
    >
      {children}
    </button>
  )
}

export function VerificationOutlineButton({ children, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-3 rounded-full text-[14px] font-bold bg-white transition hover:bg-blue-50/50 ${className}`}
      style={{ border: `2px solid ${VERIFY_BLUE}`, color: VERIFY_BLUE }}
    >
      {children}
    </button>
  )
}
