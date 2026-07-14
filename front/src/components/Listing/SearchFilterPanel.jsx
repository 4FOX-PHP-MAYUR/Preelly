import { memo, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { categoryService } from '@shared/services/api'

const FALLBACK_CITIES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah']

function FilterSection({ title, children }) {
  return (
    <div className="border-b border-[#E8EBF2] py-4 last:border-b-0">
      <p className="mb-3 text-sm font-semibold text-[#0F172A]">{title}</p>
      {children}
    </div>
  )
}

function Chip({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active
          ? 'bg-brand text-white shadow-sm shadow-brand/20'
          : 'bg-[#F1F5F9] text-[#475569] hover:bg-[#E8EBF2]'
      }`}
    >
      {children}
    </button>
  )
}

function SearchFilterPanel({
  className = '',
  showClose = false,
  onClose,
  closing = false,
  categoryId,
  city,
  onCityChange,
  minPrice,
  maxPrice,
  priceMin,
  priceMax,
  onPriceChange,
  keywords,
  onKeywordsChange,
  subcategoryId,
  onSubcategoryChange,
  onApply,
  onReset,
}) {
  const [subcategories, setSubcategories] = useState([])
  const [slider, setSlider] = useState({ min: priceMin, max: priceMax })
  const [entered, setEntered] = useState(false)

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

  useEffect(() => {
    setSlider({ min: priceMin, max: priceMax })
  }, [priceMin, priceMax])

  useEffect(() => {
    if (!categoryId) {
      setSubcategories([])
      return
    }
    categoryService
      .getCategoryChildren(categoryId)
      .then((res) => setSubcategories(Array.isArray(res.data) ? res.data : []))
      .catch(() => setSubcategories([]))
  }, [categoryId])

  const slideClass = !entered || closing ? 'translate-x-full' : 'translate-x-0'

  return (
    <div
      className={`flex h-full transform flex-col bg-white transition-transform duration-300 ease-in-out ${slideClass} ${className}`}
    >
      <div className="flex items-center justify-between border-b border-[#E8EBF2] px-4 py-4">
        <div>
          <p className="text-base font-bold text-[#0F172A]">Advanced Filter</p>
          <p className="text-xs text-[#64748B]">Refine your search results</p>
        </div>
        {showClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close filters"
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto px-4">
        <FilterSection title="City">
          <div className="flex flex-wrap gap-2">
            {FALLBACK_CITIES.map((name) => (
              <Chip key={name} active={city === name} onClick={() => onCityChange?.(city === name ? '' : name)}>
                {name}
              </Chip>
            ))}
          </div>
        </FilterSection>

        {subcategories.length > 0 ? (
          <FilterSection title="Sub Category">
            <div className="flex flex-wrap gap-2">
              {subcategories.map((sub) => (
                <Chip
                  key={sub._id}
                  active={String(subcategoryId) === String(sub._id)}
                  onClick={() =>
                    onSubcategoryChange?.(String(subcategoryId) === String(sub._id) ? '' : sub._id)
                  }
                >
                  {sub.name}
                </Chip>
              ))}
            </div>
          </FilterSection>
        ) : null}

        <FilterSection title="Price Range">
          <div className="mb-3 flex items-center justify-between text-xs font-medium text-[#64748B]">
            <span>AED {slider.min.toLocaleString()}</span>
            <span>AED {slider.max.toLocaleString()}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              value={slider.min}
              min={priceMin}
              max={slider.max}
              onChange={(e) => {
                const next = Math.min(Number(e.target.value) || priceMin, slider.max)
                setSlider((s) => ({ ...s, min: next }))
              }}
              className="rounded-xl border border-[#E4E7EF] px-3 py-2 text-sm outline-none focus:border-brand"
              placeholder="Min"
            />
            <input
              type="number"
              value={slider.max}
              min={slider.min}
              max={priceMax}
              onChange={(e) => {
                const next = Math.max(Number(e.target.value) || priceMax, slider.min)
                setSlider((s) => ({ ...s, max: next }))
              }}
              className="rounded-xl border border-[#E4E7EF] px-3 py-2 text-sm outline-none focus:border-brand"
              placeholder="Max"
            />
          </div>
          <button
            type="button"
            onClick={() => onPriceChange?.(slider.min, slider.max)}
            className="mt-3 text-xs font-semibold text-brand hover:text-brand-700"
          >
            Apply price range
          </button>
        </FilterSection>

        <FilterSection title="Keywords">
          <input
            type="search"
            value={keywords}
            onChange={(e) => onKeywordsChange?.(e.target.value)}
            placeholder="Search within results"
            className="w-full rounded-xl border border-[#E4E7EF] px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
        </FilterSection>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-[#E8EBF2] bg-white p-4">
        <button
          type="button"
          onClick={onReset}
          className="rounded-full border border-[#E4E7EF] bg-white px-4 py-2.5 text-sm font-semibold text-[#475569] transition hover:bg-slate-50"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={onApply}
          className="rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand/25 transition hover:bg-brand-700"
        >
          Apply Filter
        </button>
      </div>
    </div>
  )
}

export default memo(SearchFilterPanel)
