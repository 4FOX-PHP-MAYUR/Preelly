function StickyFooter({ onApply, onReset, applyLabel = 'Apply Filter', resetLabel = 'Reset' }) {
  return (
    <div className="sticky bottom-0 -mx-5 mt-auto border-t border-[#E8EBF2] bg-white px-5 py-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onReset}
          className="text-sm font-semibold text-slate-500 transition hover:text-slate-800"
        >
          {resetLabel}
        </button>
        <button
          type="button"
          onClick={onApply}
          className="flex-1 rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-md shadow-brand/25 transition hover:bg-brand-700 hover:shadow-brand/35"
        >
          {applyLabel}
        </button>
      </div>
    </div>
  )
}

export default StickyFooter
