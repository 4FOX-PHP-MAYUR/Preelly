/**
 * Build UI groups from flat category filter list (same shape as Post Ad step).
 */
export function buildCategoryFilterGroups(filters) {
  const list = Array.isArray(filters) ? filters : []
  if (!list.length) return []

  const byId = new Map(list.map((f) => [String(f._id), f]))
  const childrenByParent = new Map()
  list.forEach((f) => {
    const pid = f.parentId ? String(f.parentId) : null
    if (!childrenByParent.has(pid)) childrenByParent.set(pid, [])
    childrenByParent.get(pid).push(f)
  })

  const roots = (childrenByParent.get(null) || [])
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  return roots
    .map((root) => {
      const rootId = String(root._id)
      const explicitOptions = Array.isArray(root.options) ? root.options.filter(Boolean) : []
      const children = (childrenByParent.get(rootId) || [])
        .slice()
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.name).localeCompare(String(b.name)))

      if (explicitOptions.length) {
        const options = explicitOptions.map((opt) => {
          const child = children.find((c) => String(c.name).trim() === String(opt).trim())
          return {
            value: child ? String(child._id) : String(opt),
            label: opt,
            filterId: child ? String(child._id) : null,
          }
        })
        return { root, mode: 'explicit', options }
      }

      if (children.length) {
        return {
          root,
          mode: 'children',
          options: children.map((c) => ({
            value: String(c._id),
            label: c.name,
            filterId: String(c._id),
          })),
        }
      }

      return null
    })
    .filter((g) => g && (g.options?.length || 0) > 0)
}
