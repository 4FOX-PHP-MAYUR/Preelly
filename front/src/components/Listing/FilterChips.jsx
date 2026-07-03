import { memo } from 'react'

export function FilterChip({ label, active, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-2 text-sm font-medium transition ${
        active
          ? 'bg-brand text-white shadow-sm shadow-brand/25'
          : 'bg-white text-[#64748B] ring-1 ring-[#E4E7EF] hover:text-brand hover:ring-brand/30'
      } ${className}`}
    >
      {label}
    </button>
  )
}

function FilterChips({ options = [], value = '', onChange, allowAny = true, anyLabel = 'Any' }) {
  return (
    <div className="flex flex-wrap gap-2">
      {allowAny ? (
        <FilterChip label={anyLabel} active={!value} onClick={() => onChange?.('')} />
      ) : null}
      {options.map((opt) => {
        const optValue = typeof opt === 'string' ? opt : opt.value
        const optLabel = typeof opt === 'string' ? opt : opt.label
        return (
          <FilterChip
            key={String(optValue)}
            label={optLabel}
            active={String(value) === String(optValue)}
            onClick={() => onChange?.(optValue)}
          />
        )
      })}
    </div>
  )
}

export default memo(FilterChips)
