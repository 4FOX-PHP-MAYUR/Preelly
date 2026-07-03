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
                ? 'bg-brand text-white shadow-sm shadow-brand/25'
                : 'bg-white text-[#64748B] ring-1 ring-[#E4E7EF] hover:text-brand hover:ring-brand/30'
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
