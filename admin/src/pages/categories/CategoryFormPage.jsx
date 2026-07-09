import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { adminService, categoryService } from '@shared/services/api'
import AdminFormShell from '../../components/AdminUI/AdminFormShell'
import Input from '../../components/AdminUI/Input'
import Checkbox from '../../components/AdminUI/Checkbox'
import FormSection from '../../components/AdminUI/FormSection'
import toast from 'react-hot-toast'
import { getMediaUrl } from '@shared/utils/helpers'

const LIST_PATH = '/admin/categories'

const emptyForm = {
  name: '',
  parentId: '',
  isActive: true,
  category_image_file: null,
  image_preview: '',
  clear_image: false,
  categoryImage_file: null,
  categoryImage_preview: '',
  clear_categoryImage: false,
  colorCode: '',
  xOrder: '',
}

function CategoryFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [loading, setLoading] = useState(false)
  const [loadingRecord, setLoadingRecord] = useState(isEdit)
  const [form, setForm] = useState(emptyForm)
  const [existingImage, setExistingImage] = useState('')
  const [existingCategoryImage, setExistingCategoryImage] = useState('')

  const [parentLevelOptions, setParentLevelOptions] = useState([[]])
  const [parentSelectedPath, setParentSelectedPath] = useState([])
  const [loadingParentLevel, setLoadingParentLevel] = useState(false)

  const fetchParentRoots = useCallback(async () => {
    try {
      const res = await adminService.getAdminCategoryChildren({})
      const roots = Array.isArray(res.data) ? res.data : []
      setParentLevelOptions([roots])
    } catch {
      setParentLevelOptions([[]])
    }
  }, [])

  const restoreParentCascade = useCallback(async (pathIds) => {
    if (!pathIds || pathIds.length === 0) {
      await fetchParentRoots()
      setParentSelectedPath([])
      return
    }
    try {
      const rootRes = await adminService.getAdminCategoryChildren({})
      const roots = Array.isArray(rootRes.data) ? rootRes.data : []
      const options = [roots]
      for (let i = 0; i < pathIds.length; i++) {
        const childRes = await adminService.getAdminCategoryChildren({ parentId: pathIds[i] })
        const children = Array.isArray(childRes.data) ? childRes.data : []
        if (children.length > 0) options.push(children)
      }
      setParentLevelOptions(options)
      setParentSelectedPath(pathIds.map((pid) => String(pid)))
    } catch (err) {
      console.error('Error restoring parent cascade:', err)
      await fetchParentRoots()
      setParentSelectedPath([])
    }
  }, [fetchParentRoots])

  useEffect(() => {
    if (!isEdit) {
      fetchParentRoots()
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        setLoadingRecord(true)
        const res = await categoryService.getCategoryById(id)
        const row = res.data
        if (!row) throw new Error('Category not found')
        if (cancelled) return

        setForm({
          name: row.name || '',
          parentId: row.parentId || '',
          isActive: row.isActive !== false,
          category_image_file: null,
          image_preview: '',
          clear_image: false,
          categoryImage_file: null,
          categoryImage_preview: '',
          clear_categoryImage: false,
          colorCode: row.colorCode || '',
          xOrder: row.xOrder !== undefined && row.xOrder !== null ? String(row.xOrder) : '',
        })
        setExistingImage(row.image || row.icon || '')
        setExistingCategoryImage(row.categoryImage || '')

        const pathIds = Array.isArray(row.path) ? row.path.map((pid) => String(pid)) : []
        await restoreParentCascade(pathIds)
      } catch (err) {
        toast.error(err.response?.data?.message || err.message || 'Failed to load category')
        navigate(LIST_PATH)
      } finally {
        if (!cancelled) setLoadingRecord(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id, isEdit, navigate, restoreParentCascade, fetchParentRoots])

  const handleParentLevelChange = async (levelIndex, categoryId) => {
    const newPath = categoryId
      ? [...parentSelectedPath.slice(0, levelIndex), categoryId]
      : parentSelectedPath.slice(0, levelIndex)
    setParentSelectedPath(newPath)
    setForm((prev) => ({ ...prev, parentId: newPath[newPath.length - 1] || '' }))

    if (!categoryId) {
      setParentLevelOptions((prev) => prev.slice(0, levelIndex + 1))
      return
    }

    setLoadingParentLevel(true)
    try {
      const res = await adminService.getAdminCategoryChildren({ parentId: categoryId })
      const children = Array.isArray(res.data) ? res.data : []
      setParentLevelOptions((prev) =>
        children.length > 0
          ? [...prev.slice(0, levelIndex + 1), children]
          : prev.slice(0, levelIndex + 1)
      )
    } catch {
      setParentLevelOptions((prev) => prev.slice(0, levelIndex + 1))
    } finally {
      setLoadingParentLevel(false)
    }
  }

  const handleImageChange = (e) => {
    const file = e.target.files?.[0] || null
    if (!file) {
      setForm((prev) => ({
        ...prev,
        category_image_file: null,
        image_preview: '',
        clear_image: false,
      }))
      return
    }
    setForm((prev) => ({
      ...prev,
      category_image_file: file,
      image_preview: URL.createObjectURL(file),
      clear_image: false,
    }))
  }

  const handleCategoryImageChange = (e) => {
    const file = e.target.files?.[0] || null
    if (!file) {
      setForm((prev) => ({
        ...prev,
        categoryImage_file: null,
        categoryImage_preview: '',
        clear_categoryImage: false,
      }))
      return
    }
    setForm((prev) => ({
      ...prev,
      categoryImage_file: file,
      categoryImage_preview: URL.createObjectURL(file),
      clear_categoryImage: false,
    }))
  }

  const handleSave = async () => {
    if (!form.name?.trim()) {
      toast.error('Category name is required')
      return
    }
    try {
      setLoading(true)
      const payload = {
        name: form.name.trim(),
        parentId: form.parentId || null,
        isActive: form.isActive !== false,
        colorCode: form.colorCode || '',
        xOrder: form.xOrder !== '' ? form.xOrder : 0,
      }
      if (form.category_image_file) {
        payload.category_image = form.category_image_file
      }
      if (form.categoryImage_file) {
        payload.categoryImage = form.categoryImage_file
      }
      if (isEdit) {
        if (form.clear_image) payload.clear_image = 'true'
        if (form.clear_categoryImage) payload.clear_categoryImage = 'true'
        await adminService.updateAdminCategory(id, payload)
        toast.success('Category updated')
      } else {
        await adminService.createAdminCategory(payload)
        toast.success('Category created')
      }
      navigate(LIST_PATH)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save category')
    } finally {
      setLoading(false)
    }
  }

  if (loadingRecord) {
    return (
      <AdminFormShell title={isEdit ? 'Edit Category' : 'Add Category'} backTo={LIST_PATH} onSubmit={() => {}}>
        <p className="text-sm text-slate-500">Loading…</p>
      </AdminFormShell>
    )
  }

  return (
    <AdminFormShell
      title={isEdit ? 'Edit Category' : 'Add Category'}
      subtitle={isEdit ? 'Update category details' : 'Create a new category'}
      backTo={LIST_PATH}
      loading={loading}
      onSubmit={handleSave}
      submitLabel={isEdit ? 'Save Changes' : 'Create Category'}
    >
      <FormSection title="Basic information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            placeholder="Category name"
          />
          <div className="flex items-end">
            <Checkbox
              label="Active"
              description="Category is visible and available"
              checked={form.isActive !== false}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="Parent category">
        <div className="flex flex-wrap gap-3">
          {parentLevelOptions.map((options, levelIndex) => {
            if (!options || options.length === 0) return null
            const value = parentSelectedPath[levelIndex] || ''
            const filteredOptions = options.filter(
              (opt) => !isEdit || String(opt._id) !== String(id)
            )
            if (filteredOptions.length === 0 && !value) return null
            const parentName =
              levelIndex > 0
                ? parentLevelOptions[levelIndex - 1]?.find(
                    (c) => String(c._id) === String(parentSelectedPath[levelIndex - 1])
                  )?.name
                : null
            return (
              <div key={levelIndex} className="flex-1 min-w-[200px]">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  {levelIndex === 0 ? 'Root' : parentName || `Level ${levelIndex + 1}`}
                </label>
                <select
                  value={value}
                  onChange={(e) => handleParentLevelChange(levelIndex, e.target.value)}
                  disabled={loadingParentLevel}
                  className="admin-input w-full disabled:opacity-60"
                >
                  <option value="">
                    {levelIndex === 0
                      ? '(No parent – root level)'
                      : `Select child of ${parentName || '...'}`}
                  </option>
                  {filteredOptions.map((opt) => (
                    <option key={opt._id} value={opt._id}>
                      {opt.emoji ? `${opt.emoji} ` : ''}{opt.name}
                    </option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>
        {loadingParentLevel && (
          <p className="text-xs text-slate-400 mt-2">Loading subcategories…</p>
        )}
        {parentSelectedPath.length > 0 && (
          <p className="text-xs text-primary-600 dark:text-primary-400 mt-2">
            Parent:{' '}
            {parentSelectedPath
              .map((pid, i) => parentLevelOptions[i]?.find((c) => String(c._id) === String(pid))?.name)
              .filter(Boolean)
              .join(' → ')}
          </p>
        )}
      </FormSection>

      <FormSection title="Icon">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Icon
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="admin-input file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700"
          />
          {(form.image_preview || (existingImage && !form.clear_image)) && (
            <div className="mt-3 flex items-center gap-3">
              <img
                src={form.image_preview || getMediaUrl(existingImage) || existingImage}
                alt="Category"
                className="h-16 w-16 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
              />
              {isEdit && existingImage && (
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      category_image_file: null,
                      image_preview: '',
                      clear_image: true,
                    }))
                  }
                  className="text-sm text-red-600 hover:underline dark:text-red-400"
                >
                  Remove image
                </button>
              )}
            </div>
          )}
        </div>
      </FormSection>

      <FormSection title="Category Image">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Category Image
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleCategoryImageChange}
            className="admin-input file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700"
          />
          {(form.categoryImage_preview || (existingCategoryImage && !form.clear_categoryImage)) && (
            <div className="mt-3 flex items-center gap-3">
              <img
                src={form.categoryImage_preview || getMediaUrl(existingCategoryImage) || existingCategoryImage}
                alt="Category"
                className="h-16 w-16 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
              />
              {isEdit && existingCategoryImage && (
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      categoryImage_file: null,
                      categoryImage_preview: '',
                      clear_categoryImage: true,
                    }))
                  }
                  className="text-sm text-red-600 hover:underline dark:text-red-400"
                >
                  Remove image
                </button>
              )}
            </div>
          )}
        </div>
      </FormSection>

      <FormSection title="Color Code">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Color Code
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={/^#[0-9A-Fa-f]{6}$/.test(form.colorCode) ? form.colorCode : '#000000'}
              onChange={(e) => setForm({ ...form, colorCode: e.target.value })}
              className="h-10 w-12 rounded-md border border-slate-200 dark:border-slate-700 cursor-pointer"
            />
            <input
              type="text"
              value={form.colorCode}
              onChange={(e) => setForm({ ...form, colorCode: e.target.value })}
              placeholder="#000000"
              className="admin-input w-full"
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="Order">
        <Input
          label="Order"
          type="number"
          value={form.xOrder}
          onChange={(e) => setForm({ ...form, xOrder: e.target.value })}
          placeholder="0"
        />
      </FormSection>
    </AdminFormShell>
  )
}

export default CategoryFormPage
