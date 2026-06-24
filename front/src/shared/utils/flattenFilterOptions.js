/**
 * Flatten hierarchical category filters into multiselect options.
 */

function collectDescendantOptions(nodeId, childrenByParent, byId, pathPrefix = []) {
  const node = byId.get(String(nodeId))
  if (!node) return []

  const path = [...pathPrefix, node.name || ''].filter(Boolean)
  const children = childrenByParent.get(String(nodeId)) || []

  if (!children.length) {
    return [{ value: String(node._id), label: path.join(' › ') }]
  }

  const options = []
  for (const child of children) {
    options.push(...collectDescendantOptions(String(child._id), childrenByParent, byId, path))
  }
  return options
}

/**
 * @param {object} root - filter root node
 * @param {Map<string, object[]>} childrenByParent
 * @param {Map<string, object>} byId
 * @returns {{ value: string, label: string }[]}
 */
export function flattenCascadeFilterOptions(root, childrenByParent, byId) {
  const rootId = String(root._id)
  const rootName = root.name || ''
  const children = childrenByParent.get(rootId) || []

  if (!children.length) {
    return rootName ? [{ value: rootId, label: rootName }] : []
  }

  const options = []
  for (const child of children) {
    options.push(...collectDescendantOptions(String(child._id), childrenByParent, byId, rootName ? [rootName] : []))
  }

  return options.sort((a, b) => a.label.localeCompare(b.label))
}

/**
 * Build multiselect options for a category filter root (explicit or cascade).
 */
export function buildFilterMultiselectOptions(root, childrenByParent, byId) {
  const explicitOptions = Array.isArray(root.options) ? root.options.filter(Boolean) : []
  if (explicitOptions.length) {
    return explicitOptions.map((opt) => ({ value: opt, label: opt }))
  }

  return flattenCascadeFilterOptions(root, childrenByParent, byId)
}
