/**
 * Build a nested category tree for admin filter UI / dropdowns.
 * Single-pass: O(n) over flat categories.
 *
 * Response shape (per product requirements):
 * {
 *   categories: [
 *     {
 *       id, name, slug, level, parentId,
 *       subcategories: [
 *         { id, name, slug, level, parentId, children: [ recursive ... ] }
 *       ]
 *     }
 *   ]
 * }
 */

function sortCats(a, b) {
  const so = Number(a.sortOrder || 0) - Number(b.sortOrder || 0)
  if (so !== 0) return so
  return String(a.name || '').localeCompare(String(b.name || ''))
}

/**
 * @param {Array<object>} flat - lean Category docs
 * @returns {{ categories: Array }}
 */
function buildNestedCategoryTreeForFilters(flat) {
  if (!flat || !flat.length) return { categories: [] }

  const mapByParent = new Map()
  for (const c of flat) {
    const pkey = c.parentId ? String(c.parentId) : '__root__'
    if (!mapByParent.has(pkey)) mapByParent.set(pkey, [])
    mapByParent.get(pkey).push(c)
  }
  for (const [, arr] of mapByParent) arr.sort(sortCats)

  const toNode = (c) => ({
    id: String(c._id),
    name: c.name,
    slug: c.slug,
    level: typeof c.level === 'number' ? c.level : 0,
    parentId: c.parentId ? String(c.parentId) : null,
    emoji: c.emoji || undefined,
    icon: c.icon || undefined,
    sortOrder: c.sortOrder,
  })

  function buildChildrenRecursive(cat) {
    const kids = mapByParent.get(String(cat._id)) || []
    if (!kids.length) return null
    return kids.map((ch) => {
      const deeper = buildChildrenRecursive(ch)
      const node = toNode(ch)
      if (deeper && deeper.length) node.children = deeper
      return node
    })
  }

  const roots = mapByParent.get('__root__') || []
  const categories = roots.map((root) => {
    const direct = mapByParent.get(String(root._id)) || []
    const subcategories = direct.map((ch) => {
      const deeper = buildChildrenRecursive(ch)
      const node = toNode(ch)
      if (deeper && deeper.length) node.children = deeper
      return node
    })
    const out = toNode(root)
    if (subcategories.length) out.subcategories = subcategories
    return out
  })

  return { categories }
}

module.exports = {
  buildNestedCategoryTreeForFilters,
}
