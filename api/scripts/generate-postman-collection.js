#!/usr/bin/env node
'use strict'

/**
 * Generates Preelly-API.postman_collection.json from swagger/allPaths.js ROUTES
 * plus inline body templates for mutating endpoints.
 */
const fs = require('fs')
const path = require('path')
const { ROUTES } = require('../swagger/allPaths')

const OUT = path.join(__dirname, '..', 'Preelly-API.postman_collection.json')

function buildProductFormData({ isUpdate = false } = {}) {
  const fields = [
    { key: 'title', value: '2022 Land Rover Discovery HSE', type: 'text' },
    { key: 'description', value: 'Well maintained SUV with full service history and low mileage. Single owner, accident free.', type: 'text' },
    { key: 'price', value: '185000', type: 'text' },
    { key: 'currency', value: 'AED', type: 'text' },
    { key: 'category', value: '{{categoryId}}', type: 'text' },
    { key: 'subcategory', value: '{{categoryId}}', type: 'text' },
    { key: 'location', value: 'Dubai Marina, Dubai, UAE', type: 'text' },
    { key: 'country', value: 'UAE', type: 'text' },
    { key: 'city', value: 'Dubai', type: 'text' },
    { key: 'area', value: 'Dubai Marina', type: 'text' },
    { key: 'brand', value: 'Land Rover', type: 'text' },
    { key: 'condition', value: 'Good', type: 'text' },
    { key: 'priceType', value: 'Fixed', type: 'text' },
    { key: 'adType', value: 'free', type: 'text' },
    { key: 'contactName', value: 'John Seller', type: 'text' },
    { key: 'contactPhone', value: '+971501234567', type: 'text' },
    // Optional vehicle listing fields (lowercase API keys)
    { key: 'cityid', value: '{{filterId}}', type: 'text', description: 'Optional — Filter ObjectId' },
    { key: 'modelid', value: '{{categoryId}}', type: 'text', description: 'Optional — Category ObjectId' },
    { key: 'trimid', value: '{{categoryId}}', type: 'text', description: 'Optional — Category ObjectId' },
    { key: 'regionalspecsid', value: '{{filterId}}', type: 'text' },
    { key: 'yearid', value: '{{filterId}}', type: 'text' },
    { key: 'kilometers', value: '45000', type: 'text' },
    { key: 'bodytypeid', value: '{{filterId}}', type: 'text' },
    { key: 'seatid', value: '{{filterId}}', type: 'text' },
    { key: 'isinsuredid', value: '{{filterId}}', type: 'text' },
    { key: 'productprice', value: '185000', type: 'text' },
    { key: 'phonenumber', value: '+971501234567', type: 'text' },
    { key: 'exteriorcolorid', value: '{{filterId}}', type: 'text' },
    { key: 'interiorcolor', value: 'Beige Leather', type: 'text' },
    { key: 'warrantyid', value: '{{filterId}}', type: 'text' },
    { key: 'fueltypeid', value: '{{filterId}}', type: 'text' },
    { key: 'doorsid', value: '{{filterId}}', type: 'text' },
    { key: 'numberofcylenderid', value: '{{filterId}}', type: 'text' },
    { key: 'transmissiontypeid', value: '{{filterId}}', type: 'text' },
    { key: 'horsepowerid', value: '{{filterId}}', type: 'text' },
    { key: 'steeringsideid', value: '{{filterId}}', type: 'text' },
    { key: 'enginecapacityid', value: '{{filterId}}', type: 'text' },
    { key: 'driverassistancesafetyid', value: '{{filterId}}', type: 'text' },
    { key: 'entertainmenttechnologyid', value: '{{filterId}}', type: 'text' },
    { key: 'comforfconvenienceid', value: '{{filterId}}', type: 'text' },
    { key: 'exteriorid', value: '{{filterId}}', type: 'text' },
    { key: 'locateyouritem', value: 'Near Marina Mall', type: 'text' },
    { key: 'buildingstreetname', value: 'King Salman Bin Abdulaziz Al Saud St', type: 'text' },
  ]

  if (isUpdate) {
    fields.unshift({ key: 'status', value: 'active', type: 'text', disabled: true, description: 'Owner/admin only' })
  } else {
    fields.push(
      { key: 'video', type: 'file', description: 'Required — upload 1 video file' },
      { key: 'images', type: 'file', description: 'Upload at least 1 image (or rely on auto screenshots)' },
    )
  }

  if (isUpdate) {
    fields.push(
      { key: 'video', type: 'file', disabled: true, description: 'Optional replacement video' },
      { key: 'images', type: 'file', disabled: true, description: 'Optional additional images' },
    )
  }

  return fields
}

/** @type {Record<string, object | null>} key = "METHOD path" */
const BODY_BY_ROUTE = {
  'POST /api/auth/register': {
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '+971500000000',
    password: 'secret12',
  },
  'POST /api/auth/send-email-otp': { email: 'jane@example.com' },
  'POST /api/auth/send-phone-otp': { phone: '918552849180' },
  'POST /api/auth/verify-email-otp': { email: 'jane@example.com', otp: '123456' },
  'POST /api/auth/verify-phone-otp': { phone: '918552849180', otp: '123456' },
  'POST /api/auth/send-otp': {
    channel: 'email',
    email: 'jane@example.com',
    mode: 'login',
  },
  'POST /api/auth/verify-otp': {
    channel: 'email',
    email: 'jane@example.com',
    otp: '123456',
    mode: 'login',
  },
  'POST /api/auth/login': {},
  'POST /api/auth/logout': {},
  'PUT /api/user/reels-progress': { feedKey: 'default', index: 0 },
  'PUT /api/user/profile': {
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '+971500000000',
    avatar: null,
    displayName: 'Jane',
    gender: 'female',
    dob: '1990-01-15',
    address: { line1: 'Street 1', line2: '', postalCode: '00000', country: 'AE' },
  },
  'POST /api/chats': { productId: '{{productId}}', sellerId: '{{sellerId}}' },
  'POST /api/chats/support': { type: 'support' },
  'POST /api/chats/:id/messages': { text: 'Hello, is this still available?' },
  'PUT /api/chats/:id/read': null,
  'POST /api/products/:id/like': null,
  'POST /api/products/:id/view': null,
  'POST /api/products/:id/save': null,
  'POST /api/user/:id/follow': null,
  'POST /api/products/:id/report': {
    reason: 'spam',
    description: 'Optional details',
  },
  'POST /api/products/:id/comments': { text: 'Nice listing!' },
  'POST /api/comments/:id/report': { reason: 'spam' },
  'POST /api/comments/:id/like': null,
  'POST /api/ai/enhance-description': {
    title: 'Used sedan',
    description: 'Runs well, low mileage.',
    category: 'Motors',
  },
  'POST /api/listings/ai-extract': {
    input_text: '2020 Toyota Camry, 45000 km, full service history, AED 45000',
  },
  'PUT /api/products/:id/resubmit': null,
  'DELETE /api/products/:id': null,
  'DELETE /api/chats/:id': null,
  'DELETE /api/chats/:chatId/messages/:messageId': null,
  'PUT /api/admin/products/:id/approve': null,
  'PUT /api/admin/products/:id/reject': {
    reason: 'Policy violation',
    rejectionCategory: 'Content',
    rejectionCategories: ['Content'],
    reasons: ['Inappropriate content'],
    rejectionSelections: [
      { category: 'Content', reasons: ['Inappropriate content'] },
    ],
    customReason: '',
  },
  'PUT /api/admin/products/:id/status': { status: 'active' },
  'POST /api/admin/users': {
    name: 'Admin Created',
    email: 'newuser@example.com',
    phone: '+971511111111',
    password: 'secret12',
    role: 'user',
    status: 'active',
    adminRole: null,
  },
  'PUT /api/admin/users/:id/verify': { isVerified: true },
  'PUT /api/admin/users/:id/role': { role: 'user' },
  'PUT /api/admin/users/:id/status': { status: 'active' },
  'PUT /api/admin/users/:id/admin-role': { adminRole: '{{adminRoleId}}' },
  'PUT /api/admin/comments/:id/approve': null,
  'PUT /api/admin/comments/:id/reject': null,
  'PUT /api/admin/reported-comments/comment/:commentId/action': { action: 'ignore' },
  'POST /api/admin/categories': {
    name: 'New Category',
    slug: 'new-category',
    parentId: null,
    sortOrder: 0,
    isActive: true,
  },
  'PATCH /api/admin/categories/:id': {
    name: 'Updated name',
    slug: 'updated-slug',
    parentId: null,
    sortOrder: 1,
    isActive: true,
  },
  'DELETE /api/admin/categories/:id': null,
  'POST /api/admin/filters': {
    name: 'Filter name',
    slug: 'filter-slug',
    parentId: null,
    sortOrder: 0,
    isActive: true,
    colorCode: '#FF0000',
    categoryId: '{{categoryId}}',
  },
  'PATCH /api/admin/filters/:id': {
    name: 'Updated filter',
    clearThumb: 'false',
  },
  'DELETE /api/admin/filters/:id': null,
  'POST /api/admin/dealers': {
    dealer_name: 'Best Motors',
    dealer_email: 'sales@dealer.example.com',
    dealer_mobile: '+971500000000',
    dealer_whatsapp: '+971500000000',
    synopsis: 'Authorized dealer',
    status: true,
  },
  'PATCH /api/admin/dealers/:id': {
    dealer_name: 'Best Motors LLC',
    clear_image: 'false',
  },
  'PUT /api/admin/dealers/:id/status': { status: true },
  'DELETE /api/admin/dealers/:id': null,
  'POST /api/admin/category-filters': {
    categoryId: '{{categoryId}}',
    filterIds: ['{{filterId}}'],
  },
  'POST /api/admin/roles': {
    role_name: 'Support Agent',
    description: 'Can view support',
    status: 'active',
  },
  'PATCH /api/admin/roles/:id': { role_name: 'Support Agent', description: '', status: 'active' },
  'DELETE /api/admin/roles/:id': null,
  'PUT /api/admin/roles/:id/permissions': {
    permissions: [
      {
        module_name: 'Dashboard',
        can_view: true,
        can_create: false,
        can_edit: false,
        can_delete: false,
      },
    ],
  },
}

/** @type {Record<string, Array<{ key: string, value: string, description?: string, disabled?: boolean }>>} */
const QUERY_BY_ROUTE = {
  'GET /api/categories': [
    { key: 'parent_id', value: '', description: 'Filter by parent category ObjectId' },
  ],
  'GET /api/categories/level-labels': [
    { key: 'root', value: 'motors', description: 'Root category slug' },
  ],
  'GET /api/category-filters': [
    { key: 'category_id', value: '{{categoryId}}', description: 'Category ObjectId' },
    { key: 'subcategory_id', value: '{{categoryId}}', disabled: true },
  ],
  'GET /api/filters': [
    { key: 'parentId', value: '', disabled: true },
    { key: 'categoryId', value: '{{categoryId}}', disabled: true },
  ],
  'GET /api/feed-data': [
    { key: 'page', value: '1' },
    { key: 'limit', value: '20' },
    { key: 'categoryId', value: '{{categoryId}}', disabled: true },
  ],
  'GET /api/products': [
    { key: 'page', value: '1' },
    { key: 'limit', value: '10' },
    { key: 'categoryId', value: '{{categoryId}}' },
    { key: 'subcategoryId', value: '{{categoryId}}', disabled: true },
    { key: 'minPrice', value: '0', disabled: true },
    { key: 'maxPrice', value: '500000', disabled: true },
    { key: 'search', value: 'land rover', disabled: true },
    { key: 'sortBy', value: 'newest', description: 'newest | price_asc | price_desc' },
    { key: 'location', value: 'Dubai', disabled: true },
    { key: 'filterIds', value: '{{filterId}}', disabled: true, description: 'Comma-separated Filter ObjectIds' },
  ],
  'GET /api/products/price-range': [
    { key: 'categoryId', value: '{{categoryId}}' },
  ],
  'GET /api/products/facets': [
    { key: 'categoryId', value: '{{categoryId}}' },
    { key: 'subcategoryId', value: '{{categoryId}}', disabled: true },
  ],
  'GET /api/products/reels-feed': [
    { key: 'page', value: '1' },
    { key: 'limit', value: '10' },
    { key: 'categoryId', value: '{{categoryId}}', disabled: true },
    { key: 'subcategoryId', value: '{{categoryId}}', disabled: true },
    { key: 'location', value: 'Dubai', disabled: true },
    { key: 'search', value: '', disabled: true },
    { key: 'excludeUserId', value: '', disabled: true },
    { key: 'excludeIds', value: '', disabled: true, description: 'Comma-separated product ObjectIds' },
  ],
  'GET /api/products/search': [
    { key: 'q', value: 'land rover', description: 'Search text' },
    { key: 'categoryId', value: '{{categoryId}}', disabled: true },
    { key: 'subcategoryId', value: '{{categoryId}}', disabled: true },
    { key: 'location', value: 'Dubai', disabled: true },
    { key: 'page', value: '1', disabled: true },
    { key: 'limit', value: '20', disabled: true },
    { key: 'minPrice', value: '0', disabled: true },
    { key: 'maxPrice', value: '500000', disabled: true },
  ],
  'GET /api/products/:id/related': [
    { key: 'categoryId', value: '{{categoryId}}', disabled: true },
    { key: 'subcategoryId', value: '{{categoryId}}', disabled: true },
    { key: 'location', value: 'Dubai', disabled: true },
  ],
  'GET /api/user/listings': [
    { key: 'page', value: '1' },
    { key: 'limit', value: '10' },
    { key: 'status', value: 'active', disabled: true },
  ],
  'GET /api/user/notifications': [
    { key: 'page', value: '1' },
    { key: 'limit', value: '20' },
  ],
  'GET /api/user/:id/followers': [
    { key: 'page', value: '1' },
    { key: 'limit', value: '20' },
  ],
  'GET /api/user/:id/following': [
    { key: 'page', value: '1' },
    { key: 'limit', value: '20' },
  ],
  'GET /api/chats': [
    { key: 'page', value: '1', disabled: true },
    { key: 'limit', value: '50', disabled: true },
  ],
  'GET /api/products/:id/comments': [
    { key: 'page', value: '1', disabled: true },
    { key: 'limit', value: '20', disabled: true },
  ],
  'GET /api/admin/products/pending': [
    { key: 'page', value: '1' },
    { key: 'limit', value: '20' },
    { key: 'search', value: '', disabled: true },
  ],
  'GET /api/admin/products': [
    { key: 'page', value: '1' },
    { key: 'limit', value: '20' },
    { key: 'status', value: 'active', disabled: true },
    { key: 'search', value: '', disabled: true },
  ],
  'GET /api/admin/users': [
    { key: 'page', value: '1' },
    { key: 'limit', value: '20' },
    { key: 'search', value: '', disabled: true },
    { key: 'role', value: 'user', disabled: true },
  ],
  'GET /api/admin/comments': [
    { key: 'page', value: '1' },
    { key: 'limit', value: '50' },
    { key: 'status', value: 'pending' },
    { key: 'search', value: '', disabled: true },
  ],
  'GET /api/admin/contacts': [
    { key: 'page', value: '1' },
    { key: 'limit', value: '50' },
    { key: 'search', value: '', disabled: true },
    { key: 'type', value: 'support' },
    { key: 'activeOnly', value: 'false', disabled: true },
  ],
  'GET /api/admin/categories': [
    { key: 'page', value: '1' },
    { key: 'limit', value: '100' },
    { key: 'search', value: '', disabled: true },
  ],
  'GET /api/admin/categories/children': [
    { key: 'parentId', value: '{{categoryId}}' },
  ],
  'GET /api/admin/categories/all': [
    { key: 'includeDeleted', value: 'false' },
  ],
  'GET /api/admin/categories/debug-indexes': [
    { key: 'slug', value: 'motors', disabled: true },
  ],
  'GET /api/admin/filters': [
    { key: 'page', value: '1' },
    { key: 'limit', value: '100' },
    { key: 'search', value: '', disabled: true },
  ],
  'GET /api/admin/filters/children': [
    { key: 'parentId', value: '{{filterId}}' },
  ],
  'GET /api/admin/category-filters': [
    { key: 'categoryId', value: '{{categoryId}}' },
  ],
  'GET /api/admin/dealers': [
    { key: 'page', value: '1' },
    { key: 'limit', value: '20' },
    { key: 'search', value: '', disabled: true },
  ],
  'GET /api/v1/web/search/popular': [
    { key: 'limit', value: '10' },
  ],
  'GET /api/v1/mobile/search/popular': [
    { key: 'limit', value: '10' },
  ],
}

function applyQueryParams (req, method, routePath) {
  const key = `${method.toUpperCase()} ${routePath}`
  const params = QUERY_BY_ROUTE[key]
  if (!params || !params.length) return

  req.url.query = params.map((p) => ({
    key: p.key,
    value: p.value,
    ...(p.description ? { description: p.description } : {}),
    ...(p.disabled ? { disabled: true } : {}),
  }))

  const active = params.filter((p) => !p.disabled && p.value !== '')
  if (active.length) {
    const qs = active.map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&')
    req.url.raw = `${req.url.raw}?${qs}`
  }
}

const PATH_PARAM_DEFAULTS = {
  id: '507f1f77bcf86cd799439011',
  productId: '507f1f77bcf86cd799439011',
  sellerId: '507f1f77bcf86cd799439012',
  categoryId: '507f1f77bcf86cd799439013',
  filterId: '507f1f77bcf86cd799439014',
  adminRoleId: '507f1f77bcf86cd799439015',
  chatId: '507f1f77bcf86cd799439016',
  messageId: '507f1f77bcf86cd799439017',
  commentId: '507f1f77bcf86cd799439018',
  filepath: 'images/example.jpg',
}

/** Postman v2.1 URL object — raw-only URLs often show blank in the Postman UI. */
function buildPostmanUrl (routePath) {
  const segments = routePath.split('/').filter(Boolean)
  const path = []
  const variables = []

  for (const seg of segments) {
    if (seg.startsWith(':')) {
      const key = seg.slice(1)
      path.push(`:${key}`)
      variables.push({
        key,
        value: PATH_PARAM_DEFAULTS[key] || PATH_PARAM_DEFAULTS.id,
      })
    } else {
      path.push(seg)
    }
  }

  const rawPath = segments
    .map((seg) => (seg.startsWith(':') ? `{{${seg.slice(1)}}}` : seg))
    .join('/')

  const url = {
    raw: `{{baseUrl}}/${rawPath}`,
    protocol: '{{protocol}}',
    host: ['{{host}}'],
    port: '{{port}}',
    path,
  }
  if (variables.length) url.variable = variables
  return url
}

function lookupBody (method, path) {
  const key = `${method.toUpperCase()} ${path}`
  if (Object.prototype.hasOwnProperty.call(BODY_BY_ROUTE, key)) {
    return BODY_BY_ROUTE[key]
  }
  const m = method.toUpperCase()
  if (m === 'POST' && path === '/api/chats') {
    return BODY_BY_ROUTE['POST /api/chats']
  }
  return undefined
}

function buildRequest (method, routePath, summary, secure) {
  const m = method.toLowerCase()
  const key = `${method.toUpperCase()} ${routePath}`
  const bodyTemplate = lookupBody(method, routePath)
  const hasExplicitBody = Object.prototype.hasOwnProperty.call(BODY_BY_ROUTE, key)

  const req = {
    method: method.toUpperCase(),
    header: [],
    url: buildPostmanUrl(routePath),
    description: summary,
  }
  if (secure) {
    req.header.push({ key: 'Authorization', value: 'Bearer {{token}}' })
  }

  const multipartNote = []
  if (routePath === '/api/user/profile' && m === 'post') {
    multipartNote.push('Use **body → form-data**: profilePic (file), name, city, lat, lng, skip, gender, dob, addressLine1, etc.')
  }
  if (routePath === '/api/products' && m === 'post') {
    multipartNote.push(
      '**multipart/form-data** — required: `video` (file). Often need 3+ `images` OR auto screenshots from video. All vehicle listing fields are optional. Dropdown *id fields store Filter/Category ObjectIds only (not display text). CamelCase aliases (cityId, modelId, …) also accepted.'
    )
    req.body = {
      mode: 'formdata',
      formdata: buildProductFormData({ isUpdate: false }),
    }
    return { name: `${method.toUpperCase()} ${routePath}`, request: req }
  }
  if (routePath === '/api/products/:id' && m === 'put') {
    multipartNote.push(
      '**multipart/form-data** — partial update supported. Send only fields to change. Optional vehicle fields same as create (cityid, modelid, trimid, …).'
    )
    req.body = {
      mode: 'formdata',
      formdata: buildProductFormData({ isUpdate: true }),
    }
    return { name: `${method.toUpperCase()} ${routePath}`, request: req }
  }
  if (routePath === '/api/admin/categories/import-excel') {
    multipartNote.push('**form-data**: `file` (Excel). Optional: targetCategoryId, rootCategoryId, subCategoryId.')
  }
  if (routePath === '/api/admin/filters/import-excel' || routePath === '/api/admin/filters/import') {
    multipartNote.push('**form-data**: `file` (Excel). Optional: categoryId, targetCategoryId, subcategoryId, childCategoryId.')
  }
  if (routePath === '/api/admin/filters' && m === 'post') {
    multipartNote.push('**multipart**: fields + optional `thumbImage` file.')
  }
  if (routePath === '/api/admin/filters/:id' && m === 'patch') {
    multipartNote.push('**multipart**: optional `thumbImage`; JSON fields as form fields.')
  }
  if (routePath === '/api/admin/dealers' && m === 'post') {
    multipartNote.push('**multipart**: form fields + optional `dealer_image` file.')
  }
  if (routePath === '/api/admin/dealers/:id' && m === 'patch') {
    multipartNote.push('**multipart**: optional `dealer_image`.')
  }
  if (routePath === '/api/video/transcribe') {
    multipartNote.push('**form-data**: `video` (file) + optional categoryId, subcategoryId, category, subcategory, childCategoryId.')
  }
  if (routePath === '/api/video/screenshot') {
    multipartNote.push('**form-data**: `video` (file) + `timestamp` (e.g. 2.5).')
  }

  if (multipartNote.length) {
    req.description = [summary, '', ...multipartNote].join('\n')
    if (m === 'post' || m === 'put' || m === 'patch') {
      req.body = {
        mode: 'formdata',
        formdata: [
          {
            key: '_readme',
            value: 'Add real file + fields per description above.',
            type: 'text',
            disabled: true,
          },
        ],
      }
    }
    return { name: `${method.toUpperCase()} ${routePath}`, request: req }
  }

  if (m === 'post' || m === 'put' || m === 'patch') {
    if (hasExplicitBody && bodyTemplate !== null && bodyTemplate !== undefined) {
      req.header.push({ key: 'Content-Type', value: 'application/json' })
      req.body = {
        mode: 'raw',
        raw: JSON.stringify(bodyTemplate, null, 2),
        options: { raw: { language: 'json' } },
      }
    }
    // explicit null or missing → no body
  }

  if (routePath.includes('/v1/') && routePath.includes('/search')) {
    req.header.push({ key: 'device-id', value: '{{deviceId}}' })
    if (routePath.endsWith('/search')) {
      req.url.query = [
        { key: 'keyword', value: 'land rover', description: 'Required' },
        { key: 'type', value: 'all', description: 'all | products | properties | categories | agents | agencies', disabled: true },
        { key: 'page', value: '1', disabled: true },
        { key: 'limit', value: '20', disabled: true },
        { key: 'perCategoryLimit', value: '5', disabled: true },
      ]
      req.url.raw = `${req.url.raw}?keyword=land%20rover`
    } else if (routePath.endsWith('/search/suggestions')) {
      req.url.query = [
        { key: 'keyword', value: 'iph', description: 'Required' },
        { key: 'limit', value: '10', disabled: true },
      ]
      req.url.raw = `${req.url.raw}?keyword=iph`
    }
    req.description = [
      summary,
      '',
      'Requires **device-id** header. Optional **Authorization: Bearer {{token}}** for logged-in history.',
      routePath.includes('/mobile') ? 'Mobile: set **X-Platform** to `ios` or `android`.' : '',
    ]
      .filter(Boolean)
      .join('\n')
  } else {
    applyQueryParams(req, method, routePath)
  }

  return { name: `${method.toUpperCase()} ${routePath}`, request: req }
}

// Group by tag
const byTag = new Map()
for (const [method, routePath, tag, summary, secure] of ROUTES) {
  if (routePath === '/api-docs' || routePath === '/api-docs.json') continue
  if (routePath.startsWith('/uploads/')) continue
  if (!byTag.has(tag)) byTag.set(tag, [])
  byTag.get(tag).push(buildRequest(method, routePath, summary, secure))
}

// Second pass: add WhatsApp OTP variants under Auth
const authFolder = byTag.get('Auth')
if (authFolder) {
  const sendOtpIdx = authFolder.findIndex((i) => i.name === 'POST /api/auth/send-otp')
  if (sendOtpIdx !== -1) {
    const whatsappSend = JSON.parse(JSON.stringify(authFolder[sendOtpIdx]))
    whatsappSend.name = 'POST /api/auth/send-otp (WhatsApp login)'
    whatsappSend.request.body = {
      mode: 'raw',
      raw: JSON.stringify(
        {
          channel: 'whatsapp',
          phone: '8552849180',
          phoneCountryCode: '91',
          phoneCountryIso: 'IN',
          mode: 'login',
        },
        null,
        2
      ),
      options: { raw: { language: 'json' } },
    }
    whatsappSend.request.description =
      'Send login OTP via WhatsApp (StreakMsg template). Requires existing user account.'
    authFolder.splice(sendOtpIdx + 1, 0, whatsappSend)
  }

  const verifyOtpIdx = authFolder.findIndex((i) => i.name === 'POST /api/auth/verify-otp')
  if (verifyOtpIdx !== -1) {
    const whatsappVerify = JSON.parse(JSON.stringify(authFolder[verifyOtpIdx]))
    whatsappVerify.name = 'POST /api/auth/verify-otp (WhatsApp login)'
    whatsappVerify.request.body = {
      mode: 'raw',
      raw: JSON.stringify(
        {
          channel: 'whatsapp',
          phone: '8552849180',
          phoneCountryCode: '91',
          phoneCountryIso: 'IN',
          otp: '123456',
          mode: 'login',
        },
        null,
        2
      ),
      options: { raw: { language: 'json' } },
    }
    whatsappVerify.request.description = 'Verify WhatsApp login OTP and receive JWT.'
    authFolder.splice(verifyOtpIdx + 1, 0, whatsappVerify)
  }
}

// Second pass: add dedicated "Create support chat" under Chats
const chatsFolder = byTag.get('Chats')
if (chatsFolder) {
  const createChatIdx = chatsFolder.findIndex((i) => i.name === 'POST /api/chats')
  if (createChatIdx !== -1) {
    const supportItem = JSON.parse(JSON.stringify(chatsFolder[createChatIdx]))
    supportItem.name = 'POST /api/chats (support)'
    supportItem.request.body = {
      mode: 'raw',
      raw: JSON.stringify({ type: 'support' }, null, 2),
      options: { raw: { language: 'json' } },
    }
    supportItem.request.description = 'Create or open support chat (same URL as product chat).'
    chatsFolder.splice(createChatIdx + 1, 0, supportItem)
  }
}

const collection = {
  info: {
    name: 'Preelly / Marketplace API',
    description:
      'Generated from `server/swagger/allPaths.js` and route handlers. Default **baseUrl** is `http://localhost:8029` (see server `PORT`).\n\n' +
      'Set **token** after `POST /api/auth/verify-otp` (email or WhatsApp), `POST /api/auth/verify-email-otp`, or signup verification.\n\n' +
      'Path variables like `{{id}}`, `{{productId}}` are placeholders — replace with real MongoDB ObjectIds.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'protocol', value: 'http' },
    { key: 'host', value: 'localhost' },
    { key: 'port', value: '8029' },
    { key: 'baseUrl', value: 'http://localhost:8029' },
    { key: 'token', value: '' },
    { key: 'id', value: '507f1f77bcf86cd799439011' },
    { key: 'productId', value: '507f1f77bcf86cd799439011' },
    { key: 'sellerId', value: '507f1f77bcf86cd799439012' },
    { key: 'categoryId', value: '507f1f77bcf86cd799439013' },
    { key: 'filterId', value: '507f1f77bcf86cd799439014' },
    { key: 'adminRoleId', value: '507f1f77bcf86cd799439015' },
    { key: 'chatId', value: '507f1f77bcf86cd799439016' },
    { key: 'messageId', value: '507f1f77bcf86cd799439017' },
    { key: 'commentId', value: '507f1f77bcf86cd799439018' },
    { key: 'deviceId', value: 'postman-device-001' },
  ],
  item: [...byTag.entries()].map(([name, items]) => ({
    name,
    item: items,
  })),
}

fs.writeFileSync(OUT, JSON.stringify(collection, null, 2), 'utf8')
console.log('Wrote', OUT)
