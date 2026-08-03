function formatExcelDate(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().replace('T', ' ').slice(0, 19)
}

/** Flat rows for Excel export — column order matches the admin list plus required export fields. */
function toAdminProductExcelRows(items = []) {
  return (items || []).map((p) => ({
    'Product ID': String(p._id || ''),
    'Product Name': p.title || '',
    Category: p.category?.name || '',
    Subcategory: p.subcategory?.name || '',
    'Seller Name': p.seller?.name || '',
    'Seller Email': p.seller?.email || '',
    Price: typeof p.price === 'number' ? p.price : '',
    Location: p.location || '',
    'Uploaded By': p.productAddType || 'web',
    Status: p.status || '',
    'Featured Status': p.isFeature ? 'Featured' : 'Not Featured',
    'Created Date': formatExcelDate(p.createdAt),
  }))
}

module.exports = { toAdminProductExcelRows }
