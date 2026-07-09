// Shared visual language for the "Additional Details" dynamic form — light rounded
// inputs and pill-style select buttons, matching the rest of the post-ad flow's redesign.

export function fieldInputClass(hasError) {
  const base =
    'w-full rounded-xl border bg-[#eef0f6] px-4 py-3 text-[15px] text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#2563eb]/25 focus:outline-none'
  return `${base} ${hasError ? 'border-red-400' : 'border-transparent'}`
}

export function pillOptionClass(selected) {
  const base = 'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors'
  return selected
    ? `${base} border-[#2563eb] bg-blue-50 text-[#2563eb]`
    : `${base} border-gray-300 bg-white text-gray-700 hover:border-gray-400`
}

export const VIEW_ALL_PILL_CLASS =
  'inline-flex items-center gap-2 rounded-full border border-[#2563eb] bg-white px-4 py-2 text-sm font-medium text-[#2563eb] hover:bg-blue-50'
