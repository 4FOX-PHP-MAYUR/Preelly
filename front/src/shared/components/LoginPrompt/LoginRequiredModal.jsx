import ModalDialog from '../../../components/ui/ModalDialog'

/**
 * Shared confirmation modal shown instead of an immediate redirect whenever a
 * guest/unauthenticated user attempts a protected action (like, comment,
 * chat, follow, save, report, make offer, post ad, etc).
 */
function LoginRequiredModal({ open, message, onLogin, onClose }) {
  return (
    <ModalDialog open={open} onClose={onClose} title="Login Required" maxWidthClass="sm:max-w-sm">
      <p className="py-2 text-center text-[15px] leading-relaxed text-slate-600">
        {message || 'You need to log in to perform this action. Would you like to log in now?'}
      </p>
      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-full border border-[#e7e9f2] px-6 py-3 text-base font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onLogin}
          className="flex-1 rounded-full bg-[#1400ff] px-6 py-3 text-base font-semibold text-white shadow-[0_18px_40px_rgba(20,0,255,0.25)] transition hover:bg-[#1000d6]"
        >
          Login
        </button>
      </div>
    </ModalDialog>
  )
}

export default LoginRequiredModal
