import { memo, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import DualRangeSlider from './DualRangeSlider'

function formatAed(value) {
  const n = Number(value) || 0
  return `AED ${n.toLocaleString('en-US')}`
}

function PriceInput({ value, onChange, placeholder = '0' }) {
  return (
    <div className="flex min-w-0 flex-1 items-center rounded-full border border-[#E4E7EF] bg-white px-4 py-3">
      <span className="shrink-0 text-sm font-medium text-[#94A3B8]">AED</span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value.replace(/[^\d]/g, ''))}
        className="min-w-0 flex-1 border-0 bg-transparent pl-2 text-right text-sm font-semibold text-[#0F172A] outline-none"
      />
    </div>
  )
}

function parseInput(value, fallback) {
  if (value === '' || value == null) return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function PriceFilterPanel({
  className = '',
  showClose = false,
  onClose,
  closing = false,
  min = 0,
  max = 100000,
  valueMin,
  valueMax,
  onApply,
}) {
  const safeMin = Math.min(min, max)
  const safeMax = Math.max(min, max)
  const initialMin = valueMin ?? safeMin
  const initialMax = valueMax ?? safeMax

  const [localMin, setLocalMin] = useState(initialMin)
  const [localMax, setLocalMax] = useState(initialMax)
  const [minInput, setMinInput] = useState(String(initialMin))
  const [maxInput, setMaxInput] = useState(String(initialMax))
  const [error, setError] = useState('')
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    const nextMin = valueMin ?? safeMin
    const nextMax = valueMax ?? safeMax
    setLocalMin(nextMin)
    setLocalMax(nextMax)
    setMinInput(String(nextMin))
    setMaxInput(String(nextMax))
    setError('')
  }, [valueMin, valueMax, safeMin, safeMax])

  useEffect(() => {
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setEntered(true))
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [])

  const handleRangeChange = (lo, hi) => {
    setLocalMin(lo)
    setLocalMax(hi)
    setMinInput(String(lo))
    setMaxInput(String(hi))
    setError('')
  }

  const handleApply = () => {
    const parsedMin = parseInput(minInput, null)
    const parsedMax = parseInput(maxInput, null)

    if (parsedMin == null || parsedMax == null) {
      setError('Please enter valid amounts in both fields.')
      return
    }

    if (parsedMin < safeMin || parsedMax > safeMax) {
      setError(`Amounts must be between ${formatAed(safeMin)} and ${formatAed(safeMax)}.`)
      return
    }

    let lo = parsedMin
    let hi = parsedMax

    if (lo > hi) {
      setError('Minimum amount cannot be greater than maximum amount.')
      return
    }

    setLocalMin(lo)
    setLocalMax(hi)
    setMinInput(String(lo))
    setMaxInput(String(hi))
    setError('')
    onApply?.(lo, hi)
  }

  const headerMin = parseInput(minInput, localMin) ?? localMin
  const headerMax = parseInput(maxInput, localMax) ?? localMax

  const slideClass = !entered || closing ? 'translate-x-full' : 'translate-x-0'

  return (
    <div
      className={`flex h-full transform flex-col bg-white transition-transform duration-300 ease-in-out ${slideClass} ${className}`}
    >
      <div className="flex shrink-0 items-start justify-between border-b border-[#E8EBF2] px-5 py-5">
        <h2 className="text-2xl font-bold leading-tight text-[#0F172A]">
          {formatAed(headerMin)} - {formatAed(headerMax)}
        </h2>
        {showClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-[#64748B] transition hover:bg-brand/5 hover:text-brand"
            aria-label="Close price filter"
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
        <DualRangeSlider
          min={safeMin}
          max={safeMax}
          valueMin={localMin}
          valueMax={localMax}
          onChange={handleRangeChange}
          prefix="AED "
        />

        <div className="mt-8">
          <p className="mb-4 text-base font-bold text-[#0F172A]">Popular Price Range</p>
          <div className="flex gap-3">
            <PriceInput value={minInput} onChange={setMinInput} />
            <PriceInput value={maxInput} onChange={setMaxInput} />
          </div>
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        </div>
      </div>

      <div className="sticky bottom-0 rounded-t-2xl border-t border-[#E8EBF2] bg-white px-5 py-4 shadow-[0_-6px_20px_-12px_rgba(15,23,42,0.25)]">
        <button
          type="button"
          onClick={handleApply}
          className="mx-auto block w-[85%] rounded-full bg-brand py-3 text-base font-semibold text-white transition hover:bg-brand-700"
        >
          Apply
        </button>
      </div>
    </div>
  )
}

export default memo(PriceFilterPanel)
