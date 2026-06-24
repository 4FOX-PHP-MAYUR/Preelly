const mongoose = require('mongoose')
const { Schema } = mongoose

const FormFieldSchema = new Schema(
  {
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
      index: true,
    },
    fieldTypeId: {
      type: Schema.Types.ObjectId,
      ref: 'FieldType',
      required: [true, 'Field type is required'],
      index: true,
    },
    filterId: {
      type: Schema.Types.ObjectId,
      ref: 'Filter',
      default: null,
      index: true,
    },
    categoryFilterId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },
    childCategoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },
    fieldTitle: {
      type: String,
      required: [true, 'Field title is required'],
      trim: true,
    },
    placeholder: {
      type: String,
      default: '',
      trim: true,
    },
    fieldName: {
      type: String,
      required: [true, 'Field name is required'],
      trim: true,
      index: true,
    },
    fieldOrder: {
      type: Number,
      default: 0,
    },
    formStep: {
      type: Number,
      default: 1,
    },
    validation: {
      type: String,
      default: '',
      trim: true,
    },
    tableName: {
      type: String,
      default: '',
      trim: true,
    },
    /** Dynamic option source configuration (valueColumn, labelColumn, parentColumn, etc.) */
    tableConfig: {
      type: {
        valueColumn: { type: String, default: '', trim: true },
        labelColumn: { type: String, default: '', trim: true },
        parentColumn: { type: String, default: '', trim: true },
        statusColumn: { type: String, default: '', trim: true },
        sortColumn: { type: String, default: '', trim: true },
        slugColumn: { type: String, default: '', trim: true },
        deletedColumn: { type: String, default: '', trim: true },
        activeValue: { type: Schema.Types.Mixed, default: null },
        conditions: { type: Schema.Types.Mixed, default: null },
      },
      default: null,
    },
    functionName: {
      type: String,
      default: '',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    showOnQuickView: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'formFields',
  }
)

FormFieldSchema.index({ isDeleted: 1, formStep: 1, fieldOrder: 1 })
FormFieldSchema.index({ categoryId: 1, isDeleted: 1 })
FormFieldSchema.index(
  { categoryId: 1, categoryFilterId: 1, childCategoryId: 1, fieldName: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
)

const FormField = mongoose.model('FormField', FormFieldSchema)

/**
 * Drop legacy global fieldName unique index and sync compound per-category index.
 * Called from server.js AFTER MongoDB connection is ready.
 */
FormField.fixIndexes = async function () {
  try {
    const indexes = await this.collection.indexes()
    let dropped = false

    for (const idx of indexes) {
      if (idx.name === '_id_') continue
      if (!idx.unique) continue
      const keys = idx.key || {}
      const keyNames = Object.keys(keys)
      if (keyNames.length === 1 && keys.fieldName === 1) {
        await this.collection.dropIndex(idx.name).catch(() => {})
        console.log('[FormField] Dropped legacy global unique index:', idx.name)
        dropped = true
      }
      if (
        keyNames.length === 2
        && keys.categoryId === 1
        && keys.fieldName === 1
        && !keys.categoryFilterId
      ) {
        await this.collection.dropIndex(idx.name).catch(() => {})
        console.log('[FormField] Dropped legacy per-category unique index:', idx.name)
        dropped = true
      }
      if (
        keyNames.length === 3
        && keys.categoryId === 1
        && keys.categoryFilterId === 1
        && keys.fieldName === 1
        && !keys.childCategoryId
      ) {
        await this.collection.dropIndex(idx.name).catch(() => {})
        console.log('[FormField] Dropped legacy category-filter unique index:', idx.name)
        dropped = true
      }
    }

    await this.syncIndexes().catch(() => {})
    if (dropped) {
      console.log('[FormField] Indexes re-synced')
    } else {
      console.log('[FormField] Indexes OK')
    }
  } catch (err) {
    console.error('[FormField] fixIndexes error:', err.message)
  }
}

module.exports = FormField
