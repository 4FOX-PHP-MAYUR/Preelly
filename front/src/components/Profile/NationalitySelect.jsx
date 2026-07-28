import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'

export const NATIONALITIES = [
  'Afghan', 'Albanian', 'Algerian', 'American', 'Andorran', 'Angolan', 'Argentine',
  'Armenian', 'Australian', 'Austrian', 'Azerbaijani', 'Bahraini', 'Bangladeshi',
  'Belarusian', 'Belgian', 'Belizean', 'Beninese', 'Bhutanese', 'Bolivian',
  'Bosnian', 'Brazilian', 'British', 'Bruneian', 'Bulgarian', 'Burundian',
  'Cambodian', 'Cameroonian', 'Canadian', 'Chilean', 'Chinese', 'Colombian',
  'Congolese', 'Costa Rican', 'Croatian', 'Cuban', 'Cypriot', 'Czech', 'Danish',
  'Djiboutian', 'Dominican', 'Dutch', 'Ecuadorian', 'Egyptian', 'Emirati',
  'Eritrean', 'Estonian', 'Ethiopian', 'Fijian', 'Finnish', 'French', 'Gabonese',
  'Gambian', 'Georgian', 'German', 'Ghanaian', 'Greek', 'Guatemalan', 'Guinean',
  'Haitian', 'Honduran', 'Hungarian', 'Icelandic', 'Indian', 'Indonesian',
  'Iranian', 'Iraqi', 'Irish', 'Italian', 'Ivorian', 'Jamaican', 'Japanese',
  'Jordanian', 'Kazakh', 'Kenyan', 'Korean', 'Kuwaiti', 'Kyrgyz', 'Laotian',
  'Latvian', 'Lebanese', 'Liberian', 'Libyan', 'Lithuanian', 'Luxembourgish',
  'Macedonian', 'Malagasy', 'Malaysian', 'Maldivian', 'Malian', 'Maltese',
  'Mexican', 'Moldovan', 'Mongolian', 'Montenegrin', 'Moroccan', 'Mozambican',
  'Myanmar', 'Namibian', 'Nepalese', 'New Zealander', 'Nicaraguan', 'Nigerian',
  'Norwegian', 'Omani', 'Pakistani', 'Palestinian', 'Panamanian', 'Paraguayan',
  'Peruvian', 'Filipino', 'Polish', 'Portuguese', 'Qatari', 'Romanian', 'Russian',
  'Rwandan', 'Saudi', 'Senegalese', 'Serbian', 'Singaporean', 'Slovak',
  'Slovenian', 'Somali', 'South African', 'Spanish', 'Sri Lankan', 'Sudanese',
  'Swedish', 'Swiss', 'Syrian', 'Taiwanese', 'Tajik', 'Tanzanian', 'Thai',
  'Togolese', 'Tunisian', 'Turkish', 'Turkmen', 'Ugandan', 'Ukrainian',
  'Uruguayan', 'Uzbek', 'Venezuelan', 'Vietnamese', 'Yemeni', 'Zambian',
  'Zimbabwean',
].map((label) => ({ label, value: label }))

export default function NationalitySelect({ value, onChange, placeholder = 'Search Nationality' }) {
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) return
    const onMouseDown = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return NATIONALITIES
    return NATIONALITIES.filter((o) => o.label.toLowerCase().includes(q))
  }, [query])

  const selected = NATIONALITIES.find((o) => o.value === value) || null

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-[12px] border border-[#E5E7EB] bg-white px-4 py-3.5 text-left transition duration-200 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand/10"
      >
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <span className={`min-w-0 flex-1 truncate text-sm ${selected ? 'text-slate-800' : 'text-slate-400'}`}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white shadow-lg">
          <div className="border-b border-[#E5E7EB] p-2">
            <div className="flex items-center gap-2 rounded-[10px] bg-slate-50 px-3 py-2">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
            </div>
          </div>
          <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-slate-400">No matches</li>
            ) : (
              filtered.map((option) => (
                <li key={option.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={option.value === value}
                    onClick={() => {
                      onChange?.(option.value)
                      setOpen(false)
                      setQuery('')
                    }}
                    className={`flex w-full px-4 py-2.5 text-left text-sm transition duration-150 hover:bg-brand-50 ${
                      option.value === value ? 'bg-brand-50 font-medium text-brand' : 'text-slate-700'
                    }`}
                  >
                    {option.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
