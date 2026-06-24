/**
 * DTO (Data Transfer Object) for getDynamicForm.
 *
 * Shapes raw Mongoose documents into clean, predictable API payloads.
 * Hides internal fields (isDeleted, __v, etc.) and normalises nullable values.
 */

/**
 * Shape a single filter option (child of a parent filter).
 *
 * @param {object} opt — lean Filter document
 */
function filterOptionDto(opt) {
  return {
    _id: opt._id,
    name: opt.name,
    slug: opt.slug || null,
    colorCode: opt.colorCode || null,
    thumbImage: opt.thumbImage || null,
    sortOrder: opt.sortOrder ?? 0,
  }
}

/**
 * Shape a single dynamic form field.
 *
 * @param {object} field — lean DynamicFormField document, enriched with filterOptions[]
 */
function fieldDto(field) {
  return {
    _id: field._id,
    // Displayed label shown to the user
    fieldTitle: field.fieldTitle,
    // Internal key used when submitting the form
    fieldName: field.fieldName,
    // Input hint text
    placeholder: field.placeholder || '',
    // Display order within its step
    fieldOrder: field.fieldOrder ?? 0,
    // Step/section this field belongs to
    formStep: field.formStep || '',
    // Populated field-type record (e.g. Text, Dropdown, Radio)
    fieldType: field.fieldTypeId
      ? { _id: field.fieldTypeId._id, value: field.fieldTypeId.fieldValue }
      : null,
    // Populated parent filter (present when field is filter-driven)
    filter: field.filterId
      ? {
          _id: field.filterId._id,
          name: field.filterId.name,
          colorCode: field.filterId.colorCode || null,
          thumbImage: field.filterId.thumbImage || null,
        }
      : null,
    // Child filter options fetched from the filters table (parentId = filterId)
    filterOptions: Array.isArray(field.filterOptions)
      ? field.filterOptions.map(filterOptionDto)
      : [],
  }
}

/**
 * Shape the complete getDynamicForm response payload.
 *
 * @param {string}   categoryId  — the requested categoryId
 * @param {{ step: string, fields: object[] }[]} steps — grouped step data
 * @param {number}   totalFields — total number of form fields across all steps
 */
function getDynamicFormDto(categoryId, steps, totalFields) {
  return {
    categoryId,
    totalFields,
    totalSteps: steps.length,
    steps: steps.map((s) => ({
      step: s.step,
      totalFields: s.fields.length,
      fields: s.fields.map(fieldDto),
    })),
  }
}

module.exports = { fieldDto, filterOptionDto, getDynamicFormDto }
