/**
 * Admin category tree import from Excel (Brand, Model, Variant columns).
 * Supports anchoring under a specific category at any level via targetCategoryId.
 */

const { Types } = require('mongoose')
const XLSX = require('xlsx')
const fs = require('fs')
const slugify = require('slugify')

/**
 * @param {object} opts
 * @param {string} opts.filePath
 * @param {object} opts.body - rootCategoryId, rootCategoryName, subCategoryId, targetCategoryId
 * @param {object} opts.Category - mongoose model
 */
async function importCategoriesFromExcel({ filePath, body, Category }) {
  const errors = []
  const workbook = XLSX.readFile(filePath, {
    cellDates: false,
    cellNF: false,
    cellText: false,
  })

  const sheetName = workbook.SheetNames.includes('New Cars') ? 'New Cars' : workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    const err = new Error(`Sheet "${sheetName}" not found in file`)
    err.statusCode = 400
    throw err
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  if (!rows || rows.length < 2) {
    const err = new Error('File has no data rows')
    err.statusCode = 400
    throw err
  }

  const dataRowCount = rows.length - 1
  let successRows = 0
  let failedRows = 0

  const cache = new Map()
  const makeSlug = (name) => slugify(String(name || ''), { lower: true, strict: true, trim: true })

  const findOrCreate = async ({ name, level, parentId }) => {
    if (!name || !String(name).trim()) {
      throw new Error('Invalid category name')
    }
    const slug = makeSlug(name)
    const parentKey = parentId ? String(parentId) : 'root'
    const key = `${level}:${parentKey}:${slug}`
    if (cache.has(key)) return cache.get(key)

    const query = {
      slug,
      parentId: parentId || null,
      level,
      isDeleted: { $ne: true },
    }
    let doc = await Category.findOne(query).lean()
    if (!doc) {
      const base = new Category({
        name: String(name).trim(),
        slug,
        parentId: parentId || null,
        level,
        isActive: true,
        isDeleted: false,
      })
      await base.save()
      doc = base.toObject()
    }
    cache.set(key, doc)
    return doc
  }

  const { rootCategoryId, rootCategoryName, subCategoryId, targetCategoryId } = body || {}

  let sheetParent = null

  // Priority: explicit target category (any level) — matches "import at selected category level"
  if (targetCategoryId && String(targetCategoryId).trim()) {
    if (!Types.ObjectId.isValid(String(targetCategoryId))) {
      const err = new Error('Invalid targetCategoryId')
      err.statusCode = 400
      throw err
    }
    sheetParent = await Category.findOne({
      _id: targetCategoryId,
      isDeleted: { $ne: true },
    }).lean()
    if (!sheetParent) {
      const err = new Error('Target category not found or deleted')
      err.statusCode = 400
      throw err
    }
  } else {
    let rootCategory = null
    if (rootCategoryId) {
      if (!Types.ObjectId.isValid(String(rootCategoryId))) {
        const err = new Error('Invalid rootCategoryId')
        err.statusCode = 400
        throw err
      }
      rootCategory = await Category.findOne({
        _id: rootCategoryId,
        parentId: null,
        isDeleted: { $ne: true },
      }).lean()
      if (!rootCategory) {
        const err = new Error('Root category not found')
        err.statusCode = 400
        throw err
      }
    } else {
      const rootName =
        typeof rootCategoryName === 'string' && rootCategoryName.trim() ? rootCategoryName.trim() : 'Motors'
      const rootSlug = makeSlug(rootName)
      rootCategory = await Category.findOne({
        slug: rootSlug,
        parentId: null,
        isDeleted: { $ne: true },
      }).lean()
      if (!rootCategory) {
        const rootDoc = new Category({
          name: rootName,
          slug: rootSlug,
          parentId: null,
          level: 0,
          isActive: true,
          isDeleted: false,
        })
        await rootDoc.save()
        rootCategory = rootDoc.toObject()
      }
    }

    if (subCategoryId) {
      if (!Types.ObjectId.isValid(String(subCategoryId))) {
        const err = new Error('Invalid subCategoryId')
        err.statusCode = 400
        throw err
      }
      sheetParent = await Category.findOne({
        _id: subCategoryId,
        parentId: rootCategory._id,
        isDeleted: { $ne: true },
      }).lean()
      if (!sheetParent) {
        const err = new Error('Sub category not found under selected root category')
        err.statusCode = 400
        throw err
      }
    } else {
      const sheetParentName = sheetName
      const sheetParentSlug = makeSlug(sheetParentName)
      sheetParent = await Category.findOne({
        slug: sheetParentSlug,
        parentId: rootCategory._id,
        isDeleted: { $ne: true },
      }).lean()
      if (!sheetParent) {
        const sheetDoc = new Category({
          name: sheetParentName,
          slug: sheetParentSlug,
          parentId: rootCategory._id,
          level: (rootCategory.level || 0) + 1,
          isActive: true,
          isDeleted: false,
        })
        await sheetDoc.save()
        sheetParent = sheetDoc.toObject()
      }
    }
  }

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue
    const brand = String(row[0] || '').trim()
    const model = String(row[1] || '').trim()
    const variant = String(row[2] || '').trim()

    if (!brand && !model && !variant) continue

    if (!brand && (model || variant)) {
      errors.push({ row: i + 1, message: 'Brand (column A) is required when Model or Variant is provided' })
      failedRows++
      continue
    }

    try {
      const brandDoc = await findOrCreate({
        name: brand,
        level: (Number(sheetParent.level) || 0) + 1,
        parentId: sheetParent._id,
      })

      let modelDoc = null
      if (model) {
        modelDoc = await findOrCreate({
          name: model,
          level: (Number(brandDoc.level) || 0) + 1,
          parentId: brandDoc._id,
        })
      }

      if (variant) {
        const parentForVariant = modelDoc ? modelDoc._id : brandDoc._id
        await findOrCreate({
          name: variant,
          level: (Number(modelDoc ? modelDoc.level : brandDoc.level) || 0) + 1,
          parentId: parentForVariant,
        })
      }
      successRows++
    } catch (e) {
      errors.push({ row: i + 1, message: e.message || 'Failed to import row' })
      failedRows++
    }
  }

  try {
    fs.unlinkSync(filePath)
  } catch (_) {}

  return {
    message: `Imported categories from ${sheetName}`,
    total: dataRowCount,
    success: successRows,
    failed: failedRows,
    errors,
    sheetName,
    anchorCategoryId: String(sheetParent._id),
  }
}

module.exports = {
  importCategoriesFromExcel,
}
