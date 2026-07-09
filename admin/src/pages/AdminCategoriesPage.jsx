import React, { useEffect, useState, useCallback, useRef } from 'react'
import { adminService } from '@shared/services/api'
import PageHeader from '../components/AdminUI/PageHeader'
import AdminPage from '../components/AdminUI/AdminPage'
import DataTable from '../components/AdminUI/DataTable'
import Button from '../components/AdminUI/Button'
import toast from 'react-hot-toast'
import { getMediaUrl } from '@shared/utils/helpers'

function AdminCategoriesPage() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
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
  })
  const [search, setSearch] = useState('')
  const [filterParentId, setFilterParentId] = useState('')
  const [rootOnly, setRootOnly] = useState(false)
  const LIMIT = 100
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const [parentLevelOptions, setParentLevelOptions] = useState([[]])
  const [parentSelectedPath, setParentSelectedPath] = useState([])
  const [loadingParentLevel, setLoadingParentLevel] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importRootCategoryId, setImportRootCategoryId] = useState('')
  const [importRootCategoryOptions, setImportRootCategoryOptions] = useState([])
  const [importSubCategoryId, setImportSubCategoryId] = useState('')
  const [importSubCategoryOptions, setImportSubCategoryOptions] = useState([])
  const [loadingImportSubCategories, setLoadingImportSubCategories] = useState(false)
  const fileInputRef = useRef(null)

  const fetchParentRoots = useCallback(async () => {
    try {
      const res = await adminService.getAdminCategoryChildren({})
      const roots = Array.isArray(res.data) ? res.data : []
      setParentLevelOptions([roots])
      setImportRootCategoryOptions(roots)
      // Default to "Motors" if it exists; otherwise pick the first root.
      setImportRootCategoryId((prev) => {
        if (prev) return prev
        const motors = roots.find((c) => String(c?.name || '').toLowerCase() === 'motors')
        return (motors?._id || roots?.[0]?._id || '')?.toString()
      })
    } catch {
      setParentLevelOptions([[]])
      setImportRootCategoryOptions([])
      setImportRootCategoryId('')
    }
  }, [])

  const handleParentLevelChange = async (levelIndex, categoryId) => {
    const newPath = categoryId
      ? [...parentSelectedPath.slice(0, levelIndex), categoryId]
      : parentSelectedPath.slice(0, levelIndex)
    setParentSelectedPath(newPath)
    setForm(prev => ({ ...prev, parentId: newPath[newPath.length - 1] || '' }))

    if (!categoryId) {
      setParentLevelOptions(prev => prev.slice(0, levelIndex + 1))
      return
    }

    setLoadingParentLevel(true)
    try {
      const res = await adminService.getAdminCategoryChildren({ parentId: categoryId })
      const children = Array.isArray(res.data) ? res.data : []
      setParentLevelOptions(prev =>
        children.length > 0
          ? [...prev.slice(0, levelIndex + 1), children]
          : prev.slice(0, levelIndex + 1)
      )
    } catch {
      setParentLevelOptions(prev => prev.slice(0, levelIndex + 1))
    } finally {
      setLoadingParentLevel(false)
    }
  }

  const restoreParentCascade = async (pathIds) => {
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
      setParentSelectedPath(pathIds.map(id => String(id)))
    } catch (err) {
      console.error('Error restoring parent cascade:', err)
      await fetchParentRoots()
      setParentSelectedPath([])
    }
  }

  const fetchCategories = async (p = 1, searchTerm = '', parentId = filterParentId, rootOnlyFilter = rootOnly) => {
    try {
      setLoading(true)
      const params = { limit: LIMIT, page: p }
      if (searchTerm && searchTerm.trim()) params.search = searchTerm.trim()
      if (rootOnlyFilter) {
        params.rootOnly = 'true'
      } else if (parentId) {
        params.parentId = parentId
      }
      const res = await adminService.getAdminCategories(params)
      const data = res.data || {}
      const items = data.categories || data.data || []
      const totalCount = Number(data.total ?? data.meta?.total ?? items.length)
      setCategories(items)
      setTotal(totalCount)
      setPage(p)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load categories')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCategories(1)
    fetchParentRoots()
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadSubCategories = async () => {
      if (!importRootCategoryId) {
        setImportSubCategoryOptions([])
        setImportSubCategoryId('')
        return
      }

      setLoadingImportSubCategories(true)
      try {
        const res = await adminService.getAdminCategoryChildren({ parentId: importRootCategoryId })
        const options = Array.isArray(res.data) ? res.data : []
        if (cancelled) return

        setImportSubCategoryOptions(options)

        // Default to "New Cars" if it exists; otherwise keep current selection or clear.
        setImportSubCategoryId((prev) => {
          if (prev && options.some((c) => String(c._id) === String(prev))) return prev
          const preferred = options.find((c) => String(c?.name || '').toLowerCase() === 'new cars')
          return (preferred?._id || '').toString()
        })
      } catch (err) {
        if (cancelled) return
        setImportSubCategoryOptions([])
        setImportSubCategoryId('')
      } finally {
        if (!cancelled) setLoadingImportSubCategories(false)
      }
    }
    loadSubCategories()
    return () => {
      cancelled = true
    }
  }, [importRootCategoryId])

  const handleSearch = (e) => {
    e.preventDefault()
    fetchCategories(1, search, filterParentId, rootOnly)
  }

  const handleParentFilterChange = (parentId) => {
    setFilterParentId(parentId)
    setRootOnly(false)
    fetchCategories(1, search, parentId, false)
  }

  const handleRootOnlyToggle = (checked) => {
    setRootOnly(checked)
    if (checked) setFilterParentId('')
    fetchCategories(1, search, checked ? '' : filterParentId, checked)
  }

  const resetForm = () => ({
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
  })

  const openAdd = () => {
    setEditing(null)
    setForm(resetForm())
    setParentSelectedPath([])
    fetchParentRoots()
    setShowForm(true)
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
    const preview = URL.createObjectURL(file)
    setForm((prev) => ({
      ...prev,
      category_image_file: file,
      image_preview: preview,
      clear_image: false,
    }))
  }

  const existingCategoryIcon = (row) => row?.image || row?.icon || null
  const existingCategoryImage2 = (row) => row?.categoryImage || null

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
    const preview = URL.createObjectURL(file)
    setForm((prev) => ({
      ...prev,
      categoryImage_file: file,
      categoryImage_preview: preview,
      clear_categoryImage: false,
    }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      const payload = {
        name: form.name,
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
      if (editing) {
        if (form.clear_image) payload.clear_image = 'true'
        if (form.clear_categoryImage) payload.clear_categoryImage = 'true'
        await adminService.updateAdminCategory(editing._id, payload)
        toast.success('Category updated')
      } else {
        await adminService.createAdminCategory(payload)
        toast.success('Category created')
      }
      setShowForm(false)
      setEditing(null)
      setForm(resetForm())
      setParentSelectedPath([])
      await Promise.all([fetchCategories(1, search), fetchParentRoots()])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async (row) => {
    const isActive = row.isActive !== false
    try {
      setLoading(true)
      await adminService.updateAdminCategory(row._id, { isActive: !isActive })
      toast.success(isActive ? 'Category set to inactive' : 'Category set to active')
      await fetchCategories(page, search)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (row) => {
    if (!confirm('Delete category and its children?')) return
    try {
      setLoading(true)
      await adminService.deleteAdminCategory(row._id)
      toast.success('Deleted')
      setShowForm(false)
      setEditing(null)
      await Promise.all([fetchCategories(page, search), fetchParentRoots()])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete')
    } finally {
      setLoading(false)
    }
  }

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  const handleImportFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)
    // Anchor import under a specific category level (preferred when subcategory is chosen).
    if (importSubCategoryId) {
      formData.append('targetCategoryId', importSubCategoryId)
    } else if (importRootCategoryId) {
      formData.append('rootCategoryId', importRootCategoryId)
    }

    try {
      setImporting(true)
      const res = await adminService.importAdminCategoriesExcel(formData)
      const d = res.data || {}
      const summary =
        typeof d.failed === 'number' && d.failed > 0
          ? `${d.message || 'Done'} — ${d.success ?? 0}/${d.total ?? 0} rows, ${d.failed} failed`
          : d.message || 'Categories imported successfully'
      toast.success(summary)
      await Promise.all([fetchCategories(1, search), fetchParentRoots()])
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to import categories'
      toast.error(msg)
    } finally {
      setImporting(false)
    }
  }

  return (
    <AdminPage>
      <PageHeader
        title="Categories"
        subtitle="Manage product categories"
        action={
          <div className="flex items-center gap-2">
            <select
              value={importRootCategoryId}
              onChange={(e) => setImportRootCategoryId(e.target.value)}
              disabled={!importRootCategoryOptions.length || importing}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-800 disabled:opacity-60"
              aria-label="Import root category"
            >
              {importRootCategoryOptions.length ? (
                importRootCategoryOptions.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))
              ) : (
                <option value="">Loading roots…</option>
              )}
            </select>
            <select
              value={importSubCategoryId}
              onChange={(e) => setImportSubCategoryId(e.target.value)}
              disabled={!importRootCategoryId || loadingImportSubCategories || importing}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-800 disabled:opacity-60"
              aria-label="Import sub category"
            >
              {importRootCategoryId ? (
                <>
                  <option value="">Use Excel sheet name</option>
                  {importSubCategoryOptions.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </>
              ) : (
                <option value="">Select root first</option>
              )}
            </select>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              ref={fileInputRef}
              className="hidden"
              onChange={handleImportFileChange}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={handleImportClick}
              disabled={importing}
            >
              {importing ? 'Importing…' : 'Import Excel'}
            </Button>
            <Button onClick={openAdd}>Add Category</Button>
          </div>
        }
      />

      <div className="mb-4 flex items-center justify-between gap-4">
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 flex-wrap">
          <select
            value={filterParentId}
            onChange={(e) => handleParentFilterChange(e.target.value)}
            disabled={rootOnly}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white disabled:opacity-60"
          >
            <option value="">All Parent Categories</option>
            {importRootCategoryOptions.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-700 px-3 py-2 border border-gray-200 rounded-lg bg-white cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rootOnly}
              onChange={(e) => handleRootOnlyToggle(e.target.checked)}
            />
            <span>Show Root Category</span>
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories..."
            className="w-full max-w-sm border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
            Search
          </button>
          {(search || filterParentId || rootOnly) && (
            <button
              type="button"
              onClick={() => { setSearch(''); setFilterParentId(''); setRootOnly(false); fetchCategories(1, '', '', false); }}
              className="px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              Clear
            </button>
          )}
        </form>
        <div className="text-sm text-gray-500">
          Showing <span className="font-medium">{categories.length}</span> of <span className="font-medium">{total}</span> categories
        </div>
      </div>

      {showForm && (
        <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {editing ? 'Edit Category' : 'Add Category'}
          </h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="mt-1 block w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Category name"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-xs text-gray-700 pb-2">
                  <input
                    type="checkbox"
                    checked={form.isActive !== false}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  />
                  <span>Active</span>
                </label>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-2">Parent Category</label>
                <div className="flex flex-wrap gap-3">
                  {parentLevelOptions.map((options, levelIndex) => {
                    if (!options || options.length === 0) return null
                    const value = parentSelectedPath[levelIndex] || ''
                    const filteredOptions = options.filter(
                      opt => !editing || String(opt._id) !== String(editing._id)
                    )
                    if (filteredOptions.length === 0 && !value) return null
                    const parentName = levelIndex > 0
                      ? parentLevelOptions[levelIndex - 1]?.find(c => String(c._id) === String(parentSelectedPath[levelIndex - 1]))?.name
                      : null
                    return (
                      <div key={levelIndex} className="flex-1 min-w-[200px]">
                        <label className="block text-[11px] text-gray-500 mb-1">
                          {levelIndex === 0 ? 'Root' : parentName || `Level ${levelIndex + 1}`}
                        </label>
                        <select
                          value={value}
                          onChange={(e) => handleParentLevelChange(levelIndex, e.target.value)}
                          disabled={loadingParentLevel}
                          className="block w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-60"
                        >
                          <option value="">
                            {levelIndex === 0 ? '(No parent – root level)' : `Select child of ${parentName || '...'}`}
                          </option>
                          {filteredOptions.map(opt => (
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
                  <p className="text-xs text-gray-400 mt-1">Loading subcategories...</p>
                )}
                {parentSelectedPath.length > 0 && (
                  <p className="text-xs text-indigo-600 mt-2">
                    Parent: {parentSelectedPath
                      .map((id, i) => parentLevelOptions[i]?.find(c => String(c._id) === String(id))?.name)
                      .filter(Boolean)
                      .join(' → ')}
                  </p>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Icon (optional)</label>
                <div className="flex items-center gap-3 mt-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="text-xs"
                  />
                  {(form.image_preview ||
                    (editing && existingCategoryIcon(editing) && !form.clear_image)) && (
                    <div className="flex items-center gap-2">
                      <img
                        src={
                          form.image_preview ||
                          getMediaUrl(existingCategoryIcon(editing)) ||
                          existingCategoryIcon(editing)
                        }
                        alt="Category"
                        className="h-12 w-12 rounded object-cover border border-gray-200"
                      />
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
                        className="text-xs text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Category Image (optional)</label>
                <div className="flex items-center gap-3 mt-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCategoryImageChange}
                    className="text-xs"
                  />
                  {(form.categoryImage_preview ||
                    (editing && existingCategoryImage2(editing) && !form.clear_categoryImage)) && (
                    <div className="flex items-center gap-2">
                      <img
                        src={
                          form.categoryImage_preview ||
                          getMediaUrl(existingCategoryImage2(editing)) ||
                          existingCategoryImage2(editing)
                        }
                        alt="Category"
                        className="h-12 w-12 rounded object-cover border border-gray-200"
                      />
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
                        className="text-xs text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Color Code</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={/^#[0-9A-Fa-f]{6}$/.test(form.colorCode) ? form.colorCode : '#000000'}
                  onChange={(e) => setForm({ ...form, colorCode: e.target.value })}
                  className="h-9 w-11 rounded-lg border border-gray-200 cursor-pointer"
                />
                <input
                  type="text"
                  value={form.colorCode}
                  onChange={(e) => setForm({ ...form, colorCode: e.target.value })}
                  placeholder="#000000"
                  className="block w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Order</label>
              <input
                type="number"
                value={form.xOrder}
                onChange={(e) => setForm({ ...form, xOrder: e.target.value })}
                placeholder="0"
                className="mt-1 block w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-3 justify-end pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setEditing(null)
                  setForm(resetForm())
                  setParentSelectedPath([])
                }}
                className="px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700"
              >
                {editing ? 'Update' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      <DataTable
        columns={[
          {
            key: 'name',
            title: 'Name',
            render: (r) => {
              const level = typeof r.level === 'number' ? r.level : (Array.isArray(r.path) ? r.path.length : 0)
              const indent = level > 0 ? '│   '.repeat(Math.max(0, level - 1)) + '└─ ' : ''
              return (
                <span className="font-medium text-gray-900 whitespace-pre">
                  <span className="text-gray-400">{indent}</span>
                  {r.name}
                </span>
              )
            },
          },
          {
            key: 'parent',
            title: 'Parent',
            render: (r) => {
              const p = categories.find((c) => String(c._id) === String(r.parentId))
              return p ? p.name : 'Root'
            },
          },
          {
            key: 'status',
            title: 'Status',
            render: (r) => {
              const isActive = r.isActive !== false
              return (
                <button
                  type="button"
                  onClick={() => handleToggleStatus(r)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    isActive
                      ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                      : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                  }`}
                >
                  {isActive ? 'Active' : 'Inactive'}
                </button>
              )
            },
          },
        ]}
        data={categories}
        loading={loading}
        serverSide
        pagination={{ page, limit: LIMIT, total, onPageChange: (p) => fetchCategories(p, search, filterParentId, rootOnly) }}
        onEdit={async (r) => {
          setEditing(r)
          setForm({
            name: r.name || '',
            parentId: r.parentId || '',
            isActive: r.isActive !== false,
            category_image_file: null,
            image_preview: '',
            clear_image: false,
            categoryImage_file: null,
            categoryImage_preview: '',
            clear_categoryImage: false,
            colorCode: r.colorCode || '',
            xOrder: r.xOrder !== undefined && r.xOrder !== null ? String(r.xOrder) : '',
          })
          const pathIds = Array.isArray(r.path) ? r.path.map(id => String(id)) : []
          await restoreParentCascade(pathIds)
          setShowForm(true)
        }}
        onDelete={(r) => handleDelete(r)}
      />
    </AdminPage>
  )
}

export default AdminCategoriesPage
