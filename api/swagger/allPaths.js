'use strict'

const { getVehicleFieldSwaggerProperties } = require('../utils/productVehicleFields')

/**
 * Full route table → OpenAPI 3.0 `paths`.
 * Path templates use Express-style :param; they are converted to {param} for OpenAPI.
 * Keep in sync with `API_LIST.md` and `server/routes/`.
 */

/** @type {Array<[method: string, path: string, tag: string, summary: string, secure: boolean]>} */
const ROUTES = [
  // Health & meta
  ['get', '/api/health', 'Health', 'Health check (works without DB)', false],
  ['get', '/api-docs', 'Meta', 'Swagger UI (HTML)', false],
  ['get', '/api-docs.json', 'Meta', 'OpenAPI specification (JSON)', false],

  // OAuth
  ['get', '/api/auth/oauth/google', 'OAuth', 'Start Google OAuth', false],
  ['get', '/api/auth/oauth/google/callback', 'OAuth', 'Google OAuth callback', false],
  ['get', '/api/auth/oauth/facebook', 'OAuth', 'Start Facebook OAuth', false],
  ['get', '/api/auth/oauth/facebook/callback', 'OAuth', 'Facebook OAuth callback', false],
  ['get', '/api/auth/oauth/instagram', 'OAuth', 'Start Instagram OAuth (link or login)', false],
  ['get', '/api/auth/oauth/instagram/callback', 'OAuth', 'Instagram OAuth callback', false],

  // Auth
  ['post', '/api/auth/register', 'Auth', 'Register; sends email OTP (+ WhatsApp OTP when mobile OTP enabled)', false],
  ['post', '/api/auth/send-email-otp', 'Auth', 'Resend email verification OTP', false],
  ['post', '/api/auth/send-phone-otp', 'Auth', 'Send signup mobile verification OTP via WhatsApp', false],
  ['post', '/api/auth/verify-email-otp', 'Auth', 'Verify email with OTP; returns JWT', false],
  ['post', '/api/auth/verify-phone-otp', 'Auth', 'Verify signup mobile OTP (WhatsApp); returns JWT when fully verified', false],
  ['post', '/api/auth/send-otp', 'Auth', 'Send login/signup OTP via email or WhatsApp (login only for WhatsApp)', false],
  ['post', '/api/auth/verify-otp', 'Auth', 'Verify OTP and sign in (email or WhatsApp channel)', false],
  ['post', '/api/auth/login', 'Auth', 'Deprecated — use send-otp + verify-otp', false],
  ['post', '/api/auth/logout', 'Auth', 'Logout; clears auth cookie', false],

  ['get', '/api/profile', 'Profile', 'Current user profile (JWT)', true],

  // Categories (public)
  ['get', '/api/categories', 'Categories', 'List categories (?parent_id=)', false],
  ['get', '/api/categories/property-categories', 'Categories', 'Property categories with subcategories', false],
  ['get', '/api/v1/web/categories/property-categories', 'Categories', 'Property categories with subcategories (v1 web)', false],
  ['get', '/api/v1/mobile/categories/property-categories', 'Categories', 'Property categories with subcategories (v1 mobile)', false],
  ['get', '/api/v1/classifieds/categories', 'Categories', 'Get Classified Categories', false],
  ['get', '/api/v1/web/filters/:categoryId', 'Filters', 'Active filters for category and subcategories (v1 web)', false],
  ['get', '/api/v1/mobile/filters/:categoryId', 'Filters', 'Active filters for category and subcategories (v1 mobile)', false],

  // Global search (v1)
  ['get', '/api/v1/web/search', 'Web - Search', 'Global search with categorized results (web)', false],
  ['get', '/api/v1/web/search/recent', 'Web - Search', 'Recent searches for user or device (web)', false],
  ['delete', '/api/v1/web/search/recent', 'Web - Search', 'Clear recent searches for user or device (web)', false],
  ['get', '/api/v1/web/search/popular', 'Web - Search', 'Popular searches by search count (web)', false],
  ['get', '/api/v1/web/search/suggestions', 'Web - Search', 'Search keyword suggestions (web)', false],
  ['get', '/api/v1/mobile/search', 'Mobile - Search', 'Global search with categorized results (mobile)', false],
  ['get', '/api/v1/mobile/search/recent', 'Mobile - Search', 'Recent searches for user or device (mobile)', false],
  ['delete', '/api/v1/mobile/search/recent', 'Mobile - Search', 'Clear recent searches for user or device (mobile)', false],
  ['get', '/api/v1/mobile/search/popular', 'Mobile - Search', 'Popular searches by search count (mobile)', false],
  ['get', '/api/v1/mobile/search/suggestions', 'Mobile - Search', 'Search keyword suggestions (mobile)', false],
  ['get', '/api/categories/roots', 'Categories', 'Root categories with counts', false],
  ['get', '/api/categories/level-labels', 'Categories', 'Level labels (?root=)', false],
  ['get', '/api/categories/:id/path', 'Categories', 'Category breadcrumb path', false],
  ['get', '/api/categories/:id', 'Categories', 'Category by ID', false],

  ['get', '/api/filters', 'Filters', 'List filters', false],
  ['get', '/api/category-filters', 'Filters', 'Filters for category (?category_id= etc.)', false],

  ['get', '/api/feed-data', 'Feed', 'Optimized feed payload', false],

  // User
  ['get', '/api/user/reels-progress', 'User', 'Get reels scroll position', true],
  ['put', '/api/user/reels-progress', 'User', 'Update reels scroll position', true],
  ['get', '/api/user/dashboard', 'User', 'Dashboard data', true],
  ['get', '/api/user/listings', 'User', 'User listings', true],
  ['get', '/api/user/orders', 'User', 'User orders', true],
  ['get', '/api/user/wishlist', 'User', 'Wishlist', true],
  ['get', '/api/user/notifications', 'User', 'Notifications', true],
  ['get', '/api/user/:id/profile', 'User', 'Public profile by user ID', false],
  ['get', '/api/user/:id/followers', 'User', 'Followers list', false],
  ['get', '/api/user/:id/following', 'User', 'Following list', false],
  ['get', '/api/user/profile', 'User', 'Current user profile', true],
  ['post', '/api/user/profile', 'User', 'Update profile (multipart: profilePic)', true],
  ['put', '/api/user/profile', 'User', 'Update profile fields', true],

  // Interactions
  ['post', '/api/products/:id/like', 'Interactions', 'Like / unlike product', true],
  ['post', '/api/products/:id/view', 'Interactions', 'Record product view', false],
  ['post', '/api/products/:id/save', 'Interactions', 'Save / unsave product', true],
  ['get', '/api/user/saved', 'Interactions', 'Saved products for current user', true],
  ['post', '/api/user/:id/follow', 'Interactions', 'Follow / unfollow user', true],
  ['get', '/api/products/:id/liked', 'Interactions', 'Whether current user liked product', true],
  ['get', '/api/products/:id/saved', 'Interactions', 'Whether current user saved product', true],
  ['post', '/api/products/:id/report', 'Interactions', 'Report product', true],
  ['get', '/api/products/:id/comments', 'Interactions', 'List comments', false],
  ['post', '/api/products/:id/comments', 'Interactions', 'Add comment', true],
  ['post', '/api/comments/:id/report', 'Interactions', 'Report comment', true],
  ['delete', '/api/comments/:id', 'Interactions', 'Delete comment', true],
  ['post', '/api/comments/:id/like', 'Interactions', 'Like comment', true],
  ['get', '/api/products/:id/comments/count', 'Interactions', 'Comment count', false],

  // Chats
  ['get', '/api/chats', 'Chats', 'List chats', true],
  ['get', '/api/chats/unread-count', 'Chats', 'Unread message count', true],
  ['get', '/api/chats/:id', 'Chats', 'Chat by ID', true],
  ['post', '/api/chats', 'Chats', 'Create or open chat', true],
  ['post', '/api/chats/:id/messages', 'Chats', 'Send message', true],
  ['delete', '/api/chats/:chatId/messages/:messageId', 'Chats', 'Delete message', true],
  ['put', '/api/chats/:id/read', 'Chats', 'Mark chat as read', true],
  ['delete', '/api/chats/:id', 'Chats', 'Delete chat', true],

  // Products
  ['get', '/api/products/price-range', 'Products', 'Min/max price (?categoryId=)', false],
  ['get', '/api/products/facets', 'Products', 'Filter facets (?categoryId=, ?subcategoryId=)', false],
  ['get', '/api/products', 'Products', 'List / filter / paginate', false],
  ['get', '/api/products/reels-feed', 'Products', 'Reels feed', false],
  ['get', '/api/products/:id/related', 'Products', 'Related products', false],
  ['get', '/api/products/search', 'Products', 'Search products', false],
  ['get', '/api/products/:id', 'Products', 'Product by ID', false],
  ['post', '/api/products', 'Products', 'Create listing (multipart: video, images)', true],
  ['put', '/api/products/:id/resubmit', 'Products', 'Resubmit rejected listing', true],
  ['put', '/api/products/:id', 'Products', 'Update listing (multipart)', true],
  ['delete', '/api/products/:id', 'Products', 'Delete listing', true],

  // AI
  ['post', '/api/ai/enhance-description', 'AI', 'Enhance listing description', true],
  ['post', '/api/listings/ai-extract', 'AI', 'Extract car listing from input_text', true],

  // Video
  ['post', '/api/video/transcribe', 'Video', 'Transcribe video (multipart)', true],
  ['post', '/api/video/screenshot', 'Video', 'Screenshot from video (multipart)', true],

  // Admin — products & stats
  ['get', '/api/admin/products/pending', 'Admin', 'Pending products', true],
  ['get', '/api/admin/products', 'Admin', 'All products (admin)', true],
  ['put', '/api/admin/products/:id/approve', 'Admin', 'Approve product', true],
  ['put', '/api/admin/products/:id/reject', 'Admin', 'Reject product', true],
  ['get', '/api/admin/products/rejection-reasons', 'Admin', 'Rejection reason options', true],
  ['put', '/api/admin/products/:id/status', 'Admin', 'Set product status', true],
  ['get', '/api/admin/stats', 'Admin', 'Dashboard statistics', true],

  // Admin — users
  ['get', '/api/admin/users', 'Admin', 'List users', true],
  ['post', '/api/admin/users', 'Admin', 'Create user', true],
  ['put', '/api/admin/users/:id/verify', 'Admin', 'Verify / unverify user', true],
  ['put', '/api/admin/users/:id/role', 'Admin', 'Set user role', true],
  ['put', '/api/admin/users/:id/status', 'Admin', 'Set user status', true],
  ['put', '/api/admin/users/:id/admin-role', 'Admin', 'Assign admin role', true],

  // Admin — comments & reports
  ['get', '/api/admin/comments', 'Admin', 'Comments for moderation', true],
  ['put', '/api/admin/comments/:id/approve', 'Admin', 'Approve comment', true],
  ['put', '/api/admin/comments/:id/reject', 'Admin', 'Reject comment', true],
  ['get', '/api/admin/reported-comments', 'Admin', 'Reported comments', true],
  ['put', '/api/admin/reported-comments/comment/:commentId/action', 'Admin', 'Resolve reported comment', true],

  // Admin — support
  ['get', '/api/admin/support-unread-count', 'Admin', 'Support unread count', true],
  ['get', '/api/admin/contacts', 'Admin', 'Support contacts / threads', true],

  // Admin — categories
  ['get', '/api/admin/categories', 'Admin', 'Categories (paginated)', true],
  ['get', '/api/admin/categories/children', 'Admin', 'Category children (?parentId=)', true],
  ['get', '/api/admin/categories/nested-for-filters', 'Admin', 'Nested categories for filters UI', true],
  ['post', '/api/admin/categories/import-excel', 'Admin', 'Import categories from Excel (multipart)', true],
  ['get', '/api/admin/categories/debug-indexes', 'Admin', 'Debug MongoDB indexes (?slug=)', true],
  ['post', '/api/admin/categories', 'Admin', 'Create category', true],
  ['get', '/api/admin/categories/tree', 'Admin', 'Full category tree', true],
  ['get', '/api/admin/categories/:id/ancestors', 'Admin', 'Category ancestors', true],
  ['get', '/api/admin/categories/:id/path', 'Admin', 'Category path', true],
  ['patch', '/api/admin/categories/:id', 'Admin', 'Update category', true],
  ['delete', '/api/admin/categories/:id', 'Admin', 'Soft-delete category (+ descendants)', true],
  ['get', '/api/admin/categories/all', 'Admin', 'All categories (?includeDeleted=)', true],

  // Admin — filters
  ['get', '/api/admin/filters', 'Admin', 'Filters (paginated)', true],
  ['get', '/api/admin/filters/tree', 'Admin', 'Filter tree', true],
  ['get', '/api/admin/filters/children', 'Admin', 'Filter children (?parentId=)', true],
  ['post', '/api/admin/filters/import-excel', 'Admin', 'Import filters Excel (multipart)', true],
  ['post', '/api/admin/filters/import', 'Admin', 'Import filters (alias)', true],
  ['post', '/api/admin/filters', 'Admin', 'Create filter (multipart: thumbImage)', true],
  ['patch', '/api/admin/filters/:id', 'Admin', 'Update filter (multipart)', true],
  ['delete', '/api/admin/filters/:id', 'Admin', 'Soft-delete filter', true],

  // Admin — dealers
  ['get', '/api/admin/dealers', 'Admin', 'List dealers', true],
  ['get', '/api/admin/dealers/:id', 'Admin', 'Dealer by ID', true],
  ['post', '/api/admin/dealers', 'Admin', 'Create dealer (multipart: dealer_image)', true],
  ['patch', '/api/admin/dealers/:id', 'Admin', 'Update dealer (multipart)', true],
  ['put', '/api/admin/dealers/:id/status', 'Admin', 'Toggle dealer status', true],
  ['delete', '/api/admin/dealers/:id', 'Admin', 'Delete dealer', true],

  // Admin — category-filters
  ['get', '/api/admin/category-filters', 'Admin', 'Category–filter assignments', true],
  ['post', '/api/admin/category-filters', 'Admin', 'Assign filters to category', true],

  // Admin — roles & permissions
  ['get', '/api/admin/roles', 'Admin', 'List admin roles', true],
  ['get', '/api/admin/roles/:id', 'Admin', 'Role by ID', true],
  ['post', '/api/admin/roles', 'Admin', 'Create role', true],
  ['patch', '/api/admin/roles/:id', 'Admin', 'Update role', true],
  ['delete', '/api/admin/roles/:id', 'Admin', 'Delete role', true],
  ['get', '/api/admin/roles/:id/permissions', 'Admin', 'Permissions for role', true],
  ['put', '/api/admin/roles/:id/permissions', 'Admin', 'Update role permissions', true],
  ['get', '/api/admin/modules', 'Admin', 'Permission modules list', true],

  // Static
  ['get', '/uploads/{filepath}', 'Uploads', 'Static files (images, videos, etc.) — path under /uploads/', false],
]

const TAG_DESCRIPTIONS = [
  { name: 'Health', description: 'Liveness and readiness' },
  { name: 'Meta', description: 'API documentation endpoints' },
  { name: 'OAuth', description: 'Google / Facebook sign-in' },
  { name: 'Auth', description: 'Registration, email/WhatsApp OTP login, JWT cookies' },
  { name: 'Profile', description: 'Authenticated profile shortcut' },
  { name: 'Categories', description: 'Public category tree' },
  { name: 'Filters', description: 'Public filters and category filters' },
  { name: 'Feed', description: 'Feed payloads' },
  { name: 'User', description: 'User dashboard, profile, listings' },
  { name: 'Interactions', description: 'Likes, saves, comments, follow' },
  { name: 'Chats', description: 'Messaging' },
  { name: 'Products', description: 'Listings CRUD and search' },
  { name: 'Web - Search', description: 'Global search, history, and suggestions (web platform)' },
  { name: 'Mobile - Search', description: 'Global search, history, and suggestions (mobile platform)' },
  { name: 'AI', description: 'Description enhancement and extraction' },
  { name: 'Video', description: 'Transcription and screenshots' },
  { name: 'Admin', description: 'Admin-only; requires JWT with admin role' },
  { name: 'Uploads', description: 'Public static file serving' },
]

function expressPathToOpenAPI (path) {
  return path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '{$1}')
}

function pathParamsFor (openApiPath) {
  const re = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g
  const out = []
  let m
  while ((m = re.exec(openApiPath)) !== null) {
    const name = m[1]
    if (name === 'filepath') {
      out.push({
        name: 'filepath',
        in: 'path',
        required: true,
        description: 'File path relative to /uploads',
        schema: { type: 'string' },
      })
    } else {
      out.push({
        name,
        in: 'path',
        required: true,
        schema: { type: 'string' },
        description: 'Resource id (typically MongoDB ObjectId)',
      })
    }
  }
  return out.length ? out : undefined
}

function buildProductMultipartRequestBody(isUpdate = false) {
  const vehicleProps = getVehicleFieldSwaggerProperties()
  const baseProps = {
    title: { type: 'string' },
    description: { type: 'string' },
    price: { type: 'number' },
    currency: { type: 'string' },
    category: { type: 'string', description: 'Category ObjectId' },
    subcategory: { type: 'string', description: 'Subcategory ObjectId' },
    location: { type: 'string' },
    country: { type: 'string' },
    city: { type: 'string' },
    area: { type: 'string' },
    brand: { type: 'string' },
    condition: { type: 'string' },
    contactPhone: { type: 'string' },
    categoryPath: { type: 'string', description: 'JSON array of category ObjectIds' },
    video: { type: 'string', format: 'binary', description: isUpdate ? 'Optional replacement video' : 'Required on create' },
    images: { type: 'array', items: { type: 'string', format: 'binary' } },
    ...vehicleProps,
  }
  if (isUpdate) {
    baseProps.status = { type: 'string', description: 'Admin or owner status update' }
  }
  return {
    required: true,
    content: {
      'multipart/form-data': {
        schema: {
          type: 'object',
          properties: baseProps,
        },
      },
    },
  }
}

function routeExtensions(method, openApiPath) {
  if (openApiPath === '/api/products' && method === 'post') {
    return {
      requestBody: buildProductMultipartRequestBody(false),
      description:
        'Create a listing. All vehicle listing fields (cityId, modelId, trimId, etc.) are optional. ' +
        'Dropdown fields ending in Id store Filter or Category ObjectIds — not display text. ' +
        'Lowercase aliases (cityid, modelid, …) are also accepted.',
    }
  }
  if (openApiPath === '/api/products/{id}' && method === 'put') {
    return {
      requestBody: buildProductMultipartRequestBody(true),
      description:
        'Update a listing. Partial updates supported — send only fields to change. ' +
        'Optional vehicle listing fields use the same schema as create.',
    }
  }
  if (openApiPath === '/api/products/{id}' && method === 'get') {
    return {
      description: 'Product detail includes optional vehicle listing fields when set (cityId, modelId, kilometers, etc.).',
    }
  }
  if (openApiPath === '/api/products' && method === 'get') {
    return {
      description: 'Product listing includes optional vehicle listing fields on each item when set.',
    }
  }
  if (openApiPath === '/api/v1/web/search' || openApiPath === '/api/v1/mobile/search') {
    return {
      description:
        'Search across products, properties, categories, agents (users), and agencies (dealers). ' +
        'Requires `device-id` header. Saves search history asynchronously. Works for guests and authenticated users.',
      parameters: [
        { name: 'device-id', in: 'header', required: true, schema: { type: 'string', example: 'abc123-device-uuid' } },
        { name: 'keyword', in: 'query', required: true, schema: { type: 'string', example: 'land rover' } },
        {
          name: 'type',
          in: 'query',
          schema: {
            type: 'string',
            enum: ['all', 'products', 'properties', 'categories', 'agents', 'agencies'],
            default: 'all',
          },
        },
        { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 } },
        { name: 'perCategoryLimit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 20, default: 5 } },
        { name: 'Authorization', in: 'header', schema: { type: 'string' }, description: 'Bearer JWT (optional)' },
      ],
      responses: {
        200: {
          description: 'Categorized search results',
          content: {
            'application/json': {
              example: {
                success: true,
                message: 'Search results fetched',
                data: {
                  results: {
                    products: [{ _id: '64a1b2c3d4e5f6a7b8c9d0e1', title: 'Land Rover Discovery', price: 185000 }],
                    properties: [],
                    categories: [{ _id: '64a1b2c3d4e5f6a7b8c9d0e2', name: 'Property', slug: 'property' }],
                    agents: [{ _id: '64a1b2c3d4e5f6a7b8c9d0e3', name: 'John Seller' }],
                    agencies: [{ _id: '64a1b2c3d4e5f6a7b8c9d0e4', name: 'Premium Motors' }],
                    projects: [],
                    blogs: [],
                  },
                },
                meta: { page: 1, limit: 5, total: 12, totalPages: 1, hasMore: true, perCategoryLimit: 5 },
              },
            },
          },
        },
        400: { description: 'Validation error or missing device-id' },
      },
    }
  }
  if (openApiPath === '/api/v1/web/search/recent' || openApiPath === '/api/v1/mobile/search/recent') {
    return {
      description:
        'Returns the 10 most recent unique keywords. Uses userId when logged in, otherwise deviceId.',
      parameters: [
        { name: 'device-id', in: 'header', required: true, schema: { type: 'string', example: 'abc123-device-uuid' } },
        { name: 'Authorization', in: 'header', schema: { type: 'string' }, description: 'Bearer JWT (optional)' },
      ],
      responses: {
        200: {
          description: 'Recent search keywords',
          content: {
            'application/json': {
              example: {
                success: true,
                message: 'Recent searches fetched',
                data: { keywords: ['land rover', 'iphone', 'dubai apartment'] },
              },
            },
          },
        },
      },
    }
  }
  if (openApiPath === '/api/v1/web/search/suggestions' || openApiPath === '/api/v1/mobile/search/suggestions') {
    return {
      description: 'Keyword suggestions from search history and searchable entities.',
      parameters: [
        { name: 'device-id', in: 'header', required: true, schema: { type: 'string', example: 'abc123-device-uuid' } },
        { name: 'keyword', in: 'query', required: true, schema: { type: 'string', example: 'iph' } },
        { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 20, default: 10 } },
        { name: 'Authorization', in: 'header', schema: { type: 'string' }, description: 'Bearer JWT (optional)' },
      ],
      responses: {
        200: {
          description: 'Matching suggestions',
          content: {
            'application/json': {
              example: {
                success: true,
                message: 'Search suggestions fetched',
                data: { suggestions: ['iphone', 'iphone 14', 'iphone 15 pro'] },
              },
            },
          },
        },
      },
    }
  }
  if (openApiPath === '/api/v1/web/filters/{categoryId}' || openApiPath === '/api/v1/mobile/filters/{categoryId}') {
    return {
      description:
        'Returns active filter groups with deduplicated values for the given category and all active descendant categories. ' +
        'Merges direct scope fields (`categoryId`, `subcategoryId`, `childCategoryId`) with legacy `CategoryFilter` pivot links.',
      responses: {
        200: {
          description: 'Category filters fetched successfully',
          content: {
            'application/json': {
              example: {
                success: true,
                message: 'Category filters fetched successfully',
                data: {
                  categoryId: '507f1f77bcf86cd799439011',
                  filters: [
                    {
                      filterId: '507f191e810c19729de860ea',
                      filterName: 'Property Type',
                      slug: 'property-type',
                      values: [
                        { id: '507f191e810c19729de860eb', name: 'Apartment' },
                        { id: '507f191e810c19729de860ec', name: 'Villa' },
                      ],
                    },
                  ],
                },
                meta: null,
              },
            },
          },
        },
        400: { description: 'Invalid categoryId' },
        404: { description: 'Category not found or inactive' },
      },
    }
  }
  return {}
}

function buildPaths () {
  /** @type {Record<string, Record<string, unknown>>} */
  const paths = {}
  for (const [method, path, tag, summary, secure] of ROUTES) {
    const openApiPath = expressPathToOpenAPI(path)
    const m = method.toLowerCase()
    if (!paths[openApiPath]) paths[openApiPath] = {}
    if (paths[openApiPath][m]) {
      throw new Error(`Duplicate ${m.toUpperCase()} ${openApiPath} in swagger/allPaths.js`)
    }
    const parameters = pathParamsFor(openApiPath)
    const extensions = routeExtensions(m, openApiPath)
    const defaultResponses = {
      200: { description: 'Success' },
      400: { description: 'Bad request' },
      401: { description: 'Unauthorized — missing or invalid JWT' },
      403: { description: 'Forbidden' },
      404: { description: 'Not found' },
      500: { description: 'Server error' },
      503: { description: 'Database unavailable (most /api routes)' },
    }
    const { responses: extensionResponses, ...restExtensions } = extensions
    paths[openApiPath][m] = {
      tags: [tag],
      summary,
      ...(secure ? { security: [{ bearerAuth: [] }] } : {}),
      ...(parameters ? { parameters } : {}),
      ...restExtensions,
      responses: {
        ...defaultResponses,
        ...(extensionResponses || {}),
      },
    }
  }
  return paths
}

function getTagDefinitions () {
  return TAG_DESCRIPTIONS
}

module.exports = { ROUTES, buildPaths, getTagDefinitions, expressPathToOpenAPI }
