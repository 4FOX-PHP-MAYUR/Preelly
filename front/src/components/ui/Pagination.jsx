export default function Pagination({ page, totalPages, total, onPageChange, itemLabel = 'items' }) {
  if (totalPages <= 1) return null

  return (
    <div className="mt-6 flex items-center justify-between">
      <p className="text-xs text-slate-400">
        Page {page} of {totalPages}
        {total ? ` · ${total} ${itemLabel}` : ''}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-[12px] border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-slate-600 transition duration-200 hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
        >
          Prev
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-[12px] border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-slate-600 transition duration-200 hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  )
}
