/**
 * Generates separate Mobile and Web API Excel lists (v1 paths) with request parameters.
 * Run: node scripts/generate-platform-api-excel.js
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const ROUTES_DIR = path.join(ROOT, 'server/routes')
const V1_DIR = path.join(ROOT, 'server/api/v1')
const VALIDATORS_DIR = path.join(ROOT, 'server/core/validators')
const OUT_DIR = path.join(ROOT, 'docs')
const MOBILE_FILE = path.join(OUT_DIR, 'API_List_Mobile.xlsx')
const WEB_FILE = path.join(OUT_DIR, 'API_List_Web.xlsx')

const MOUNT_PREFIX = {
  'oauth.js': '/api/auth/oauth',
  'auth.js': '/api/auth',
  'profile.js': '/api',
  'categories.js': '/api/categories',
  'filters.js': '/api/filters',
  'categoryFilters.js': '/api/category-filters',
  'user.js': '/api/user',
  'chats.js': '/api/chats',
  'feedData.js': '/api',
  'interactions.js': '/api',
  'products.js': '/api/products',
  'admin.js': '/api/admin',
  'ai.js': '/api',
  'video.js': '/api/video',
  'streaming.js': '/api/streaming',
}

const MODULE_NAME = {
  'oauth.js': 'OAuth',
  'auth.js': 'Auth',
  'profile.js': 'Profile',
  'categories.js': 'Categories',
  'filters.js': 'Filters',
  'categoryFilters.js': 'Category Filters',
  'user.js': 'User',
  'chats.js': 'Chats',
  'feedData.js': 'Feed',
  'interactions.js': 'Interactions',
  'products.js': 'Products',
  'admin.js': 'Admin',
  'ai.js': 'AI',
  'video.js': 'Video',
  'streaming.js': 'Streaming',
}

const V1_MOUNT = {
  mobile: { 'products.routes.js': '/api/v1/mobile/products' },
  web: { 'products.routes.js': '/api/v1/web/products' },
}

const HEADERS = [
  'S.No',
  'Module',
  'Method',
  'Endpoint (v1)',
  'Legacy Endpoint',
  'Description',
  'Required Headers',
  'Path Parameters',
  'Query Parameters',
  'Request Body',
  'Content-Type',
  'Example Request',
  'Access',
  'Authentication',
  'Status',
  'Source File',
  'Line',
]

const EXAMPLE_VALUES = {
  email: 'user@example.com',
  phone: '+971501234567',
  name: 'John Doe',
  password: 'secret123',
  otp: '123456',
  title: 'iPhone 14 Pro',
  description: 'Excellent condition',
  price: 3500,
  currency: 'AED',
  categoryId: '64a1b2c3d4e5f6a7b8c9d0e1',
  id: '64a1b2c3d4e5f6a7b8c9d0e1',
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  mode: 'login',
  channel: 'email',
  phoneCountryCode: '91',
  phoneCountryIso: 'IN',
  text: 'Hello, is this available?',
  reason: 'Spam',
  callType: 'video',
  status: 'completed',
  duration: 120,
  type: 'support',
  productId: '64a1b2c3d4e5f6a7b8c9d0e1',
  sellerId: '64a1b2c3d4e5f6a7b8c9d0e2',
}

// ── Parameter extraction ─────────────────────────────────────────────────────

function findHandlerEnd(lines, startIdx) {
  for (let i = startIdx + 1; i < lines.length; i++) {
    const t = lines[i].trim()
    if (/^router\.(get|post|put|patch|delete|all)\(/.test(t)) return i
    if (/^\/\/ @route\s/.test(t)) return i
  }
  return Math.min(startIdx + 250, lines.length)
}

function parseEndpointQueryString(endpoint) {
  const idx = endpoint.indexOf('?')
  if (idx === -1) return { path: endpoint, queryFromPath: [] }
  const path = endpoint.slice(0, idx)
  const queryFromPath = endpoint
    .slice(idx + 1)
    .split('&')
    .map((part) => {
      const [name, example] = part.split('=')
      return name ? { name: name.trim(), example: (example || '').trim() } : null
    })
    .filter(Boolean)
  return { path, queryFromPath }
}

function addParam(map, name, meta) {
  if (!name || name === 'req' || name === 'res' || name === 'next') return
  const existing = map.get(name)
  if (existing) {
    map.set(name, { ...existing, ...meta, required: existing.required || meta.required })
    return
  }
  map.set(name, meta)
}

function parseValidatorChains(block) {
  const path = new Map()
  const query = new Map()
  const body = new Map()

  const re = /(body|query|param)\(\s*['"`](\w+)['"`]\s*\)([^;\n]*)/g
  let m
  while ((m = re.exec(block)) !== null) {
    const [, kind, name, chain] = m
    const optional = /\.optional\(/.test(chain)
    const map = kind === 'body' ? body : kind === 'query' ? query : path
    let type = 'string'
    if (/isEmail\(/.test(chain)) type = 'email'
    else if (/isInt\(|isNumeric\(/.test(chain)) type = 'number'
    else if (/isMongoId\(/.test(chain)) type = 'ObjectId'
    else if (/isBoolean\(/.test(chain)) type = 'boolean'
    else if (/isIn\(/.test(chain)) {
      const inMatch = chain.match(/isIn\(\[([^\]]+)\]/)
      type = inMatch ? `enum(${inMatch[1].replace(/['"`]/g, '')})` : 'enum'
    } else if (/isLength\(/.test(chain)) type = 'string'

    addParam(map, name, {
      in: kind,
      type,
      required: kind === 'param' ? !optional : !optional && /\.notEmpty\(|\.isEmail\(|\.isMongoId\(|\.isLength\(/.test(chain),
      optional,
      source: 'validator',
    })
  }
  return { path, query, body }
}

function parseDestructuring(block, source) {
  const map = new Map()
  const re = new RegExp(`(?:const|let)\\s*\\{([^}]+)\\}\\s*=\\s*req\\.${source}`, 'g')
  let m
  while ((m = re.exec(block)) !== null) {
    m[1].split(',').forEach((part) => {
      const trimmed = part.trim()
      const defMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/)
      const name = defMatch ? defMatch[1] : trimmed.replace(/\s*=.*/, '').trim()
      const defaultVal = defMatch ? defMatch[2].trim() : null
      if (/^\w+$/.test(name)) {
        addParam(map, name, {
          in: source,
          type: 'string',
          required: false,
          default: defaultVal,
          source: 'destructure',
        })
      }
    })
  }
  return map
}

function parseReqAccess(block, source) {
  const map = new Map()
  const patterns = [
    new RegExp(`req\\.${source}\\.(\\w+)`, 'g'),
    new RegExp(`req\\.${source}\\??\\.\\(\\s*['"\`](\\w+)['"\`]`, 'g'),
    new RegExp(`req\\.${source}\\[['"\`](\\w+)['"\`]\\]`, 'g'),
  ]
  for (const re of patterns) {
    let m
    while ((m = re.exec(block)) !== null) {
      addParam(map, m[1], { in: source, type: 'string', required: false, source: 'access' })
    }
  }
  return map
}

function parseUploadFields(block) {
  const fields = []
  const re = /\{\s*name:\s*['"`](\w+)['"`][^}]*maxCount:\s*(\d+)/g
  let m
  while ((m = re.exec(block)) !== null) {
    fields.push({ name: m[1], maxCount: Number(m[2]) })
  }
  if (/upload\.single\(/.test(block)) {
    const s = block.match(/upload\.single\(['"`](\w+)['"`]\)/)
    if (s) fields.push({ name: s[1], maxCount: 1 })
  }
  return fields
}

function mergeMaps(...maps) {
  const out = new Map()
  for (const map of maps) {
    for (const [k, v] of map) addParam(out, k, v)
  }
  return out
}

function formatParamList(map, uploadFields = []) {
  const parts = []
  for (const [name, meta] of map) {
    const req = meta.required ? 'required' : 'optional'
    const def = meta.default ? `, default: ${meta.default}` : ''
    parts.push(`${name} (${meta.type || 'string'}, ${req}${def})`)
  }
  for (const f of uploadFields) {
    parts.push(`${f.name} (file, max ${f.maxCount})`)
  }
  return parts.join('; ') || '—'
}

function exampleValue(name, meta) {
  if (EXAMPLE_VALUES[name] !== undefined) return EXAMPLE_VALUES[name]
  if (meta?.type === 'number') return 1
  if (meta?.type === 'boolean') return true
  if (meta?.type === 'ObjectId') return '64a1b2c3d4e5f6a7b8c9d0e1'
  if (meta?.type === 'email') return 'user@example.com'
  if (name.endsWith('Id') || name.endsWith('_id')) return '64a1b2c3d4e5f6a7b8c9d0e1'
  return 'string'
}

function buildExampleRequest(method, endpoint, queryMap, bodyMap, uploadFields, contentType) {
  const cleanEndpoint = endpoint.split('?')[0].replace(/\/+$/, '') || endpoint
  if (method === 'GET' || method === 'DELETE') {
    if (queryMap.size === 0) return `${method} ${cleanEndpoint}`
    const qs = [...queryMap.entries()]
      .slice(0, 8)
      .map(([k, meta]) => `${k}=${encodeURIComponent(exampleValue(k, meta))}`)
      .join('&')
    return `${method} ${cleanEndpoint}?${qs}`
  }

  if (uploadFields.length > 0) {
    const fieldList = uploadFields.map((f) => `${f.name}=@file`).join(', ')
    return `POST ${cleanEndpoint} (multipart/form-data: ${fieldList}${bodyMap.size ? ' + JSON fields' : ''})`
  }

  if (bodyMap.size === 0) {
    return method === 'POST' || method === 'PUT' || method === 'PATCH'
      ? `${method} ${cleanEndpoint} (no body)`
      : `${method} ${cleanEndpoint}`
  }

  const obj = {}
  for (const [name, meta] of bodyMap) {
    obj[name] = exampleValue(name, meta)
  }
  return `${method} ${cleanEndpoint}\n${JSON.stringify(obj, null, 2)}`
}

function inferRequiredHeaders(platform, auth, contentType, module) {
  const headers = []
  const authLower = String(auth || '').toLowerCase()

  if (platform === 'mobile') {
    if (authLower.includes('jwt') || authLower.includes('private') || authLower.includes('admin')) {
      headers.push('Authorization: Bearer {token}')
    } else {
      headers.push('Authorization: Bearer {token} (optional)')
    }
    headers.push('X-App-Version: 1.0.0')
    headers.push('X-Platform: ios | android')
  } else {
    if (authLower.includes('admin')) {
      headers.push('Authorization: Bearer {token}')
      headers.push('Cookie: token={jwt}')
    } else if (authLower.includes('private') || authLower.includes('jwt')) {
      headers.push('Authorization: Bearer {token}')
      headers.push('Cookie: token={jwt} (optional alternative)')
    } else {
      headers.push('Authorization: Bearer {token} (optional)')
      headers.push('Cookie: token={jwt} (optional)')
    }
  }

  if (contentType && contentType !== '—') headers.push(`Content-Type: ${contentType}`)
  if (module === 'OAuth') headers.push('Accept: text/html (redirect flow)')

  return headers.join('; ')
}

function extractRouteParams(lines, startIdx, routePath, method, endpoint, access, module) {
  const endIdx = findHandlerEnd(lines, startIdx)
  const block = lines.slice(startIdx, endIdx).join('\n')
  const { queryFromPath } = parseEndpointQueryString(endpoint)

  const pathMap = new Map()
  for (const m of routePath.matchAll(/:(\w+)/g)) {
    addParam(pathMap, m[1], { in: 'path', type: 'ObjectId|string', required: true, source: 'path' })
  }
  for (const m of endpoint.matchAll(/:(\w+)/g)) {
    addParam(pathMap, m[1], { in: 'path', type: 'ObjectId|string', required: true, source: 'path' })
  }

  const validators = parseValidatorChains(block)
  const queryMap = mergeMaps(
    validators.query,
    parseDestructuring(block, 'query'),
    parseReqAccess(block, 'query'),
  )
  const bodyMap = mergeMaps(validators.body, parseDestructuring(block, 'body'), parseReqAccess(block, 'body'))

  for (const q of queryFromPath) {
    addParam(queryMap, q.name, {
      in: 'query',
      type: 'string',
      required: false,
      example: q.example,
      source: 'endpoint',
    })
  }

  const uploadFields = parseUploadFields(block)
  let contentType = '—'
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    contentType = uploadFields.length > 0 ? 'multipart/form-data' : 'application/json'
  }

  // Resolve external validator imports (e.g. listQueryRules)
  if (/listQueryRules|productIdParam/.test(block)) {
    try {
      const vPath = path.join(VALIDATORS_DIR, 'product.validator.js')
      if (fs.existsSync(vPath)) {
        const vBlock = fs.readFileSync(vPath, 'utf8')
        const v = parseValidatorChains(vBlock)
        if (/listQueryRules/.test(block)) mergeMaps(queryMap, v.query).forEach((val, key) => queryMap.set(key, val))
        if (/productIdParam/.test(block)) mergeMaps(pathMap, v.path).forEach((val, key) => pathMap.set(key, val))
      }
    } catch {
      // ignore
    }
  }

  return {
    pathParams: formatParamList(pathMap),
    queryParams: formatParamList(queryMap),
    requestBody: method === 'GET' ? '—' : formatParamList(bodyMap, uploadFields),
    contentType,
    exampleRequest: buildExampleRequest(method, endpoint.split('?')[0], queryMap, bodyMap, uploadFields, contentType),
    requiredHeaders: inferRequiredHeaders('mobile', access, contentType, module),
  }
}

// ── Auth / endpoint mapping ───────────────────────────────────────────────────

function inferAuth(access, module) {
  const a = String(access || '').toLowerCase()
  if (a.includes('admin')) return 'Admin JWT (Bearer)'
  if (a.includes('private') || a.includes('owner')) return 'JWT Required (Bearer)'
  if (a.includes('public') && module !== 'Auth') return 'Public (Optional JWT for personalization)'
  if (module === 'Auth' || module === 'OAuth') return 'Public'
  if (a.includes('requires auth')) return 'JWT Required (Bearer)'
  return access || 'See route handler'
}

function toMobileEndpoint(legacyEndpoint, module) {
  if (module === 'Admin') return null
  if (legacyEndpoint.startsWith('/api/auth/oauth')) {
    return legacyEndpoint.replace('/api/auth/oauth', '/api/v1/auth/oauth')
  }
  if (legacyEndpoint.startsWith('/api/auth')) {
    return legacyEndpoint.replace('/api/auth', '/api/v1/auth')
  }
  if (legacyEndpoint === '/api/health') return '/api/health'
  const { path } = parseEndpointQueryString(legacyEndpoint)
  return path.replace(/^\/api\//, '/api/v1/mobile/')
}

function toWebEndpoint(legacyEndpoint) {
  if (legacyEndpoint.startsWith('/api/admin')) {
    return legacyEndpoint.replace('/api/admin', '/api/v1/web/admin')
  }
  if (legacyEndpoint.startsWith('/api/auth/oauth')) {
    return legacyEndpoint.replace('/api/auth/oauth', '/api/v1/auth/oauth')
  }
  if (legacyEndpoint.startsWith('/api/auth')) {
    return legacyEndpoint.replace('/api/auth', '/api/v1/auth')
  }
  if (legacyEndpoint === '/api/health') return '/api/health'
  const { path } = parseEndpointQueryString(legacyEndpoint)
  return path.replace(/^\/api\//, '/api/v1/web/')
}

function parseRouteFile(filename) {
  const filePath = path.join(ROUTES_DIR, filename)
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')
  const mount = MOUNT_PREFIX[filename] || '/api'
  const module = MODULE_NAME[filename] || filename.replace('.js', '')
  const apis = []

  let pending = { desc: '', access: '', commentPath: '' }

  const flushFromRouter = (method, routePath, lineNum) => {
    let fullPath = pending.commentPath
    if (!fullPath) {
      const p = routePath.startsWith('/') ? routePath : `/${routePath}`
      fullPath = `${mount}${p}`.replace(/\/+/g, '/')
    }

    const access = pending.access || (filename === 'admin.js' ? 'Private (Admin only)' : '')
    const params = extractRouteParams(lines, lineNum - 1, routePath, method.toUpperCase(), fullPath, access, module)

    apis.push({
      module,
      method: method.toUpperCase(),
      legacyEndpoint: fullPath,
      description: pending.desc || '',
      access,
      sourceFile: `server/routes/${filename}`,
      line: lineNum,
      status: 'Planned',
      ...params,
    })
    pending = { desc: '', access: '', commentPath: '' }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    const routeComment = trimmed.match(/^\/\/ @route\s+(\w+)\s+(.+)$/)
    if (routeComment) {
      pending.commentPath = routeComment[2].trim()
      continue
    }

    const descComment = trimmed.match(/^\/\/ @desc\s+(.+)$/)
    if (descComment) {
      pending.desc = descComment[1].trim()
      continue
    }

    const accessComment = trimmed.match(/^\/\/ @access\s+(.+)$/)
    if (accessComment) {
      pending.access = accessComment[1].trim()
      continue
    }

    const inlineApi = trimmed.match(/^\/\/ (GET|POST|PUT|PATCH|DELETE|ALL)\s+(\/api\S*)/i)
    if (inlineApi && !trimmed.includes('@route')) {
      pending.commentPath = inlineApi[2].trim()
      if (!pending.desc) {
        const rest = trimmed.replace(/^\/\/ (GET|POST|PUT|PATCH|DELETE|ALL)\s+\/api\S*\s*-?\s*/i, '').trim()
        if (rest && !rest.startsWith('/api')) pending.desc = rest
      }
      continue
    }

    const routerMatch = line.match(/router\.(get|post|put|patch|delete|all)\(\s*['"`]([^'"`]+)['"`]/)
    if (routerMatch) {
      flushFromRouter(routerMatch[1], routerMatch[2], i + 1)
      continue
    }

    const multilineRouter = line.match(/router\.(get|post|put|patch|delete|all)\(\s*$/)
    if (multilineRouter && i + 1 < lines.length) {
      const next = lines[i + 1].match(/^\s*['"`]([^'"`]+)['"`]/)
      if (next) flushFromRouter(multilineRouter[1], next[1], i + 1)
    }
  }

  return apis
}

function parseV1RouteFile(platform, filename) {
  const filePath = path.join(V1_DIR, platform, 'routes', filename)
  if (!fs.existsSync(filePath)) return []

  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')
  const mount = V1_MOUNT[platform][filename] || `/api/v1/${platform}`
  const module = filename.replace('.routes.js', '').replace(/^./, (c) => c.toUpperCase())
  const apis = []

  for (let i = 0; i < lines.length; i++) {
    const routerMatch = lines[i].match(/router\.(get|post|put|patch|delete|all)\(\s*['"`]([^'"`]+)['"`]/)
    if (!routerMatch) continue

    const routePath = routerMatch[2]
    const p = routePath.startsWith('/') ? routePath : `/${routePath}`
    const endpoint = `${mount}${p}`.replace(/\/+/g, '/').replace(/\/+$/, '') || mount
    const method = routerMatch[1].toUpperCase()
    const access = platform === 'mobile' ? 'Public (Optional JWT)' : 'Public (Optional JWT + Cookie)'

    const params = extractRouteParams(lines, i, routePath, method, endpoint, access, module)
    params.requiredHeaders = inferRequiredHeaders(platform, access, params.contentType, module)

    apis.push({
      module: module.charAt(0).toUpperCase() + module.slice(1),
      method,
      legacyEndpoint: '',
      endpoint,
      description: `${platform} v1 — ${module} endpoint`,
      access,
      sourceFile: `server/api/v1/${platform}/routes/${filename}`,
      line: i + 1,
      status: 'Implemented',
      ...params,
    })
  }

  return apis
}

function buildPlatformRows(legacyApis, platform) {
  const rows = []
  const seen = new Set()

  for (const api of legacyApis) {
    const endpoint = platform === 'mobile' ? toMobileEndpoint(api.legacyEndpoint, api.module) : toWebEndpoint(api.legacyEndpoint)
    if (!endpoint) continue

    const key = `${api.method}:${endpoint}`
    if (seen.has(key)) continue
    seen.add(key)

    const auth =
      platform === 'mobile'
        ? inferAuth(api.access, api.module).replace('Cookie', '').replace(/\s+\/\s+/, '').trim()
        : inferAuth(api.access, api.module).replace('Bearer', 'Bearer / Cookie')

    rows.push({
      module: api.module,
      method: api.method,
      endpoint,
      legacyEndpoint: api.legacyEndpoint,
      description: api.description,
      requiredHeaders: inferRequiredHeaders(platform, api.access, api.contentType, api.module),
      pathParams: api.pathParams,
      queryParams: api.queryParams,
      requestBody: api.requestBody,
      contentType: api.contentType,
      exampleRequest: api.exampleRequest
        ? api.exampleRequest.replace(api.legacyEndpoint.split('?')[0], endpoint.split('?')[0])
        : `${api.method} ${endpoint}`,
      access: api.access,
      authentication: auth,
      status: api.status,
      sourceFile: api.sourceFile,
      line: api.line,
    })
  }

  const v1Apis = []
  const v1RouteDir = path.join(V1_DIR, platform, 'routes')
  if (fs.existsSync(v1RouteDir)) {
    for (const file of fs.readdirSync(v1RouteDir).filter((f) => f.endsWith('.routes.js'))) {
      v1Apis.push(...parseV1RouteFile(platform, file))
    }
  }

  const implementedSet = new Set(v1Apis.map((a) => `${a.method}:${a.endpoint}`))

  for (const v1 of v1Apis) {
    const existing = rows.find((r) => r.method === v1.method && r.endpoint === v1.endpoint)
    if (existing) {
      Object.assign(existing, {
        status: 'Implemented',
        sourceFile: v1.sourceFile,
        line: v1.line,
        pathParams: v1.pathParams,
        queryParams: v1.queryParams,
        requestBody: v1.requestBody,
        contentType: v1.contentType,
        exampleRequest: v1.exampleRequest,
        requiredHeaders: v1.requiredHeaders,
      })
    } else {
      rows.push({
        module: v1.module,
        method: v1.method,
        endpoint: v1.endpoint,
        legacyEndpoint: v1.legacyEndpoint || '—',
        description: v1.description,
        requiredHeaders: v1.requiredHeaders,
        pathParams: v1.pathParams,
        queryParams: v1.queryParams,
        requestBody: v1.requestBody,
        contentType: v1.contentType,
        exampleRequest: v1.exampleRequest,
        access: v1.access,
        authentication: platform === 'mobile' ? 'Bearer JWT (optional)' : 'Bearer JWT / Cookie (optional)',
        status: 'Implemented',
        sourceFile: v1.sourceFile,
        line: v1.line,
      })
    }
  }

  return rows
    .map((row) => ({
      ...row,
      status: implementedSet.has(`${row.method}:${row.endpoint}`) ? 'Implemented' : row.status,
    }))
    .sort((a, b) => {
      if (a.module !== b.module) return a.module.localeCompare(b.module)
      if (a.endpoint !== b.endpoint) return a.endpoint.localeCompare(b.endpoint)
      return a.method.localeCompare(b.method)
    })
}

function loadXlsx() {
  try {
    return require('xlsx')
  } catch {
    require('child_process').execSync('npm install xlsx --no-save', {
      cwd: path.join(ROOT, 'server'),
      stdio: 'inherit',
    })
    return require(path.join(ROOT, 'server/node_modules/xlsx'))
  }
}

function writeWorkbook(XLSX, filepath, sheetName, rows) {
  const data = [
    HEADERS,
    ...rows.map((r, idx) => [
      idx + 1,
      r.module,
      r.method,
      r.endpoint,
      r.legacyEndpoint,
      r.description,
      r.requiredHeaders,
      r.pathParams,
      r.queryParams,
      r.requestBody,
      r.contentType,
      r.exampleRequest,
      r.access,
      r.authentication,
      r.status,
      r.sourceFile,
      r.line,
    ]),
  ]

  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 7 },
    { wch: 46 },
    { wch: 42 },
    { wch: 40 },
    { wch: 50 },
    { wch: 28 },
    { wch: 55 },
    { wch: 55 },
    { wch: 22 },
    { wch: 60 },
    { wch: 22 },
    { wch: 28 },
    { wch: 12 },
    { wch: 38 },
    { wch: 6 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, filepath)
}

function main() {
  const files = fs.readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.js')).sort()
  let legacyApis = []
  for (const file of files) {
    legacyApis = legacyApis.concat(parseRouteFile(file))
  }

  legacyApis.push({
    module: 'System',
    method: 'GET',
    legacyEndpoint: '/api/health',
    description: 'Server health check',
    access: 'Public',
    sourceFile: 'server/server.js',
    line: 158,
    status: 'Planned',
    pathParams: '—',
    queryParams: '—',
    requestBody: '—',
    contentType: '—',
    exampleRequest: 'GET /api/health',
    requiredHeaders: '—',
  })

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

  const mobileRows = buildPlatformRows(legacyApis, 'mobile')
  const webRows = buildPlatformRows(legacyApis, 'web')
  const XLSX = loadXlsx()

  writeWorkbook(XLSX, MOBILE_FILE, 'Mobile APIs', mobileRows)
  writeWorkbook(XLSX, WEB_FILE, 'Web APIs', webRows)

  XLSX.writeFile(XLSX.readFile(MOBILE_FILE), path.join(OUT_DIR, 'API_List_Mobile.csv'), { bookType: 'csv' })
  XLSX.writeFile(XLSX.readFile(WEB_FILE), path.join(OUT_DIR, 'API_List_Web.csv'), { bookType: 'csv' })

  console.log('')
  console.log('Platform API lists generated (with parameters):')
  console.log(`  Mobile: ${mobileRows.length} endpoints`)
  console.log(`    Excel: ${MOBILE_FILE}`)
  console.log(`  Web:    ${webRows.length} endpoints`)
  console.log(`    Excel: ${WEB_FILE}`)
  console.log('')
}

main()
