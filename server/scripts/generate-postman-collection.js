#!/usr/bin/env node
'use strict'

/**
 * Generates Preelly-API.postman_collection.json from swagger/allPaths.js ROUTES
 * plus inline body templates for mutating endpoints.
 */
const fs = require('fs')
const path = require('path')
const { ROUTES } = require('../swagger/allPaths')

const OUT = path.join(__dirname, '..', '..', 'Preelly-API.postman_collection.json')

/** @type {Record<string, object | null>} key = "METHOD path" */
const BODY_BY_ROUTE = {
  'POST /api/auth/register': {
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '+971500000000',
    password: 'secret12',
  },
  'POST /api/auth/send-email-otp': { email: 'jane@example.com' },
  'POST /api/auth/verify-email-otp': { email: 'jane@example.com', otp: '123456' },
  'POST /api/auth/login': { email: 'jane@example.com', password: 'secret12' },
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

function expressPathToPostmanUrl (p) {
  return p.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, name) => `{{${name}}}`)
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
  const urlPath = expressPathToPostmanUrl(routePath)
  const fullUrl = `{{baseUrl}}${urlPath}`
  const m = method.toLowerCase()
  const key = `${method.toUpperCase()} ${routePath}`
  const bodyTemplate = lookupBody(method, routePath)
  const hasExplicitBody = Object.prototype.hasOwnProperty.call(BODY_BY_ROUTE, key)

  const req = {
    method: method.toUpperCase(),
    header: [],
    url: { raw: fullUrl },
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
      '**multipart/form-data** — required: `video` (file). Often need 3+ `images` OR auto screenshots from video. Text fields: title, description, price, currency, category, subcategory, location, country, city, area, brand, condition, … JSON strings: categoryPath, dimensions, deliveryOptions, contactOptions, display_data, filter_data, filter_* keys.'
    )
  }
  if (routePath === '/api/products/:id' && m === 'put') {
    multipartNote.push('**multipart/form-data** — optional `video`, `images`; other fields same as create.')
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
      'Generated from `server/swagger/allPaths.js` and route handlers. Default **baseUrl** is `http://localhost:5002` (see server `PORT`).\n\n' +
      'Set **token** after `POST /api/auth/login` or `POST /api/auth/verify-email-otp`.\n\n' +
      'Path variables like `{{id}}`, `{{productId}}` are placeholders — replace with real MongoDB ObjectIds.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:5002' },
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
  ],
  item: [...byTag.entries()].map(([name, items]) => ({
    name,
    item: items,
  })),
}

fs.writeFileSync(OUT, JSON.stringify(collection, null, 2), 'utf8')
console.log('Wrote', OUT)
