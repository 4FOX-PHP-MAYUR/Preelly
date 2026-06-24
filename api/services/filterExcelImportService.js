/**
 * Filter Excel import: parse, validate and insert hierarchical filters.
 * Expected columns:
 *  - name
 *  - parent_name (optional)
 *  - category_name
 *  - subcategory_name
 *  - child_category_name (optional)
 */

const { Types } = require('mongoose')
const XLSX = require('xlsx')
const fs = require('fs')

function makeSlug(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[\s\W-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeHeader(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function normalizeName(input) {
  // Normalize for matching category names from Excel:
  // - trim + lowercase
  // - remove all whitespace (including non-breaking spaces)
  return String(input || '')
    .replace(/\u00a0/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
}

function idOrNull(value) {
  return value ? new Types.ObjectId(String(value)) : null
}

/**
 * @param {object} opts
 * @param {string} opts.filePath
 * @param {string|null} opts.assignCategoryId - fallback selected level id from UI
 * @param {object} opts.models - { Filter, Category, CategoryFilter }
 * @param {function} [opts.log] - (level, msg, meta?) => void
 */
async function importFiltersFromExcel({ filePath, assignCategoryId, models, log = () => {} }) {
  const { Filter, Category, CategoryFilter } = models
  const errors = []
  let fallbackScope = null
  let fallbackLevelCategoryId = null
  let selectedLevelCategoryDoc = null
  let legacyTargetLevelIds = []

  try {
    if (assignCategoryId) {
      if (!Types.ObjectId.isValid(String(assignCategoryId))) {
        const err = new Error('Invalid categoryId')
        err.statusCode = 400
        throw err
      }
      const selectedCategory = await Category.findOne({
        _id: assignCategoryId,
        isDeleted: { $ne: true },
      })
        .select('_id name parentId path level')
        .lean()
      if (!selectedCategory) {
        const err = new Error('Category not found or deleted')
        err.statusCode = 400
        throw err
      }

      // IMPORTANT:
      // Existing categories may have stale/empty `path` values.
      // For reliability, build the ancestor chain using `parentId` and only fall back to `path`
      // if parentId traversal isn't possible.
      const chainFromParentIds = []
      {
        let cur = selectedCategory
        const seen = new Set()
        while (cur && cur._id) {
          const curIdStr = String(cur._id)
          if (seen.has(curIdStr)) break
          seen.add(curIdStr)
          chainFromParentIds.push(curIdStr)
          if (!cur.parentId) break
          // parentId traversal only needed for a few levels; keep it simple/robust.
          // eslint-disable-next-line no-await-in-loop
          cur = await Category.findById(cur.parentId).select('_id parentId').lean()
        }
      }

      const chain =
        chainFromParentIds.length >= 1
          ? chainFromParentIds.reverse()
          : [...(selectedCategory.path || []), selectedCategory._id].map((id) => String(id))

      fallbackScope = {
        categoryId: chain[0] || null,
        subcategoryId: chain[1] || null,
        childCategoryId: chain[2] || null,
      }
      fallbackLevelCategoryId = String(selectedCategory._id)
      selectedLevelCategoryDoc = selectedCategory

      // Legacy "Type/Filters/Properties" import should apply ONLY to the
      // category level the user selected in the UI (single target).
      // This avoids importing the same data into every sibling Level-2 category.
      legacyTargetLevelIds = [String(selectedCategory._id)]
      log('info', 'filter_import:fallback_scope', {
        selectedCategoryId: fallbackLevelCategoryId,
        selectedCategoryName: selectedCategory.name,
        fallbackScope,
        legacyTargetLevelIds,
      })
    }

    const workbook = XLSX.readFile(filePath, {
      cellDates: false,
      cellNF: false,
      cellText: false,
    })
    const sheetName = workbook.SheetNames.includes('Filters') ? 'Filters' : workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) {
      const err = new Error(`Sheet "${sheetName}" not found in file`)
      err.statusCode = 400
      throw err
    }

    const sheetRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
    if (!sheetRows || !sheetRows.length) {
      const err = new Error('File has no data rows')
      err.statusCode = 400
      throw err
    }

    const firstRow = Array.isArray(sheetRows[0]) ? sheetRows[0] : []
    const headerIndexByKey = new Map()
    for (let i = 0; i < firstRow.length; i++) {
      const key = normalizeHeader(firstRow[i])
      if (!key) continue
      if (!headerIndexByKey.has(key)) headerIndexByKey.set(key, i)
    }

    // Detect "legacy" sheet in a very robust way.
    //
    // Legacy layouts seen in the wild:
    // - 3-column: Type | Filters | Properties
    // - 2-column: Filters | Properties
    //
    // If we mis-detect a 2-column legacy sheet as 3-column, we shift columns and end up
    // treating Properties as missing, which then looks like a "separator row" and gets skipped.
    const hasLegacyHeaders3 =
      (headerIndexByKey.has('type') || headerIndexByKey.has('types')) &&
      (headerIndexByKey.has('filters') || headerIndexByKey.has('filter')) &&
      (headerIndexByKey.has('properties') || headerIndexByKey.has('property'))
    const hasLegacyHeaders2 =
      !hasLegacyHeaders3 &&
      (headerIndexByKey.has('filters') || headerIndexByKey.has('filter')) &&
      (headerIndexByKey.has('properties') || headerIndexByKey.has('property'))

    const legacyShape = hasLegacyHeaders3 ? 'type_filters_properties' : hasLegacyHeaders2 ? 'filters_properties' : null

    const typeIdx =
      legacyShape === 'type_filters_properties'
        ? (headerIndexByKey.get('type') ?? headerIndexByKey.get('types'))
        : legacyShape ? null : 0
    const filtersIdx =
      legacyShape === 'type_filters_properties' || legacyShape === 'filters_properties'
        ? (headerIndexByKey.get('filters') ?? headerIndexByKey.get('filter'))
        : 1
    const propertiesIdx =
      legacyShape === 'type_filters_properties' || legacyShape === 'filters_properties'
        ? (headerIndexByKey.get('properties') ?? headerIndexByKey.get('property'))
        : 2

    let normalizedRows = []

    // Legacy positional parsing path.
    // If we have at least 2 columns, we can parse a legacy sheet (2-col or 3-col).
    // Otherwise fall back to JSON-key based parsing.
    const canParseLegacyByPosition = firstRow.length >= 2 || sheetRows.some((r) => Array.isArray(r) && r.length >= 2)

    if (canParseLegacyByPosition) {
      log('debug', 'filter_import:legacy_header_indices', {
        mode: legacyShape ? 'header' : 'positional',
        legacyShape: legacyShape || 'unknown',
        typeIdx,
        filtersIdx,
        propertiesIdx,
        detectedHeaders: Array.from(headerIndexByKey.keys()),
      })

      // Decide whether first row is header or data.
      // If it contains "type/filters/properties" (after normalization), treat as header.
      const looksLikeHeader = !!legacyShape

      // Legacy sheet:
      // - 3-column: Column A ("Type") -> label in file (not relied on for mapping), Column B -> parent filter, Column C -> property/value
      // - 2-column: Column A ("Filters") -> parent filter, Column B ("Properties") -> property/value
      let carryType = ''
      let carryFilter = ''
      const body = looksLikeHeader ? sheetRows.slice(1) : sheetRows
      normalizedRows = body.map((row, bodyIdx) => {
        const excelRow = (looksLikeHeader ? bodyIdx + 2 : bodyIdx + 1)
        const rawType = typeIdx == null ? '' : String(row[typeIdx] ?? '').trim()
        const rawFilters = String(row[filtersIdx] ?? '').trim()
        const rawProperties = String(row[propertiesIdx] ?? '').trim()

        if (rawType) carryType = rawType
        if (rawFilters) carryFilter = rawFilters

        return {
          excelRow,
          name: rawProperties,
          parentName: rawFilters || carryFilter || '',
          categoryName: '',
          subcategoryName: rawType || carryType || '',
          childCategoryName: '',
          __format: 'legacy',
        }
      })
    } else {
      // New template (header-based mapping). We keep the original key-based mapping for this case.
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
      if (!rows.length) {
        const err = new Error('File has no data rows')
        err.statusCode = 400
        throw err
      }

      const canonicalRows = rows.map((row, idx) => {
        const canon = {}
        for (const [key, value] of Object.entries(row || {})) {
          canon[normalizeHeader(key)] = value
        }
        return { canon, excelRow: idx + 2 }
      })

      const isLegacySheet = canonicalRows.some(
        ({ canon }) =>
          Object.prototype.hasOwnProperty.call(canon, 'type') ||
          Object.prototype.hasOwnProperty.call(canon, 'filters') ||
          Object.prototype.hasOwnProperty.call(canon, 'properties'),
      )

      let carryType = ''
      let carryFilter = ''
      normalizedRows = canonicalRows.map(({ canon, excelRow }) => {
        const rawType = String(canon.type ?? '').trim()
        const rawFilters = String(canon.filters ?? '').trim()
        const rawProperties = String(canon.properties ?? '').trim()

        if (rawType) carryType = rawType
        if (rawFilters) carryFilter = rawFilters

        if (isLegacySheet) {
          return {
            excelRow,
            name: rawProperties,
            parentName: rawFilters || carryFilter || '',
            categoryName: String(canon.category_name ?? canon.category ?? '').trim(),
            subcategoryName: String(
              canon.subcategory_name ?? canon.sub_category_name ?? rawType ?? carryType ?? '',
            ).trim(),
            childCategoryName: String(
              canon.child_category_name ?? canon.childcategory_name ?? canon.child_category ?? '',
            ).trim(),
          }
        }

        return {
          excelRow,
          name: String(canon.name ?? canon.filter_name ?? canon.filters ?? '').trim(),
          parentName: String(canon.parent_name ?? canon.parent ?? '').trim(),
          categoryName: String(canon.category_name ?? canon.category ?? '').trim(),
          subcategoryName: String(canon.subcategory_name ?? canon.sub_category_name ?? '').trim(),
          childCategoryName: String(
            canon.child_category_name ?? canon.childcategory_name ?? canon.child_category ?? '',
          ).trim(),
        }
      })
    }

    const totalRows = normalizedRows.length

    const categories = await Category.find({ isDeleted: { $ne: true } })
      .select('_id name parentId')
      .lean()
    const byParentId = new Map()
    const byNormalizedName = new Map()
    for (const c of categories) {
      const key = c.parentId ? String(c.parentId) : '__root__'
      if (!byParentId.has(key)) byParentId.set(key, [])
      byParentId.get(key).push(c)
      const norm = normalizeName(c.name)
      if (!byNormalizedName.has(norm)) byNormalizedName.set(norm, [])
      byNormalizedName.get(norm).push(c)
    }

    const findCategoryByName = (name, parentId) => {
      const key = parentId ? String(parentId) : '__root__'
      const pool = byParentId.get(key) || []
      const wanted = normalizeName(name)
      if (!wanted) return null
      return pool.find((c) => normalizeName(c.name) === wanted) || null
    }

    const resolvedRows = []
    let skippedEmptyRows = 0

    for (const row of normalizedRows) {
      log('debug', 'filter_import:row_read', {
        row: row.excelRow,
        name: row.name || null,
        parent: row.parentName || null,
        category: row.categoryName || null,
        subcategory: row.subcategoryName || null,
        childCategory: row.childCategoryName || null,
      })

      // For legacy sheets, do not attempt DB lookups by name.
      // Always map to the selected category level (assignCategoryId).
      if (row.__format === 'legacy') {
        if (!legacyTargetLevelIds.length) {
          errors.push({
            row: row.excelRow,
            message: 'Select a category level before importing legacy Type/Filters/Properties sheets',
          })
          log('warn', 'filter_import:skip_missing_selected_level', { row: row.excelRow })
          continue
        }

        // Separator rows: type/filter present but no property -> skip.
        if (!row.name && (row.parentName || row.subcategoryName)) {
          skippedEmptyRows++
          log('debug', 'filter_import:skip_legacy_separator_row', { row: row.excelRow })
          continue
        }

        if (!row.name) {
          errors.push({ row: row.excelRow, message: 'Missing required "name"' })
          log('warn', 'filter_import:skip_missing_name', { row: row.excelRow })
          continue
        }

        // Build scope directly from selected level chain.
        // For each Level-2 sibling target, create a scoped resolved row so filters
        // will be linked/visible under all Level-2 subcategories.
        for (const targetLevelId of legacyTargetLevelIds) {
          const scope = {
            categoryId: fallbackScope?.categoryId || null,
            subcategoryId: targetLevelId || null,
            // When targeting Level-2 imports, we should not keep a Level-3 child scope.
            // Otherwise filters may only appear under a specific Level-3 path.
            childCategoryId: null,
          }
          const levelId = targetLevelId

          resolvedRows.push({
            ...row,
            scope,
            levelId,
            filterSlug: makeSlug(row.name),
            parentSlug: makeSlug(row.parentName),
          })
        }
        continue
      }
      if (
        !row.name &&
        !row.parentName &&
        !row.categoryName &&
        !row.subcategoryName &&
        !row.childCategoryName
      ) {
        skippedEmptyRows++
        log('debug', 'filter_import:skip_empty_row', { row: row.excelRow })
        continue
      }

      if (!row.name) {
        // Legacy sheets commonly include separator rows with only Type/Filters.
        if (isLegacySheet && (row.parentName || row.subcategoryName || row.categoryName) && !row.childCategoryName) {
          skippedEmptyRows++
          log('debug', 'filter_import:skip_legacy_separator_row', { row: row.excelRow })
          continue
        }
        errors.push({ row: row.excelRow, message: 'Missing required "name"' })
        log('warn', 'filter_import:skip_missing_name', { row: row.excelRow })
        continue
      }

      let category = null
      let subcategory = null
      let childCategory = null

      if (row.categoryName) {
        category = findCategoryByName(row.categoryName, null)
        if (!category) {
          errors.push({
            row: row.excelRow,
            message: `Category "${row.categoryName}" not found`,
          })
          log('warn', 'filter_import:skip_unknown_category', {
            row: row.excelRow,
            categoryName: row.categoryName,
          })
          continue
        }
        log('debug', 'filter_import:category_match', {
          row: row.excelRow,
          categoryName: row.categoryName,
          categoryId: String(category._id),
        })
      }

      if (row.subcategoryName) {
        // For legacy "Type" sheets, `categoryName` will be empty.
        // In that case, map the row to the selected level category directly.
        if (!row.categoryName && selectedLevelCategoryDoc) {
          const expected = normalizeName(row.subcategoryName)
          const actual = normalizeName(selectedLevelCategoryDoc.name)
          if (expected && actual && expected !== actual) {
            log('warn', 'filter_import:legacy_type_mismatch', {
              row: row.excelRow,
              excelType: row.subcategoryName,
              selectedType: selectedLevelCategoryDoc.name,
            })
          }
          subcategory = selectedLevelCategoryDoc
          if (row.excelRow <= 6) {
            log('debug', 'filter_import:legacy_forced_subcategory', {
              row: row.excelRow,
              excelType: row.subcategoryName,
              mappedSubcategoryId: String(selectedLevelCategoryDoc._id),
              mappedSubcategoryName: selectedLevelCategoryDoc.name,
            })
          }
        }

        // If category column is not provided (legacy "Type" sheets), resolve subcategory
        // against the selected import scope's root category when available.
        const selected =
          fallbackLevelCategoryId && categories.find((c) => String(c._id) === String(fallbackLevelCategoryId))

        // First try: if this row's subcategory name matches the selected level itself,
        // use it directly (this fixes cases where the Excel's "Type" equals the
        // selected Level 2 category, e.g. "Heavy Vehicles").
        if (
          !subcategory &&
          selected &&
          normalizeName(selected.name) === normalizeName(row.subcategoryName)
        ) {
          subcategory = selected
          log('debug', 'filter_import:selected_level_matches_subcategory', {
            row: row.excelRow,
            selectedCategoryId: String(selected._id),
            selectedCategoryName: selected.name,
          })
        }

        // Second try: resolve under the selected scope's parent (when category is missing).
        if (!subcategory) {
          const fallbackParentForSubcategory = category?._id || fallbackScope?.categoryId || null
          subcategory = findCategoryByName(row.subcategoryName, fallbackParentForSubcategory)
        }
        if (!subcategory) {
          // Last fallback: if name is globally unique in categories, use it.
          const matches = byNormalizedName.get(normalizeName(row.subcategoryName)) || []
          if (matches.length === 1) subcategory = matches[0]
        }
        if (!subcategory) {
          errors.push({
            row: row.excelRow,
            message: `Subcategory "${row.subcategoryName}" not found under "${row.categoryName || 'selected scope'}"`,
          })
          log('warn', 'filter_import:skip_unknown_subcategory', {
            row: row.excelRow,
            categoryName: row.categoryName || null,
            subcategoryName: row.subcategoryName,
          })
          continue
        }
        log('debug', 'filter_import:subcategory_match', {
          row: row.excelRow,
          subcategoryName: row.subcategoryName,
          subcategoryId: String(subcategory._id),
        })
      }

      if (row.childCategoryName) {
        childCategory = findCategoryByName(row.childCategoryName, subcategory?._id || null)
        if (!childCategory) {
          errors.push({
            row: row.excelRow,
            message: `Child category "${row.childCategoryName}" not found under "${row.subcategoryName || 'selected scope'}"`,
          })
          log('warn', 'filter_import:skip_unknown_child_category', {
            row: row.excelRow,
            subcategoryName: row.subcategoryName || null,
            childCategoryName: row.childCategoryName,
          })
          continue
        }
        log('debug', 'filter_import:child_category_match', {
          row: row.excelRow,
          childCategoryName: row.childCategoryName,
          childCategoryId: String(childCategory._id),
        })
      }

      const scope = {
        categoryId: category ? String(category._id) : fallbackScope?.categoryId || null,
        subcategoryId: subcategory ? String(subcategory._id) : fallbackScope?.subcategoryId || null,
        childCategoryId: childCategory ? String(childCategory._id) : fallbackScope?.childCategoryId || null,
      }
      const levelId = scope.childCategoryId || scope.subcategoryId || scope.categoryId || fallbackLevelCategoryId || null

      if (!levelId) {
        errors.push({
          row: row.excelRow,
          message: 'Could not resolve category scope (provide category/subcategory columns or select a category before import)',
        })
        log('warn', 'filter_import:skip_unresolved_scope', { row: row.excelRow, name: row.name })
        continue
      }

      resolvedRows.push({
        ...row,
        scope,
        levelId,
        filterSlug: makeSlug(row.name),
        parentSlug: makeSlug(row.parentName),
      })
    }

    const inserted = []
    const skipped = []
    let createdCount = 0
    let duplicateCount = 0

    // Cache created/loaded filters for quick parent lookups within this import.
    const filterCache = new Map()
    const cacheKey = (slug, parentId, levelId) => `${slug}|${parentId ? String(parentId) : 'null'}|${String(levelId)}`
    const scopeMatchQuery = (scope) => {
      if (scope.childCategoryId) return { childCategoryId: idOrNull(scope.childCategoryId) }
      if (scope.subcategoryId) return { subcategoryId: idOrNull(scope.subcategoryId) }
      return { categoryId: idOrNull(scope.categoryId) }
    }

    const ensureFilterLinkedToScope = async (filterDoc, row) => {
      if (!filterDoc) return

      const patch = {}
      // Keep existing scope if already present; backfill only missing fields.
      if (!filterDoc.categoryId && row.scope.categoryId) patch.categoryId = idOrNull(row.scope.categoryId)
      if (!filterDoc.subcategoryId && row.scope.subcategoryId) patch.subcategoryId = idOrNull(row.scope.subcategoryId)
      if (!filterDoc.childCategoryId && row.scope.childCategoryId) patch.childCategoryId = idOrNull(row.scope.childCategoryId)
      if (Object.keys(patch).length) {
        await Filter.updateOne({ _id: filterDoc._id }, { $set: patch })
      }

      if (row.levelId) {
        const categoryIdObj = new Types.ObjectId(String(row.levelId))
        const filterIdObj = filterDoc._id
        try {
          await CategoryFilter.create({
            categoryId: categoryIdObj,
            filterId: filterIdObj,
          })
          if (row.excelRow <= 30) {
            log('info', 'filter_import:category_link_created', {
              row: row.excelRow,
              filter: filterDoc.name,
              categoryId: String(row.levelId),
            })
          }
        } catch (err) {
          if (err?.code === 11000) {
            if (row.excelRow <= 30) {
              log('debug', 'filter_import:category_link_exists', {
                row: row.excelRow,
                filter: filterDoc.name,
                categoryId: String(row.levelId),
              })
            }
            return
          }
          throw err
        }
      }
    }

    const findExistingFilter = async ({ slug, parentId, scope, levelId }) => {
      const key = cacheKey(slug, parentId, levelId)
      if (filterCache.has(key)) return filterCache.get(key)

      const existing = await Filter.findOne({
        slug,
        parentId: parentId ? new Types.ObjectId(String(parentId)) : null,
        isDeleted: { $ne: true },
        ...scopeMatchQuery(scope),
      })
      const value = existing || null
      filterCache.set(key, value)
      return value
    }

    const createFilter = async ({ row, parentId }) => {
      const doc = new Filter({
        name: row.name,
        slug: row.filterSlug,
        parentId: parentId ? new Types.ObjectId(String(parentId)) : null,
        sortOrder: 0,
        isActive: true,
        categoryId: idOrNull(row.scope.categoryId),
        subcategoryId: idOrNull(row.scope.subcategoryId),
        childCategoryId: idOrNull(row.scope.childCategoryId),
      })
      await doc.save()
      const key = cacheKey(row.filterSlug, parentId, row.levelId)
      filterCache.set(key, doc)
      if (row.levelId) {
        try {
          await CategoryFilter.create({
            categoryId: new Types.ObjectId(String(row.levelId)),
            filterId: doc._id,
          })
        } catch (err) {
          if (err?.code !== 11000) throw err
        }
      }
      createdCount++
      inserted.push({
        row: row.excelRow,
        filter: row.name,
        parent: row.parentName || null,
        categoryId: row.scope.categoryId,
        subcategoryId: row.scope.subcategoryId,
        childCategoryId: row.scope.childCategoryId,
        levelId: row.levelId,
      })
      log('info', 'filter_import:inserted', inserted[inserted.length - 1])
      return doc
    }

    const parentRows = resolvedRows.filter((r) => !r.parentName)
    const childRows = resolvedRows.filter((r) => !!r.parentName)

    for (const row of parentRows) {
      if (!row.filterSlug) {
        errors.push({ row: row.excelRow, message: `Invalid filter name "${row.name}"` })
        skipped.push({ row: row.excelRow, reason: 'invalid_slug', name: row.name })
        log('warn', 'filter_import:skip_invalid_slug', { row: row.excelRow, name: row.name })
        continue
      }
      const existing = await findExistingFilter({
        slug: row.filterSlug,
        parentId: null,
        scope: row.scope,
        levelId: row.levelId,
      })
      if (existing) {
        await ensureFilterLinkedToScope(existing, row)
        duplicateCount++
        skipped.push({ row: row.excelRow, reason: 'duplicate_parent', name: row.name })
        log('debug', 'filter_import:skip_duplicate_parent', { row: row.excelRow, name: row.name })
        continue
      }
      await createFilter({ row, parentId: null })
    }

    for (const row of childRows) {
      if (!row.filterSlug || !row.parentSlug) {
        errors.push({ row: row.excelRow, message: `Invalid filter/parent name for "${row.name}"` })
        skipped.push({ row: row.excelRow, reason: 'invalid_child_or_parent_slug', name: row.name })
        log('warn', 'filter_import:skip_invalid_parent_or_child_slug', {
          row: row.excelRow,
          name: row.name,
          parentName: row.parentName,
        })
        continue
      }

      let parentDoc = await findExistingFilter({
        slug: row.parentSlug,
        parentId: null,
        scope: row.scope,
        levelId: row.levelId,
      })
      if (!parentDoc) {
        // Auto-create parent if missing so child relation remains valid.
        const parentSyntheticRow = {
          ...row,
          name: row.parentName,
          filterSlug: row.parentSlug,
          parentName: '',
          parentSlug: '',
        }
        parentDoc = await createFilter({ row: parentSyntheticRow, parentId: null })
      }

      const existingChild = await findExistingFilter({
        slug: row.filterSlug,
        parentId: parentDoc._id,
        scope: row.scope,
        levelId: row.levelId,
      })
      if (existingChild) {
        await ensureFilterLinkedToScope(existingChild, row)
        duplicateCount++
        skipped.push({ row: row.excelRow, reason: 'duplicate_child', name: row.name, parent: row.parentName })
        log('debug', 'filter_import:skip_duplicate_child', {
          row: row.excelRow,
          name: row.name,
          parentName: row.parentName,
        })
        continue
      }

      await createFilter({ row, parentId: parentDoc._id })
    }

    const failed = errors.length
    const success = totalRows - failed - skippedEmptyRows

    return {
      message: 'Imported filters successfully',
      total: totalRows,
      success: Math.max(0, success),
      failed,
      errors,
      totalFiltersCreated: createdCount,
      totalPropertiesAdded: childRows.length,
      skippedDuplicates: duplicateCount,
      skippedRecords: skipped,
      insertedRecords: inserted,
      assignCategoryId: assignCategoryId || null,
    }
  } finally {
    try {
      fs.unlinkSync(filePath)
    } catch (_) {}
  }
}

module.exports = {
  importFiltersFromExcel,
}
