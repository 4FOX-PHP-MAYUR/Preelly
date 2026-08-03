import { useEffect, useState } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { adminService } from '@/services/api'
import { selectIsAdmin, selectUser } from '@shared/store/slices/authSlice'
import {
  Package,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Eye,
  AlertCircle,
  Search,
  X,
  Users,
  MessageCircle,
  Star,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import Card from '../components/AdminUI/Card'
import AdminPage from '../components/AdminUI/AdminPage'
import Panel from '../components/AdminUI/Panel'
import Button from '../components/AdminUI/Button'
import Modal from '../components/AdminUI/Modal'
import DataTable from '../components/AdminUI/DataTable'
import StatusBadge from '../components/AdminUI/StatusBadge'
import PageHeader from '../components/AdminUI/PageHeader'
import EmptyState from '../components/AdminUI/EmptyState'
import LoadingSpinner from '../components/AdminUI/LoadingSpinner'
import { EmiratesIdLightbox } from '../components/AdminUI/EmiratesIdPreview'
import toast from 'react-hot-toast'
import { getMediaUrl } from '@shared/utils/helpers'
import { formatListingPrice } from '@shared/components/categoryBrowseShared'
import { getSocket } from '@/services/socket'
import { REJECTION_REASON_CATEGORIES } from '@shared/constants/rejectionReasons'
import { usePermission } from '../hooks/usePermission'

function AdminDashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const user = useSelector(selectUser)
  const isAdmin = useSelector(selectIsAdmin)
  const { canEdit: canEditListing } = usePermission('Listings')
  const [pendingProducts, setPendingProducts] = useState([])
  const [allProducts, setAllProducts] = useState([])
  const [productTotal, setProductTotal] = useState(0)
  const [productHasMore, setProductHasMore] = useState(false)
  const [productPage, setProductPage] = useState(1)
  const [contacts, setContacts] = useState([])
  const [contactsTotal, setContactsTotal] = useState(0)
  const [supportUnreadCount, setSupportUnreadCount] = useState(0)
  const [reportedComments, setReportedComments] = useState([])
  const [reportedCommentsTotal, setReportedCommentsTotal] = useState(0)
  const [reportActionId, setReportActionId] = useState(null)
  const [categories, setCategories] = useState([])
  const [categoriesTotal, setCategoriesTotal] = useState(0)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryParent, setNewCategoryParent] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState(null)
  const [idLightbox, setIdLightbox] = useState(null)
  // Tabs: 'dashboard' (pending review + stats), 'products' (all products), 'sold' (sold products), 'users' (user list), 'contacts' (chat/contact list), 'comments' (comment moderation)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [statusFilter, setStatusFilter] = useState('all')
  const [productAddTypeFilter, setProductAddTypeFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [contactsActiveOnly, setContactsActiveOnly] = useState(true)
  const [rejectModalProductId, setRejectModalProductId] = useState(null)
  const [selectedRejectCategories, setSelectedRejectCategories] = useState([])
  const [rejectSelectionByCategory, setRejectSelectionByCategory] = useState({})
  const [rejectCustomReason, setRejectCustomReason] = useState('')
  const [confirmAction, setConfirmAction] = useState(null) // { type: 'approve', productId, productTitle }
  const [featureModal, setFeatureModal] = useState(null) // { productId, productTitle, isFeature }
  const [savingFeature, setSavingFeature] = useState(false)

  // Advanced product filters: category / subcategory (cascading) / creation date range / featured
  const [categoryFilter, setCategoryFilter] = useState('')
  const [subcategoryFilter, setSubcategoryFilter] = useState('')
  const [subcategoryOptions, setSubcategoryOptions] = useState([])
  const [subcategoryLoading, setSubcategoryLoading] = useState(false)
  const [fromDateFilter, setFromDateFilter] = useState('')
  const [toDateFilter, setToDateFilter] = useState('')
  const [featuredFilter, setFeaturedFilter] = useState('all') // all | featured | non-featured

  // Products Excel export modal
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [exportFromDate, setExportFromDate] = useState('')
  const [exportToDate, setExportToDate] = useState('')
  const [exportApplyFilters, setExportApplyFilters] = useState(true)
  const [exporting, setExporting] = useState(false)

  const PRODUCT_PAGE_LIMIT = 15

  // Sidebar submenu routes (Marketplace > Products > All Products/Pending/Approved/Sold)
  // all reuse this same page/component, pre-filtered by status via the URL.
  const PRODUCT_STATUS_ROUTES = {
    '/products': 'all',
    '/products/pending': 'pending',
    '/products/approved': 'active',
    '/products/sold': 'sold',
  }

  const PRODUCT_ADD_TYPE_LABELS = {
    web: 'Web',
    ios: 'iOS',
    android: 'Android',
  }

  const formatProductAddType = (value) =>
    PRODUCT_ADD_TYPE_LABELS[String(value || 'web').toLowerCase()] || 'Web'

  const formatPostedDate = (value) => {
    if (!value) return '—'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const renderProductMobileCard = (p, { actions } = {}) => (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
          {p.video ? (
            <video src={getMediaUrl(p.video)} className="w-full h-full object-cover" muted playsInline />
          ) : (
            <img
              src={getMediaUrl(p.images?.[0]) || '/placeholder.jpg'}
              alt={p.title}
              className="w-full h-full object-cover"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-900 dark:text-white truncate">{p.title}</p>
          <p className="mt-0.5 text-xs font-semibold text-primary-600 dark:text-primary-400">
            {formatListingPrice(p)}
          </p>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div className="min-w-0">
          <p className="text-slate-500 dark:text-slate-400">Category</p>
          <p className="font-medium text-slate-900 dark:text-white truncate">{p.category?.name || '—'}</p>
        </div>
        <div className="min-w-0">
          <p className="text-slate-500 dark:text-slate-400">Seller</p>
          <p className="font-medium text-slate-900 dark:text-white truncate">{p.seller?.name || '—'}</p>
        </div>
        <div className="min-w-0">
          <p className="text-slate-500 dark:text-slate-400">Location</p>
          <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{p.location || '—'}</p>
        </div>
        <div className="min-w-0">
          <p className="text-slate-500 dark:text-slate-400">Uploaded by</p>
          <p className="font-medium text-slate-800 dark:text-slate-200">
            {formatProductAddType(p.productAddType)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-slate-500 dark:text-slate-400">Status</p>
          <div className="mt-0.5">
            <StatusBadge status={p.status} />
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-slate-500 dark:text-slate-400">Posted</p>
          <p className="font-medium text-slate-800 dark:text-slate-200">{formatPostedDate(p.createdAt)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-slate-500 dark:text-slate-400">Featured</p>
          <p className="font-medium text-slate-800 dark:text-slate-200">{p.isFeature ? 'Yes' : 'No'}</p>
        </div>
      </div>
    </div>
  )

  // Sync tab with URL (?tab=...) for shareable links and back/forward
  useEffect(() => {
    const tab = searchParams.get('tab')
    // Legacy Reports tab (?tab=comments) now lives at /reports (user reports module)
    if (tab === 'comments') {
      navigate('/reports', { replace: true })
      return
    }
    // Legacy Products tab (?tab=products) now lives at /products → /admin/products
    if (tab === 'products') {
      navigate('/products', { replace: true })
      return
    }
    // Legacy Users tab (?tab=users) now lives at /users
    if (tab === 'users') {
      navigate('/users', { replace: true })
      return
    }
    if (Object.prototype.hasOwnProperty.call(PRODUCT_STATUS_ROUTES, location.pathname)) {
      if (activeTab !== 'products') setActiveTab('products')
      const routeStatus = PRODUCT_STATUS_ROUTES[location.pathname]
      if (statusFilter !== routeStatus) {
        setStatusFilter(routeStatus)
        setProductPage(1)
      }
      return
    }
    if (location.pathname === '/') {
      const nextTab = tab && ['dashboard', 'sold', 'contacts', 'categories'].includes(tab)
        ? tab
        : 'dashboard'
      if (nextTab !== activeTab) setActiveTab(nextTab)
    }
  }, [searchParams, navigate, activeTab, location.pathname])

  const setActiveTabWithUrl = (tab) => {
    if (tab === 'products') {
      navigate('/products')
      return
    }
    setActiveTab(tab)
    setSearchParams({ tab })
  }

  useEffect(() => {
    if (!isAdmin) {
      toast.error('Access denied. Admin privileges required.')
      navigate('/')
      return
    }
    fetchData()
  }, [isAdmin, navigate])

  const fetchData = async (search = '') => {
    try {
      setLoading(true)
      const params = { limit: 50 }
      if (search) {
        params.search = search
      }
      const [pendingRes, statsRes] = await Promise.all([
        adminService.getPendingProducts(params),
        adminService.getStats(),
      ])
      setPendingProducts(pendingRes.data.products || [])
      setStats(statsRes.data)
    } catch (error) {
      console.error('Error fetching admin data:', error)
      toast.error('Failed to load admin data')
    } finally {
      setLoading(false)
    }
  }

  const fetchAllProducts = async (
    status = 'all',
    search = '',
    page = 1,
    addType = productAddTypeFilter,
    extra = {
      category: categoryFilter,
      subcategory: subcategoryFilter,
      fromDate: fromDateFilter,
      toDate: toDateFilter,
      isFeature: featuredFilter,
    }
  ) => {
    try {
      setLoading(true)
      const params = { limit: PRODUCT_PAGE_LIMIT, page }
      if (status !== 'all') {
        params.status = status
      }
      if (addType && addType !== 'all') {
        params.productAddType = addType
      }
      if (search) {
        params.search = search
      }
      if (extra?.category) {
        params.category = extra.category
      }
      if (extra?.subcategory) {
        params.subcategory = extra.subcategory
      }
      if (extra?.fromDate) {
        params.fromDate = extra.fromDate
      }
      if (extra?.toDate) {
        params.toDate = extra.toDate
      }
      if (extra?.isFeature && extra.isFeature !== 'all') {
        params.isFeature = extra.isFeature === 'featured' ? 'true' : 'false'
      }
      const response = await adminService.getAllProducts(params)
      const data = response.data || {}
      setAllProducts(data.products || [])
      setProductTotal(data.total || 0)
      setProductHasMore(Boolean(data.hasMore))
      setProductPage(Number(data.page) || page)
    } catch (error) {
      console.error('Error fetching all products:', error)
      toast.error('Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  const handleCategoryFilterChange = async (value) => {
    setCategoryFilter(value)
    setSubcategoryFilter('')
    setSubcategoryOptions([])
    setProductPage(1)
    fetchAllProducts(statusFilter, searchQuery, 1, productAddTypeFilter, {
      category: value,
      subcategory: '',
      fromDate: fromDateFilter,
      toDate: toDateFilter,
      isFeature: featuredFilter,
    })
    if (!value) return
    try {
      setSubcategoryLoading(true)
      const res = await adminService.getAdminCategoryChildren({ parentId: value })
      setSubcategoryOptions(res.data || [])
    } catch (error) {
      console.error('Error fetching subcategories:', error)
      toast.error('Failed to load subcategories')
    } finally {
      setSubcategoryLoading(false)
    }
  }

  const handleSubcategoryFilterChange = (value) => {
    setSubcategoryFilter(value)
    setProductPage(1)
    fetchAllProducts(statusFilter, searchQuery, 1, productAddTypeFilter, {
      category: categoryFilter,
      subcategory: value,
      fromDate: fromDateFilter,
      toDate: toDateFilter,
      isFeature: featuredFilter,
    })
  }

  const handleFromDateFilterChange = (value) => {
    setFromDateFilter(value)
    setProductPage(1)
    fetchAllProducts(statusFilter, searchQuery, 1, productAddTypeFilter, {
      category: categoryFilter,
      subcategory: subcategoryFilter,
      fromDate: value,
      toDate: toDateFilter,
      isFeature: featuredFilter,
    })
  }

  const handleToDateFilterChange = (value) => {
    setToDateFilter(value)
    setProductPage(1)
    fetchAllProducts(statusFilter, searchQuery, 1, productAddTypeFilter, {
      category: categoryFilter,
      subcategory: subcategoryFilter,
      fromDate: fromDateFilter,
      toDate: value,
      isFeature: featuredFilter,
    })
  }

  const handleFeaturedFilterChange = (value) => {
    setFeaturedFilter(value)
    setProductPage(1)
    fetchAllProducts(statusFilter, searchQuery, 1, productAddTypeFilter, {
      category: categoryFilter,
      subcategory: subcategoryFilter,
      fromDate: fromDateFilter,
      toDate: toDateFilter,
      isFeature: value,
    })
  }

  const fetchContacts = async (search = '') => {
    try {
      setLoading(true)
      const params = { limit: 100, activeOnly: contactsActiveOnly }
      if (search) params.search = search
      const [contactsRes, unreadRes] = await Promise.all([
        adminService.getContacts(params),
        adminService.getSupportUnreadCount().catch(() => ({ data: { unread: 0 } })),
      ])
      setContacts(contactsRes.data.contacts || [])
      setContactsTotal(contactsRes.data.total || 0)
      setSupportUnreadCount(unreadRes.data?.unread ?? 0)
    } catch (error) {
      console.error('Error fetching contacts:', error)
      toast.error('Failed to load contacts')
    } finally {
      setLoading(false)
    }
  }

  const fetchReportedComments = async (page = 1) => {
    try {
      setLoading(true)
      const response = await adminService.getReportedComments({ page, limit: 50 })
      const data = response?.data ?? response
      const list = Array.isArray(data.comments) ? data.comments : []
      const total = typeof data.total === 'number' ? data.total : 0
      setReportedComments(list)
      setReportedCommentsTotal(total)
    } catch (error) {
      console.error('Error fetching reported comments:', error)
      setReportedComments([])
      setReportedCommentsTotal(0)
      const msg = error.response?.data?.message || error.message || 'Failed to load reported comments'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async (search = '', page = 1) => {
    try {
      setLoading(true)
      const params = { limit: 100, page }
      if (search) params.search = search
      const response = await adminService.getAllAdminCategories(params)
      const data = response.data || {}
      setCategories(data.categories || [])
      setCategoriesTotal(data.total || 0)
    } catch (error) {
      console.error('Error fetching categories:', error)
      toast.error('Failed to load categories')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCategory = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      const payload = { name: newCategoryName, parentId: newCategoryParent || null }
      await adminService.createAdminCategory(payload)
      toast.success('Category created')
      setNewCategoryName('')
      setNewCategoryParent(null)
      fetchCategories()
    } catch (error) {
      console.error('Error creating category:', error)
      toast.error(error.response?.data?.message || 'Failed to create category')
    } finally {
      setLoading(false)
    }
  }

  const handleReportAction = async (commentId, action) => {
    try {
      setReportActionId(commentId)
      await adminService.resolveReportedComment(commentId, action)
      toast.success(action === 'deactivate' ? 'Comment deactivated' : 'Report(s) ignored')
      fetchReportedComments()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to resolve report')
    } finally {
      setReportActionId(null)
    }
  }

  const handleSearch = () => {
    setSearchQuery(searchInput)
    if (activeTab === 'dashboard') {
      fetchData(searchInput)
    } else if (activeTab === 'products') {
      setProductPage(1)
      fetchAllProducts(statusFilter, searchInput, 1)
    } else if (activeTab === 'sold') {
      setProductPage(1)
      fetchAllProducts('sold', searchInput, 1)
    } else if (activeTab === 'contacts') {
      fetchContacts(searchInput)
    } else if (activeTab === 'comments') {
      fetchReportedComments()
    }
  }

  const handleClearSearch = () => {
    setSearchInput('')
    setSearchQuery('')
    if (activeTab === 'dashboard') {
      fetchData('')
    } else if (activeTab === 'products') {
      setProductPage(1)
      fetchAllProducts(statusFilter, '', 1)
    } else if (activeTab === 'sold') {
      setProductPage(1)
      fetchAllProducts('sold', '', 1)
    } else if (activeTab === 'contacts') {
      fetchContacts('')
    } else if (activeTab === 'comments') {
      fetchReportedComments()
    }
  }

  useEffect(() => {
    if (activeTab === 'products' && isAdmin) {
      fetchAllProducts(statusFilter, searchQuery, productPage)
    } else if (activeTab === 'sold' && isAdmin) {
      fetchAllProducts('sold', searchQuery, productPage)
    } else if (activeTab === 'contacts' && isAdmin) {
      fetchContacts(searchQuery)
    } else if (activeTab === 'comments' && isAdmin) {
      fetchReportedComments()
    } else if (activeTab === 'categories' && isAdmin) {
      fetchCategories()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, statusFilter, productPage, contactsActiveOnly, isAdmin])

  // Load contacts once on mount so the tab counts are correct by default
  useEffect(() => {
    if (isAdmin) {
      fetchContacts('')
      adminService.getReportedComments({ page: 1, limit: 1 }).then((res) => {
        setReportedCommentsTotal(res.data.total || 0)
      }).catch(() => {})
      adminService.getAllAdminCategories({ limit: 100 }).then((res) => {
        setCategories(res.data.categories || [])
        setCategoriesTotal(res.data.total || 0)
      }).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  // Notifications for new support messages
  useEffect(() => {
    if (!isAdmin) return
    const socket = getSocket()
    const onNewSupportMessage = (data) => {
      fetchContacts(searchQuery)
      toast.success('New message in support chat', { icon: '💬' })
    }
    socket.on('new-support-message', onNewSupportMessage)
    return () => socket.off('new-support-message', onNewSupportMessage)
  }, [isAdmin, searchQuery])

  const handleApprove = async (productId) => {
    try {
      setProcessingId(productId)
      await adminService.approveProduct(productId)
      toast.success('Product approved successfully!')
      fetchData()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to approve product')
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async () => {
    if (!rejectModalProductId) return
    const rejectionSelections = selectedRejectCategories
      .map((category) => ({
        category,
        reasons: Array.isArray(rejectSelectionByCategory[category]) ? rejectSelectionByCategory[category] : [],
      }))
      .filter((row) => row.reasons.length > 0)
    const allReasons = rejectionSelections.flatMap((row) => row.reasons)
    if (rejectionSelections.length === 0 && !rejectCustomReason.trim()) {
      toast.error('Please select at least one reason or add a custom reason')
      return
    }
    try {
      setProcessingId(rejectModalProductId)
      await adminService.rejectProduct(rejectModalProductId, {
        rejectionCategories: selectedRejectCategories,
        rejectionSelections,
        reasons: allReasons,
        customReason: rejectCustomReason.trim(),
      })
      toast.success('Product rejected')
      setRejectModalProductId(null)
      setSelectedRejectCategories([])
      setRejectSelectionByCategory({})
      setRejectCustomReason('')
      fetchData()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reject product')
    } finally {
      setProcessingId(null)
    }
  }

  const handleToggleProductStatus = async (productId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    try {
      setProcessingId(productId)
      await adminService.setProductStatus(productId, newStatus)
      toast.success(`Product status updated to "${newStatus}"`)
      if (activeTab === 'dashboard') {
        fetchData(searchQuery)
      } else {
        fetchAllProducts(statusFilter, searchQuery)
      }
    } catch (error) {
      console.error('Error updating product status:', error)
      toast.error(error.response?.data?.message || 'Failed to update product status')
    } finally {
      setProcessingId(null)
    }
  }

  const openFeatureModal = (p) => {
    setFeatureModal({ productId: p._id, productTitle: p.title, isFeature: Boolean(p.isFeature) })
  }

  const closeFeatureModal = () => setFeatureModal(null)

  const handleSaveFeature = async () => {
    if (!featureModal) return
    const { productId, isFeature } = featureModal
    try {
      setSavingFeature(true)
      await adminService.setProductFeatured(productId, isFeature)
      toast.success(`Product ${isFeature ? 'marked as featured' : 'removed from featured'}`)
      closeFeatureModal()
      if (activeTab === 'dashboard') {
        fetchData(searchQuery)
      } else {
        fetchAllProducts(statusFilter, searchQuery, productPage)
      }
    } catch (error) {
      console.error('Error updating product featured status:', error)
      toast.error(error.response?.data?.message || 'Failed to update featured status')
    } finally {
      setSavingFeature(false)
    }
  }

  const openExportModal = () => {
    setExportFromDate('')
    setExportToDate('')
    setExportApplyFilters(true)
    setExportModalOpen(true)
  }

  const closeExportModal = () => {
    if (exporting) return
    setExportModalOpen(false)
  }

  const handleExportProducts = async () => {
    if (!exportFromDate || !exportToDate) {
      toast.error('Please select From Date and To Date')
      return
    }
    if (exportFromDate > exportToDate) {
      toast.error('From Date cannot be after To Date')
      return
    }

    try {
      setExporting(true)
      const params = { fromDate: exportFromDate, toDate: exportToDate }
      if (exportApplyFilters) {
        if (statusFilter !== 'all') params.status = statusFilter
        if (searchQuery) params.search = searchQuery
        if (productAddTypeFilter !== 'all') params.productAddType = productAddTypeFilter
        if (categoryFilter) params.category = categoryFilter
        if (subcategoryFilter) params.subcategory = subcategoryFilter
        if (featuredFilter !== 'all') params.isFeature = featuredFilter === 'featured' ? 'true' : 'false'
      }

      const res = await adminService.exportProducts(params)
      const blob = res.data instanceof Blob
        ? res.data
        : new Blob([res.data], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          })

      if (blob.type && blob.type.includes('application/json')) {
        const text = await blob.text()
        let message = 'Failed to export products'
        try {
          message = JSON.parse(text)?.message || message
        } catch { /* ignore */ }
        throw new Error(message)
      }

      const disposition = res.headers?.['content-disposition'] || ''
      const match = disposition.match(/filename="?([^"]+)"?/i)
      const filename = match?.[1] || `products-${exportFromDate}_${exportToDate}.xlsx`

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      const truncated = String(res.headers?.['x-export-truncated'] || '') === '1'
      toast.success(truncated
        ? 'Excel exported (first 10,000 matching rows)'
        : 'Excel exported successfully')
      setExportModalOpen(false)
    } catch (err) {
      console.error(err)
      let message = 'Failed to export Excel'
      const data = err.response?.data
      if (data instanceof Blob) {
        try {
          const text = await data.text()
          message = JSON.parse(text)?.message || message
        } catch { /* ignore */ }
      } else {
        message = err.message || err.response?.data?.message || message
      }
      toast.error(message)
    } finally {
      setExporting(false)
    }
  }

  // Columns for the All Products table view (matches the list-page design used across admin).
  const productColumns = [
    {
      key: 'product',
      title: 'Product',
      render: (p) => (
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
            {p.video ? (
              <video src={getMediaUrl(p.video)} className="w-full h-full object-cover" muted playsInline />
            ) : (
              <img
                src={getMediaUrl(p.images?.[0]) || '/placeholder.jpg'}
                alt={p.title}
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-slate-900 dark:text-white truncate max-w-[240px]">{p.title}</p>
            <p className="text-xs font-semibold text-primary-600 dark:text-primary-400">{formatListingPrice(p)}</p>
          </div>
        </div>
      ),
    },
    { key: 'category', title: 'Category', render: (p) => p.category?.name || '—' },
    { key: 'seller', title: 'Seller', render: (p) => p.seller?.name || '—' },
    {
      key: 'location',
      title: 'Location',
      wrap: true,
      cellClassName: 'max-w-[160px]',
      render: (p) => (
        <span className="line-clamp-3 break-words" title={p.location || ''}>
          {p.location || '—'}
        </span>
      ),
    },
    {
      key: 'productAddType',
      title: 'Uploaded by',
      render: (p) => (
        <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
          {formatProductAddType(p.productAddType)}
        </span>
      ),
    },
    {
      key: 'status',
      title: 'Status',
      render: (p) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge status={p.status} />
          {p.isFeature && (
            <Star className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" fill="currentColor" aria-label="Featured" />
          )}
        </div>
      ),
    },
    { key: 'createdAt', title: 'Posted', render: (p) => formatPostedDate(p.createdAt) },
  ]

  const openRejectModal = (productId) => {
    setRejectModalProductId(productId)
    setSelectedRejectCategories([])
    setRejectSelectionByCategory({})
    setRejectCustomReason('')
  }

  const openConfirmAction = (type, product) => {
    setConfirmAction({
      type,
      productId: product._id,
      productTitle: product.title || 'this product',
    })
  }

  const closeConfirmAction = () => setConfirmAction(null)

  const handleConfirmAction = async () => {
    if (!confirmAction || confirmAction.type !== 'approve') return
    const { productId } = confirmAction
    closeConfirmAction()
    await handleApprove(productId)
  }

  const renderProductActions = (p) => (
    <>
      {canEditListing && p.status === 'pending' && (
        <>
          <button
            type="button"
            onClick={() => openConfirmAction('approve', p)}
            disabled={processingId === p._id}
            className="admin-table-action text-emerald-600 dark:text-emerald-400 disabled:opacity-50"
            title="Approve"
            aria-label="Approve product"
          >
            <CheckCircle className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => openRejectModal(p._id)}
            disabled={processingId === p._id}
            className="admin-table-action text-red-600 dark:text-red-400 disabled:opacity-50"
            title="Reject"
            aria-label="Reject product"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </>
      )}
      {canEditListing && (p.status === 'active' || p.status === 'inactive') && (
        <button
          type="button"
          onClick={() => handleToggleProductStatus(p._id, p.status)}
          disabled={processingId === p._id}
          className={`admin-table-action disabled:opacity-50 ${
            p.status === 'active'
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-emerald-600 dark:text-emerald-400'
          }`}
          title={p.status === 'active' ? 'Deactivate' : 'Activate'}
          aria-label={p.status === 'active' ? 'Deactivate product' : 'Activate product'}
        >
          {p.status === 'active' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
        </button>
      )}
      {canEditListing && (
        <button
          type="button"
          onClick={() => openFeatureModal(p)}
          className={`admin-table-action ${
            p.isFeature ? 'text-amber-500 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'
          }`}
          title={p.isFeature ? 'Featured — edit' : 'Not featured — edit'}
          aria-label="Edit featured status"
        >
          <Star className="h-4 w-4" fill={p.isFeature ? 'currentColor' : 'none'} />
        </button>
      )}
      <button
        type="button"
        onClick={() => navigate(`/products/${p._id}`)}
        className="admin-table-action text-slate-500 dark:text-slate-400"
        title="View"
        aria-label="View product"
      >
        <Eye className="h-4 w-4" />
      </button>
    </>
  )

  if (!isAdmin) {
    return null
  }

  const isAllProductsRoute = location.pathname === '/products'
  const productsPageTitle =
    PRODUCT_STATUS_ROUTES[location.pathname] === 'pending'
      ? 'Pending Products'
      : PRODUCT_STATUS_ROUTES[location.pathname] === 'active'
      ? 'Approved Products'
      : PRODUCT_STATUS_ROUTES[location.pathname] === 'sold'
      ? 'Sold Products'
      : 'All Products'

  return (
    <AdminPage className="min-h-[70vh]">
      <div className="space-y-6">
        <div key={activeTab} className="space-y-6 animate-fade-in min-w-0">
          {stats && activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
              <Card title="Total Products" value={stats.totalProducts} icon={Package} accent="default" />
              <Card title="Pending Review" value={stats.pendingProducts} icon={Clock} accent="yellow" />
              <Card title="Approved" value={stats.activeProducts} icon={CheckCircle} accent="green" />
              <Card title="Sold" value={stats.soldProducts} icon={TrendingUp} accent="purple" />
            </div>
          )}

      <Panel className="mb-6">
        <div className={`flex flex-col gap-4 ${activeTab === 'products' ? '' : 'md:flex-row items-end'}`}>
          {/* Search Bar */}
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {activeTab === 'contacts'
                ? 'Search Contacts'
                : activeTab === 'comments'
                ? 'Search Comments'
                : 'Search Products'}
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch()
                  }
                }}
                placeholder={
                  activeTab === 'contacts'
                    ? 'Search by name or email...'
                    : activeTab === 'comments'
                    ? 'Search by comment text or product title...'
                    : 'Search products by title, description, seller name...'
                }
                className="admin-input w-full pl-10 pr-10"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Clear search</span>
                </button>
              )}
            </div>
          </div>

          {/* Add Type / Category / Subcategory / Date / Featured filters for the Products page.
              Status itself is chosen via the sidebar submenu (All Products/Pending/Approved/Sold);
              the Status dropdown only appears on "All Products" for extra narrowing (Inactive/Rejected). */}
          {activeTab === 'products' && (
            <div className="w-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 min-w-0">
                {isAllProductsRoute && (
                  <div className="min-w-0 w-full">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" htmlFor="product-status-filter">
                      Status
                    </label>
                    <select
                      id="product-status-filter"
                      value={statusFilter}
                      onChange={(e) => {
                        const value = e.target.value
                        setStatusFilter(value)
                        setProductPage(1)
                        fetchAllProducts(value, searchQuery, 1)
                      }}
                      className="admin-input w-full min-w-0"
                    >
                      <option value="all">All Statuses</option>
                      <option value="active">Approved</option>
                      <option value="pending">Pending Review</option>
                      <option value="sold">Sold</option>
                      <option value="inactive">Inactive</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                )}
                <div className="min-w-0 w-full">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" htmlFor="product-add-type-filter">
                    Uploaded by
                  </label>
                  <select
                    id="product-add-type-filter"
                    value={productAddTypeFilter}
                    onChange={(e) => {
                      const value = e.target.value
                      setProductAddTypeFilter(value)
                      setProductPage(1)
                      fetchAllProducts(statusFilter, searchQuery, 1, value)
                    }}
                    className="admin-input w-full min-w-0"
                  >
                    <option value="all">All Platforms</option>
                    <option value="web">Web</option>
                    <option value="ios">iOS</option>
                    <option value="android">Android</option>
                  </select>
                </div>
                <div className="min-w-0 w-full">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" htmlFor="product-category-filter">
                    Category
                  </label>
                  <select
                    id="product-category-filter"
                    value={categoryFilter}
                    onChange={(e) => handleCategoryFilterChange(e.target.value)}
                    className="admin-input w-full min-w-0"
                  >
                    <option value="">All Categories</option>
                    {categories
                      .filter((c) => !c.parentId)
                      .map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="min-w-0 w-full">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" htmlFor="product-subcategory-filter">
                    Subcategory
                  </label>
                  <select
                    id="product-subcategory-filter"
                    value={subcategoryFilter}
                    onChange={(e) => handleSubcategoryFilterChange(e.target.value)}
                    disabled={!categoryFilter || subcategoryLoading}
                    className="admin-input w-full min-w-0"
                  >
                    <option value="">
                      {!categoryFilter
                        ? 'Select category first'
                        : subcategoryLoading
                        ? 'Loading...'
                        : 'All Subcategories'}
                    </option>
                    {subcategoryOptions.map((sc) => (
                      <option key={sc._id} value={sc._id}>
                        {sc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0 w-full">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" htmlFor="product-from-date-filter">
                    From Date
                  </label>
                  <input
                    id="product-from-date-filter"
                    type="date"
                    value={fromDateFilter}
                    max={toDateFilter || undefined}
                    onChange={(e) => handleFromDateFilterChange(e.target.value)}
                    className="admin-input w-full min-w-0"
                  />
                </div>
                <div className="min-w-0 w-full">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" htmlFor="product-to-date-filter">
                    To Date
                  </label>
                  <input
                    id="product-to-date-filter"
                    type="date"
                    value={toDateFilter}
                    min={fromDateFilter || undefined}
                    onChange={(e) => handleToDateFilterChange(e.target.value)}
                    className="admin-input w-full min-w-0"
                  />
                </div>
                <div className="min-w-0 w-full">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" htmlFor="product-featured-filter">
                    Featured Product
                  </label>
                  <select
                    id="product-featured-filter"
                    value={featuredFilter}
                    onChange={(e) => handleFeaturedFilterChange(e.target.value)}
                    className="admin-input w-full min-w-0"
                  >
                    <option value="all">All</option>
                    <option value="featured">Featured</option>
                    <option value="non-featured">Non-Featured</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Contacts: Active support only toggle */}
          {activeTab === 'contacts' && (
            <div className="w-full md:w-auto flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={contactsActiveOnly}
                  onChange={(e) => {
                    setContactsActiveOnly(e.target.checked)
                    fetchContacts(searchQuery)
                  }}
                  className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-primary-600 focus:ring-primary-500"
                  aria-label="Show only active support chats"
                />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Active support only</span>
              </label>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <Button type="button" onClick={handleSearch} icon={Search} className="flex-1 md:flex-none">
              Search
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="flex-1 md:flex-none"
              onClick={() => {
                if (activeTab === 'dashboard') {
                  fetchData('')
                } else if (activeTab === 'products') {
                  fetchAllProducts(statusFilter, '')
                } else if (activeTab === 'sold') {
                  fetchAllProducts('sold', '')
                } else if (activeTab === 'contacts') {
                  fetchContacts('')
                } else if (activeTab === 'comments') {
                  fetchReportedComments()
                }
                setSearchInput('')
                setSearchQuery('')
              }}
            >
              Refresh
            </Button>
            {activeTab === 'products' && (
              <Button
                type="button"
                variant="secondary"
                icon={FileSpreadsheet}
                className="flex-1 md:flex-none"
                onClick={openExportModal}
              >
                Export Excel
              </Button>
            )}
          </div>
        </div>
        {searchQuery && (
          <div className="mt-3 flex items-center flex-wrap gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">Searching for:</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-950/60 dark:text-primary-300">
              &ldquo;{searchQuery}&rdquo;
            </span>
            <button
              type="button"
              onClick={handleClearSearch}
              className="text-sm text-primary-600 hover:text-primary-800 dark:text-primary-400"
              aria-label="Clear search filter"
            >
              Clear
            </button>
          </div>
        )}
      </Panel>

      {/* Contacts List */}
      {activeTab === 'contacts' && (
        <div className="admin-card">
          {loading ? (
            <LoadingSpinner message="Loading contacts..." />
          ) : contacts.length === 0 ? (
            <EmptyState icon={Users} title="No contacts found" />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {contacts.map((chat) => {
                const displayName = chat.user?.name || chat.user?.username || chat.user?.email || 'Customer'
                return (
                  <div key={chat._id} className="p-4 sm:p-6 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="w-16 h-16 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden flex-shrink-0 flex items-center justify-center">
                        <span className="text-2xl text-primary-600 dark:text-primary-400" aria-hidden>💬</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900 dark:text-white">
                          <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 rounded text-xs mr-2">Support</span>
                          {displayName}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Last: {chat.lastMessage || 'No messages yet'}
                        </p>
                        <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 flex flex-wrap gap-3">
                          {chat.user?.email && <span>{chat.user.email}</span>}
                          {chat.lastMessageAt && (
                            <span>Last active: {new Date(chat.lastMessageAt).toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-2 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex space-x-2 flex-wrap justify-end">
                        {(chat.unreadForAdmin ?? 0) > 0 && (
                          <span className="px-2 py-0.5 bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 rounded-full font-medium">
                            Unread: {chat.unreadForAdmin}
                          </span>
                        )}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        icon={MessageCircle}
                        onClick={() => navigate(`/chat/${chat._id}?from=contacts`)}
                        aria-label="Open chat"
                      >
                        Open Chat
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

          {/* Reported Comments List */}
      {activeTab === 'comments' && (
        <div className="admin-card">
          {loading ? (
            <LoadingSpinner message="Loading reported comments..." />
          ) : reportedComments.length === 0 ? (
            <EmptyState icon={AlertCircle} title="No reported comments" />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {reportedComments.map((item) => (
                <div key={item.commentId} className="p-4 sm:p-6 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                          {item.reportCount} report{item.reportCount !== 1 ? 's' : ''}
                        </span>
                        {item.resolution === 'deactivated' && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300">
                            Deactivated
                          </span>
                        )}
                        {item.resolution === 'ignored' && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            Ignored
                          </span>
                        )}
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          Reasons: {(item.reasons || []).join(', ')}
                        </span>
                      </div>
                      {item.comment && (
                        <>
                          <p className="text-sm text-slate-900 dark:text-white font-medium mb-1">
                            Comment by {item.comment.user?.name || 'Unknown'}
                          </p>
                          <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">{item.comment.text}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Product / reel: {item.comment.product?.title || 'Unknown'}
                          </p>
                        </>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      {(item.resolution ?? 'pending') === 'pending' && (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            className="!bg-red-50 !text-red-700 !border !border-red-200 hover:!bg-red-100 dark:!bg-red-950/40 dark:!text-red-300 dark:!border-red-900 shadow-none"
                            onClick={() => handleReportAction(item.commentId, 'deactivate')}
                            disabled={reportActionId === item.commentId}
                            loading={reportActionId === item.commentId}
                            title="Deactivate comment"
                            aria-label="Deactivate comment"
                          >
                            Deactivate comment
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => handleReportAction(item.commentId, 'ignore')}
                            disabled={reportActionId === item.commentId}
                            title="Ignore report"
                            aria-label="Ignore report"
                          >
                            Ignore report
                          </Button>
                        </>
                      )}
                      {item.comment?.product?._id && (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          icon={Eye}
                          onClick={() => navigate(`/products/${item.comment.product._id}`)}
                          aria-label="View product"
                        >
                          View product
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Categories Management - quick link to dedicated page */}
      {activeTab === 'categories' && (
        <div className="admin-card p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Manage Categories</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">Open the dedicated categories page to manage hierarchy and bulk actions.</p>
            </div>
            <Button onClick={() => navigate('/categories')} className="shrink-0">Open Categories</Button>
          </div>
        </div>
      )}

      {/* All Products — table view (redesigned to match admin list pages) */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          <PageHeader
            title={productsPageTitle}
            subtitle={`${productTotal} product${productTotal === 1 ? '' : 's'}${
              isAllProductsRoute && statusFilter !== 'all' ? ` · ${statusFilter}` : ''
            }${
              productAddTypeFilter !== 'all'
                ? ` · ${formatProductAddType(productAddTypeFilter)}`
                : ''
            }${categoryFilter ? ' · category filtered' : ''}${
              fromDateFilter || toDateFilter ? ' · date filtered' : ''
            }${featuredFilter !== 'all' ? ` · ${featuredFilter}` : ''}`}
          />
          <DataTable
            columns={productColumns}
            data={allProducts}
            loading={loading}
            emptyTitle="No products found"
            emptyDescription={
              statusFilter !== 'all' ||
              productAddTypeFilter !== 'all' ||
              categoryFilter ||
              subcategoryFilter ||
              fromDateFilter ||
              toDateFilter ||
              featuredFilter !== 'all'
                ? 'No products match the selected filters.'
                : 'No products match your search.'
            }
            showSearch={false}
            customActions={renderProductActions}
            mobileCardRender={renderProductMobileCard}
            pagination={{
              page: productPage,
              limit: PRODUCT_PAGE_LIMIT,
              total: productTotal,
              onPageChange: (pg) => {
                setProductPage(pg)
                fetchAllProducts(statusFilter, searchQuery, pg)
              },
            }}
            serverSide
          />
        </div>
      )}

      {/* Products List (Dashboard = pending, Sold) */}
      {(activeTab === 'dashboard' || activeTab === 'sold') && (
        <div className="admin-card">
          <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white">
                  {activeTab === 'dashboard'
                    ? `Pending Review (${pendingProducts.length})`
                    : activeTab === 'sold'
                    ? `Sold Products (${allProducts.length})`
                    : `All Products (${allProducts.length})${statusFilter !== 'all' ? ` - ${statusFilter}` : ''}`
                  }
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {activeTab === 'dashboard'
                    ? 'Products waiting for approval'
                    : activeTab === 'sold'
                    ? 'Products marked as sold'
                    : 'View and manage all products'
                  }
                </p>
              </div>
              {activeTab === 'dashboard' && (
                <Button
                  type="button"
                  onClick={fetchData}
                  className="w-full sm:w-auto"
                  aria-label="Refresh pending products"
                >
                  Refresh
                </Button>
              )}
            </div>
          </div>

          {loading ? (
            <LoadingSpinner />
          ) : (activeTab === 'dashboard' ? pendingProducts : allProducts).length === 0 ? (
            <EmptyState
              icon={Package}
              title={
                activeTab === 'dashboard'
                  ? 'All caught up!'
                  : activeTab === 'sold'
                  ? 'No sold products found'
                  : 'No products found'
              }
              description={
                activeTab === 'dashboard'
                  ? 'No products pending review.'
                  : activeTab === 'sold'
                  ? 'There are no products marked as sold yet.'
                  : `No products with status "${statusFilter}" found.`
              }
            />
          ) : (
            <div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {(activeTab === 'dashboard' ? pendingProducts : allProducts).map((product) => (
                  <div
                    key={product._id}
                    className="p-4 sm:p-6 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      <div className="flex-shrink-0 w-full sm:w-32 h-40 sm:h-32 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
                        {product.video ? (
                          <video
                            src={getMediaUrl(product.video)}
                            className="w-full h-full object-cover"
                            muted
                            loop
                            autoPlay
                            playsInline
                          />
                        ) : (
                          <img
                            src={getMediaUrl(product.images?.[0]) || '/placeholder.jpg'}
                            alt={product.title}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white mb-1 break-words">
                          {product.title}
                        </h3>
                        <p className="text-primary-600 dark:text-primary-400 font-bold text-base sm:text-lg mb-2">
                          {formatListingPrice(product)}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2 line-clamp-2">
                          {product.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600 dark:text-slate-400 mb-3">
                          {product.location ? <span className="truncate max-w-full">{product.location}</span> : null}
                          {product.category?.name ? (
                            <>
                              <span className="text-slate-300 dark:text-slate-600 hidden sm:inline" aria-hidden>•</span>
                              <span>{product.category.name}</span>
                            </>
                          ) : null}
                          {product.seller?.name ? (
                            <>
                              <span className="text-slate-300 dark:text-slate-600 hidden sm:inline" aria-hidden>•</span>
                              <span className="truncate">Seller: {product.seller.name}</span>
                            </>
                          ) : null}
                          <span className="text-slate-300 dark:text-slate-600 hidden sm:inline" aria-hidden>•</span>
                          <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                            Uploaded by: {formatProductAddType(product.productAddType)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge
                            status={product.status}
                            label={
                              product.status === 'pending'
                                ? 'Pending Review'
                                : product.status === 'active'
                                ? 'Approved'
                                : undefined
                            }
                          />
                          {product.createdAt && (
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              Posted {new Date(product.createdAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-row sm:flex-col gap-2 w-full sm:w-auto shrink-0">
                        {canEditListing && product.status === 'pending' && (
                          <>
                            <Button
                              type="button"
                              variant="success"
                              onClick={() => openConfirmAction('approve', product)}
                              disabled={processingId === product._id}
                              loading={processingId === product._id}
                              icon={CheckCircle}
                              className="flex-1 sm:flex-none"
                              aria-label="Approve product"
                            >
                              Approve
                            </Button>
                            <Button
                              type="button"
                              variant="danger"
                              onClick={() => openRejectModal(product._id)}
                              disabled={processingId === product._id}
                              icon={XCircle}
                              className="flex-1 sm:flex-none"
                              aria-label="Reject product"
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {canEditListing && (product.status === 'active' || product.status === 'inactive') ? (
                          <button
                            type="button"
                            onClick={() => handleToggleProductStatus(product._id, product.status)}
                            disabled={processingId === product._id}
                            className={`flex-1 sm:flex-none h-9 px-3 rounded-full flex items-center justify-center gap-1.5 border text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                              product.status === 'active'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300'
                                : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300'
                            }`}
                            title={product.status === 'active' ? 'Deactivate product' : 'Activate product'}
                            aria-label={product.status === 'active' ? 'Deactivate product' : 'Activate product'}
                          >
                            {processingId === product._id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : product.status === 'active' ? (
                              <AlertCircle className="h-4 w-4" />
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                            <span className="text-xs font-medium">{product.status === 'active' ? 'Deactivate' : 'Activate'}</span>
                          </button>
                        ) : null}
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => navigate(`/products/${product._id}`)}
                          icon={Eye}
                          className="flex-1 sm:flex-none"
                          aria-label="View product"
                        >
                          View
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination for products (admin listing) */}
              {activeTab !== 'dashboard' && (
                <div className="admin-table-pagination px-4 sm:px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-sm text-slate-500 dark:text-slate-400">
                  <div className="text-center sm:text-left">
                    {productTotal > 0 && (
                      <>
                        Showing{' '}
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {(productPage - 1) * PRODUCT_PAGE_LIMIT + 1}
                        </span>{' '}
                        –{' '}
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {(productPage - 1) * PRODUCT_PAGE_LIMIT + allProducts.length}
                        </span>{' '}
                        of <span className="font-medium text-slate-700 dark:text-slate-300">{productTotal}</span> products
                      </>
                    )}
                  </div>
                  <div className="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (productPage > 1) {
                          const newPage = productPage - 1
                          setProductPage(newPage)
                          fetchAllProducts(
                            activeTab === 'sold' ? 'sold' : statusFilter,
                            searchQuery,
                            newPage
                          )
                        }
                      }}
                      disabled={productPage <= 1}
                      className="admin-pagination-btn"
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="px-2 text-slate-600 dark:text-slate-400">
                      Page <span className="font-medium text-slate-900 dark:text-white">{productPage}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (productHasMore) {
                          const newPage = productPage + 1
                          setProductPage(newPage)
                          fetchAllProducts(
                            activeTab === 'sold' ? 'sold' : statusFilter,
                            searchQuery,
                            newPage
                          )
                        }
                      }}
                      disabled={!productHasMore}
                      className="admin-pagination-btn"
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <Modal
        open={Boolean(confirmAction)}
        onClose={closeConfirmAction}
        size="sm"
        title="Confirm Approve"
        footer={
          <Modal.Footer
            onCancel={closeConfirmAction}
            onConfirm={handleConfirmAction}
            cancelLabel="Cancel"
            confirmLabel="Yes, Approve"
            confirmVariant="success"
          />
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {`Are you sure you want to approve "${confirmAction?.productTitle}"? The listing will go live.`}
        </p>
      </Modal>

      <Modal
        open={Boolean(featureModal)}
        onClose={closeFeatureModal}
        size="sm"
        title="Edit Feature"
        footer={
          <Modal.Footer
            onCancel={closeFeatureModal}
            onConfirm={handleSaveFeature}
            cancelLabel="Cancel"
            confirmLabel="Save"
            loading={savingFeature}
          />
        }
      >
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Product
            </p>
            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
              {featureModal?.productTitle}
            </p>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            This screen only controls whether the product is featured. No other product details can be changed here.
          </p>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={Boolean(featureModal?.isFeature)}
              onChange={(e) =>
                setFeatureModal((prev) => (prev ? { ...prev, isFeature: e.target.checked } : prev))
              }
              className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            Featured product
          </label>
        </div>
      </Modal>

      <Modal
        open={exportModalOpen}
        onClose={closeExportModal}
        title="Export Products to Excel"
        size="sm"
        footer={
          <Modal.Footer
            onCancel={closeExportModal}
            onConfirm={handleExportProducts}
            cancelLabel="Cancel"
            confirmLabel="Export"
            loading={exporting}
          />
        }
      >
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Choose the creation-date range for the products you want to export.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" htmlFor="export-from-date">
              From Date
            </label>
            <input
              id="export-from-date"
              type="date"
              value={exportFromDate}
              max={exportToDate || undefined}
              onChange={(e) => setExportFromDate(e.target.value)}
              required
              className="admin-input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" htmlFor="export-to-date">
              To Date
            </label>
            <input
              id="export-to-date"
              type="date"
              value={exportToDate}
              min={exportFromDate || undefined}
              onChange={(e) => setExportToDate(e.target.value)}
              required
              className="admin-input w-full"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={exportApplyFilters}
            onChange={(e) => setExportApplyFilters(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          />
          Apply currently selected filters (status, category, subcategory, featured, search, uploaded by)
        </label>
      </Modal>

      <Modal
        open={Boolean(rejectModalProductId)}
        onClose={() => setRejectModalProductId(null)}
        title="Reject Product"
        size="lg"
        footer={
          <Modal.Footer
            onCancel={() => setRejectModalProductId(null)}
            onConfirm={handleReject}
            cancelLabel="Cancel"
            confirmLabel={processingId === rejectModalProductId ? 'Rejecting...' : 'Reject Product'}
            confirmVariant="danger"
            loading={processingId === rejectModalProductId}
          />
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Categories</label>
            <div className="max-h-44 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-2">
              {REJECTION_REASON_CATEGORIES.map((item) => (
                <label key={item.category} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={selectedRejectCategories.includes(item.category)}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setSelectedRejectCategories((prev) =>
                        checked ? [...prev, item.category] : prev.filter((c) => c !== item.category)
                      )
                      if (!checked) {
                        setRejectSelectionByCategory((prev) => {
                          const next = { ...prev }
                          delete next[item.category]
                          return next
                        })
                      }
                    }}
                    className="mt-0.5 rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-primary-600 focus:ring-primary-500"
                  />
                  <span>{item.category}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Reasons</label>
            <div className="max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-4">
              {selectedRejectCategories.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Select at least one category first.</p>
              ) : (
                selectedRejectCategories.map((category) => {
                  const categoryReasons =
                    REJECTION_REASON_CATEGORIES.find((item) => item.category === category)?.reasons || []
                  const selectedForCategory = Array.isArray(rejectSelectionByCategory[category])
                    ? rejectSelectionByCategory[category]
                    : []
                  return (
                    <div key={category} className="border border-slate-100 dark:border-slate-800 rounded-lg p-3">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">{category}</p>
                      {categoryReasons.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">No predefined reasons in this category.</p>
                      ) : (
                        <div className="space-y-2">
                          {categoryReasons.map((reasonItem) => (
                            <label key={`${category}-${reasonItem}`} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                              <input
                                type="checkbox"
                                checked={selectedForCategory.includes(reasonItem)}
                                onChange={(e) => {
                                  setRejectSelectionByCategory((prev) => {
                                    const current = Array.isArray(prev[category]) ? prev[category] : []
                                    return {
                                      ...prev,
                                      [category]: e.target.checked
                                        ? [...current, reasonItem]
                                        : current.filter((value) => value !== reasonItem),
                                    }
                                  })
                                }}
                                className="mt-0.5 rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-primary-600 focus:ring-primary-500"
                              />
                              <span>{reasonItem}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Custom Reason (optional)</label>
            <textarea
              rows={3}
              value={rejectCustomReason}
              onChange={(e) => setRejectCustomReason(e.target.value)}
              className="admin-input w-full"
              placeholder="Add additional rejection details for the seller..."
            />
          </div>
        </div>
      </Modal>
        </div>
      </div>

      {idLightbox && (
        <EmiratesIdLightbox
          src={idLightbox.src}
          label={idLightbox.label}
          onClose={() => setIdLightbox(null)}
        />
      )}
    </AdminPage>
  )
}

export default AdminDashboardPage

