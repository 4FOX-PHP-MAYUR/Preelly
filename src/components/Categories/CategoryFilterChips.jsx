const CHIPS = [
  { id: 'all', label: 'All Items' },
  { id: 'buy', label: 'Buy Now' },
  { id: 'rent', label: 'Rent' },
  { id: 'verified', label: 'Verified' },
  { id: 'featured', label: 'Featured' },
]

function CategoryFilterChips({ activeChip = 'all', onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {CHIPS.map((chip) => {
        const active = activeChip === chip.id
        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => onChange?.(chip.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              active
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:text-primary-700 hover:ring-primary-200'
            }`}
          >
            {chip.label}
          </button>
        )
      })}
    </div>
  )
}

export default CategoryFilterChips
