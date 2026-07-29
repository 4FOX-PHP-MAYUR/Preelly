/**
 * Soft-archive helpers for Product documents.
 * Archives reuse the same Product row (status → inactive + metadata flags).
 */

function markProductArchived(productDoc, userId) {
  if (!productDoc) return
  productDoc.status = 'inactive'
  productDoc.isArchived = true
  productDoc.archivedAt = new Date()
  productDoc.archivedBy = userId || null
  productDoc.isSold = false
}

function clearProductArchive(productDoc, { status = 'active' } = {}) {
  if (!productDoc) return
  productDoc.status = status
  productDoc.isArchived = false
  productDoc.archivedAt = null
  productDoc.archivedBy = null
  if (status !== 'sold') productDoc.isSold = false
}

/**
 * Apply archive metadata when product status changes.
 * - inactive → mark archived
 * - leaving inactive/isArchived → clear archive flags
 */
function syncArchiveFieldsFromStatus(productDoc, nextStatus, userId) {
  if (!productDoc || !nextStatus) return
  const status = String(nextStatus).trim()
  if (status === 'inactive') {
    markProductArchived(productDoc, userId)
    return
  }
  if (productDoc.isArchived || productDoc.status === 'inactive') {
    // Leaving archive: clear metadata; caller already set status
    productDoc.isArchived = false
    productDoc.archivedAt = null
    productDoc.archivedBy = null
  }
}

module.exports = {
  markProductArchived,
  clearProductArchive,
  syncArchiveFieldsFromStatus,
}
