/**
 * Level labels for cascading category dropdowns by root category name.
 * Used by GET /api/categories/level-labels so frontend can get dynamic labels from backend.
 * Index 0 = first dropdown (root), 1 = second, etc.
 */
const CATEGORY_LEVEL_LABELS = {
  Electronics: ['Category', 'Sub Category', 'Brand', 'Model'],
  Vehicles: ['Category', 'Vehicle Type', 'Brand', 'Model', 'Variant'],
  Fashion: ['Category', 'Sub Category', 'Brand', 'Type'],
  Furniture: ['Category', 'Sub Category', 'Brand', 'Type'],
  'Home & Garden': ['Category', 'Sub Category', 'Brand', 'Type'],
}

const DEFAULT_LEVEL_LABELS = ['Category', 'Level 2', 'Level 3', 'Level 4', 'Level 5']

/**
 * Get dropdown labels for a root category name (case-insensitive).
 * @param {string} rootName - Root category name
 * @returns {string[]} Array of label strings
 */
function getLevelLabelsForRoot(rootName) {
  if (!rootName || typeof rootName !== 'string') return [...DEFAULT_LEVEL_LABELS]
  const trimmed = rootName.trim().toLowerCase()
  const key = Object.keys(CATEGORY_LEVEL_LABELS).find((k) => k.toLowerCase() === trimmed)
  const labels = key ? CATEGORY_LEVEL_LABELS[key] : null
  return labels ? [...labels] : [...DEFAULT_LEVEL_LABELS]
}

module.exports = {
  CATEGORY_LEVEL_LABELS,
  DEFAULT_LEVEL_LABELS,
  getLevelLabelsForRoot,
}
