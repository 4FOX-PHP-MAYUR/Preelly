const { Types } = require('mongoose')

function normalizeCategoryFilterId(categoryFilterId) {
  if (!categoryFilterId || !Types.ObjectId.isValid(String(categoryFilterId))) return null
  return new Types.ObjectId(String(categoryFilterId))
}

function normalizeChildCategoryId(childCategoryId) {
  if (!childCategoryId || !Types.ObjectId.isValid(String(childCategoryId))) return null
  return new Types.ObjectId(String(childCategoryId))
}

function buildDuplicateFormFieldQuery(
  categoryId,
  fieldName,
  categoryFilterId = null,
  childCategoryId = null,
  excludeId = null
) {
  const query = {
    categoryId: new Types.ObjectId(String(categoryId)),
    fieldName,
    isDeleted: false,
    categoryFilterId: normalizeCategoryFilterId(categoryFilterId),
    childCategoryId: normalizeChildCategoryId(childCategoryId),
  }
  if (excludeId) query._id = { $ne: excludeId }
  return query
}

function nullOrMissingField(fieldName) {
  return [
    { [fieldName]: null },
    { [fieldName]: { $exists: false } },
  ]
}

/**
 * Active form fields for a category scope.
 * - With childCategoryId: fields for that child plus filter-level and category-wide defaults.
 * - With categoryFilterId: fields for that filter plus category-wide defaults (null filter).
 * - Without categoryFilterId: category-wide defaults on categoryId, plus any fields
 *   scoped to this category as a child filter (categoryFilterId = categoryId) or as
 *   a child category (childCategoryId = categoryId). Those two bridges support leaf
 *   categories whose admin fields are stored against an ancestor with the deeper
 *   scope set — e.g. Residential under For Rent, or Huawei under
 *   Mobile & Tablets -> Mobile Phones.
 */
function buildActiveFormFieldsQuery(categoryId, categoryFilterId = null, childCategoryId = null) {
  const catObjId = new Types.ObjectId(String(categoryId))
  const base = {
    isActive: true,
    isDeleted: false,
  }
  const filterObjId = normalizeCategoryFilterId(categoryFilterId)
  const childObjId = normalizeChildCategoryId(childCategoryId)

  if (childObjId && filterObjId) {
    return {
      ...base,
      categoryId: catObjId,
      $or: [
        { categoryFilterId: filterObjId, childCategoryId: childObjId },
        ...nullOrMissingField('childCategoryId').map((clause) => ({
          categoryFilterId: filterObjId,
          ...clause,
        })),
        ...nullOrMissingField('categoryFilterId').flatMap((filterClause) =>
          nullOrMissingField('childCategoryId').map((childClause) => ({
            ...filterClause,
            ...childClause,
          }))
        ),
      ],
    }
  }

  if (filterObjId) {
    return {
      ...base,
      categoryId: catObjId,
      $or: [
        ...nullOrMissingField('childCategoryId').map((clause) => ({
          categoryFilterId: filterObjId,
          ...clause,
        })),
        ...nullOrMissingField('categoryFilterId').flatMap((filterClause) =>
          nullOrMissingField('childCategoryId').map((childClause) => ({
            ...filterClause,
            ...childClause,
          }))
        ),
      ],
    }
  }

  return {
    ...base,
    $or: [
      {
        categoryId: catObjId,
        $or: [
          ...nullOrMissingField('categoryFilterId').flatMap((filterClause) =>
            nullOrMissingField('childCategoryId').map((childClause) => ({
              ...filterClause,
              ...childClause,
            }))
          ),
        ],
      },
      { categoryFilterId: catObjId },
      // Same bridge one level deeper: a leaf whose admin fields are stored under
      // the grandparent with the full chain set (e.g. Mobile & Tablets ->
      // Mobile Phones -> Huawei). Requesting the leaf on its own must still find
      // them, otherwise the seller — or anyone re-opening the ad to edit it —
      // sees no fields at all.
      { childCategoryId: catObjId },
    ],
  }
}

function formFieldScopeSpecificity(row) {
  if (row.childCategoryId) return 3
  if (row.categoryFilterId) return 2
  return 1
}

/** More specific scope rows override less specific rows with the same fieldName. */
function mergeScopedFormFields(rows) {
  const byName = new Map()
  for (const row of rows) {
    const existing = byName.get(row.fieldName)
    if (!existing) {
      byName.set(row.fieldName, row)
      continue
    }
    if (formFieldScopeSpecificity(row) > formFieldScopeSpecificity(existing)) {
      byName.set(row.fieldName, row)
    }
  }
  return [...byName.values()].sort(
    (a, b) => (a.formStep ?? 1) - (b.formStep ?? 1) || (a.fieldOrder ?? 0) - (b.fieldOrder ?? 0)
  )
}

module.exports = {
  buildDuplicateFormFieldQuery,
  buildActiveFormFieldsQuery,
  mergeScopedFormFields,
  normalizeCategoryFilterId,
  normalizeChildCategoryId,
}
