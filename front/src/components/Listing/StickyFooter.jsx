function StickyFooter({ onApply, onReset, applyLabel = 'Apply Filter', resetLabel = 'Reset' }) {
  return (
    <div className="sticky bottom-0 -mx-5 mt-auto rounded-t-2xl border-t border-[#E8EBF2] bg-white px-5 py-4 shadow-[0_-6px_20px_-12px_rgba(15,23,42,0.25)]">
      <div className="mx-auto flex w-[85%] items-center gap-3">
        <button
          type="button"
          onClick={onReset}
          className="flex-1 rounded-full bg-brand-50 py-3 text-base font-semibold text-brand transition hover:bg-brand-100"
        >
          {resetLabel}
        </button>
        <button
          type="button"
          onClick={onApply}
          className="flex-1 rounded-full bg-brand py-3 text-base font-semibold text-white transition hover:bg-brand-700"
        >
          {applyLabel}
        </button>
      </div>
    </div>
  )
}

export default StickyFooter
