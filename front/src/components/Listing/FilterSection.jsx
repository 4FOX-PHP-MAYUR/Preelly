import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

function FilterSection({ title, children, defaultOpen = true, className = '' }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={`border-b border-[#E8EBF2] py-4 last:border-b-0 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-3 flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-[#0F172A]">{title}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? <div className="space-y-3">{children}</div> : null}
    </div>
  )
}

export default FilterSection
