# Backend Architecture Restructure — Mobile / Web API Separation

> **Stack:** Node.js · Express 5 · MongoDB (Mongoose) · Socket.IO  
> **Goal:** Separate Mobile and Web API surfaces while sharing one database, one set of models, and one business-logic layer.

---

## 1. Recommended Architecture

### Layered Clean Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│   Mobile App (React Native / Flutter)  │  Web SPA + Admin Panel  │
└───────────────┬─────────────────────────┴───────────────┬─────────┘
                │                                         │
                ▼                                         ▼
┌───────────────────────────┐           ┌───────────────────────────┐
│  /api/v1/mobile/*         │           │  /api/v1/web/*            │
│  Mobile Routes            │           │  Web Routes               │
│  Mobile Controllers       │           │  Web Controllers          │
│  Mobile DTOs/Transformers │           │  Web DTOs/Transformers    │
└───────────────┬───────────┘           └─────────────┬─────────────┘
                │                                     │
                └──────────────┬──────────────────────┘
                               ▼
                ┌──────────────────────────────┐
                │     SHARED SERVICE LAYER      │
                │  productService, authService  │
                │  userService, chatService …   │
                └──────────────┬───────────────┘
                               ▼
                ┌──────────────────────────────┐
                │   REPOSITORY LAYER (opt.)     │
                │  Encapsulates Mongoose queries│
                └──────────────┬───────────────┘
                               ▼
                ┌──────────────────────────────┐
                │   MODELS (Mongoose Schemas)   │
                │   Single MongoDB Database     │
                └──────────────────────────────┘
```

### Design Principles

| Principle | Implementation |
|-----------|----------------|
| Single database | One `MONGO_URI`, all models in `server/models/` |
| Shared business logic | All rules in `server/core/services/` |
| Platform-specific API | Controllers + transformers per platform |
| No duplicate queries | Services accept options; repositories cache per-request |
| Backward compatibility | Legacy `/api/*` routes proxy to web v1 during migration |
| Versioning | URL prefix `/api/v1/`; bump to `v2` for breaking changes |

### API URL Convention

| Surface | Base Path | Auth Transport |
|---------|-----------|----------------|
| Mobile | `/api/v1/mobile` | Bearer JWT only |
| Web (marketplace) | `/api/v1/web` | Bearer JWT + HTTP-only cookie |
| Admin panel | `/api/v1/web/admin` | Bearer JWT + cookie + admin role |
| Legacy (deprecated) | `/api/*` | Same as web (unchanged) |
| Shared auth | `/api/v1/auth` | Platform-agnostic OTP/OAuth |
| Health / docs | `/api/health`, `/api-docs` | Public |

---

## 2. Folder Structure

```
server/
├── server.js                          # Bootstrap, mounts v1 + legacy routes
├── package.json
│
├── api/                               # API surface (routes + controllers)
│   ├── v1/
│   │   ├── index.js                   # Mounts mobile + web routers
│   │   ├── mobile/
│   │   │   ├── index.js
│   │   │   ├── routes/
│   │   │   │   ├── products.routes.js
│   │   │   │   ├── user.routes.js
│   │   │   │   ├── feed.routes.js
│   │   │   │   └── ...
│   │   │   └── controllers/
│   │   │       ├── products.controller.js
│   │   │       └── ...
│   │   ├── web/
│   │   │   ├── index.js
│   │   │   ├── routes/
│   │   │   │   ├── products.routes.js
│   │   │   │   ├── admin.routes.js    # wraps existing admin logic
│   │   │   │   └── ...
│   │   │   └── controllers/
│   │   │       └── ...
│   │   └── shared/
│   │       └── routes/
│   │           └── auth.routes.js     # OTP, OAuth entry points
│   └── legacy/
│       └── compat.js                  # Deprecation headers on old /api/*
│
├── core/                              # Platform-agnostic business logic
│   ├── services/
│   │   ├── productService.js
│   │   ├── authService.js
│   │   ├── userService.js
│   │   ├── feedService.js
│   │   └── index.js
│   ├── repositories/                  # Optional: complex query encapsulation
│   │   └── productRepository.js
│   ├── validators/
│   │   ├── product.validator.js
│   │   └── auth.validator.js
│   └── errors/
│       ├── AppError.js
│       └── errorHandler.js
│
├── dto/                               # Response/request shaping per platform
│   ├── mobile/
│   │   ├── product.dto.js
│   │   └── user.dto.js
│   └── web/
│       ├── product.dto.js
│       └── user.dto.js
│
├── middleware/
│   ├── auth/
│   │   ├── authenticate.js            # Base JWT verification
│   │   ├── mobileAuth.js              # Bearer-only, sets req.platform = 'mobile'
│   │   ├── webAuth.js                 # Bearer + cookie, sets req.platform = 'web'
│   │   └── adminAuth.js
│   ├── platform/
│   │   └── requirePlatform.js
│   ├── validateObjectId.js            # (existing)
│   └── upload.js                      # (existing)
│
├── models/                            # UNCHANGED — shared Mongoose schemas
├── config/
├── services/                          # Existing specialized services (AI, video)
├── jobs/
├── utils/
├── auth/passport.js
└── swagger/
    ├── setup.js
    ├── mobile/
    │   └── paths.js
    └── web/
        └── paths.js
```

---

## 3. Refactored API Structure

### Module mapping (current → v1)

| Current Route File | Mobile v1 | Web v1 | Notes |
|--------------------|-----------|--------|-------|
| `routes/auth.js` | `/api/v1/auth/*` | `/api/v1/auth/*` | Shared auth surface |
| `routes/oauth.js` | `/api/v1/auth/oauth/*` | `/api/v1/auth/oauth/*` | Shared |
| `routes/products.js` | `/api/v1/mobile/products` | `/api/v1/web/products` | Different transformers |
| `routes/user.js` | `/api/v1/mobile/user` | `/api/v1/web/user` | Mobile: minimal fields |
| `routes/feedData.js` | `/api/v1/mobile/feed` | `/api/v1/web/feed` | Mobile: reels-optimized |
| `routes/interactions.js` | `/api/v1/mobile/interactions` | `/api/v1/web/interactions` | Same service |
| `routes/chats.js` | `/api/v1/mobile/chats` | `/api/v1/web/chats` | Same Socket.IO backend |
| `routes/admin.js` | — | `/api/v1/web/admin` | Web panel only |
| `routes/categories.js` | `/api/v1/mobile/categories` | `/api/v1/web/categories` | Web: full tree metadata |
| `routes/ai.js` | `/api/v1/mobile/ai` | `/api/v1/web/ai` | Same service |
| `routes/video.js` | `/api/v1/mobile/video` | `/api/v1/web/video` | Same service |
| `routes/streaming.js` | `/api/v1/mobile/streaming` | `/api/v1/web/streaming` | Mobile: HLS preferred |

---

## 4. Example Implementation

See scaffolded files:

- `server/core/services/productService.js` — shared listing logic
- `server/dto/mobile/product.dto.js` — compact mobile payload
- `server/dto/web/product.dto.js` — rich web payload
- `server/api/v1/mobile/controllers/products.controller.js`
- `server/api/v1/web/controllers/products.controller.js`
- `server/api/v1/mobile/routes/products.routes.js`
- `server/api/v1/web/routes/products.routes.js`

### Request flow (GET product list)

```
Mobile App
  → GET /api/v1/mobile/products?categoryId=...
  → mobileAuth (optional) → products.routes
  → products.controller.list
  → productService.listProducts({ categoryId, userId, platform: 'mobile' })
  → Product model (Mongoose)
  → mobileProductDto.listItem(each) — strips fields, adds reel thumbnail
  → apiResponse.success(res, data, meta)
```

---

## 5. API Documentation Format

Each endpoint is documented with this template (also used in OpenAPI):

```markdown
## GET /api/v1/mobile/products

| Field | Value |
|-------|-------|
| **Endpoint Name** | List Products (Mobile) |
| **Method** | GET |
| **Authentication** | Optional (Bearer JWT) |
| **Platform** | Mobile |

### Headers
| Header | Required | Description |
|--------|----------|-------------|
| Authorization | No | `Bearer <jwt>` — enables personalized `saved`, `liked` flags |
| X-App-Version | Yes | e.g. `1.2.0` — for deprecation warnings |
| X-Platform | Yes | `ios` or `android` |

### Query Parameters
| Param | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| categoryId | string | No | MongoDB ObjectId | Filter by category |
| page | number | No | min: 1, default: 1 | Page number |
| limit | number | No | min: 1, max: 50, default: 20 | Items per page |
| sort | string | No | enum: `newest`, `price_asc`, `price_desc` | Sort order |

### Request Body
None

### Success Response `200`
```json
{
  "success": true,
  "message": "Products fetched",
  "data": {
    "items": [
      {
        "id": "64a1...",
        "title": "iPhone 14 Pro",
        "price": 3500,
        "currency": "AED",
        "thumbnail": "https://...",
        "location": "Dubai",
        "saved": false,
        "postedAt": "2026-05-20T10:00:00.000Z"
      }
    ]
  },
  "meta": { "page": 1, "limit": 20, "total": 142, "hasMore": true }
}
```

### Error Responses
| Status | Condition | Body |
|--------|-----------|------|
| 400 | Invalid categoryId | `{ "success": false, "message": "Invalid categoryId" }` |
| 401 | Invalid token | `{ "success": false, "message": "Invalid or expired token" }` |
| 503 | DB down | `{ "success": false, "message": "Database unavailable" }` |

### Database Tables Used
- `products` — main query
- `users` — savedProducts lookup (if authenticated)
- `categories` — category scope expansion

### Shared Services Used
- `productService.listProducts()`
- `categoryRepository.expandCategoryScope()` (optional)

### Flow
1. Validate query params via `product.validator.listQuery`
2. Resolve optional user from JWT
3. `productService.listProducts()` runs single aggregation
4. Map each doc through `mobileProductDto.listItem`
5. Return paginated envelope via `apiResponse.success`

### Example Request
```bash
curl -H "Authorization: Bearer eyJ..." \
     -H "X-App-Version: 1.2.0" \
     -H "X-Platform: ios" \
     "https://api.example.com/api/v1/mobile/products?categoryId=64a1...&page=1&limit=20"
```
```

OpenAPI specs are split:
- `/api-docs/mobile` — mobile surface
- `/api-docs/web` — web + admin surface
- `/api-docs` — combined (legacy)

---

## 6. Migration / Refactor Strategy

### Phase 0 — Foundation (Week 1)
- [x] Create `core/services`, `dto/`, `api/v1/` scaffold
- [ ] Add `AppError` + centralized error handler
- [ ] Mount `/api/v1/mobile` and `/api/v1/web` alongside existing routes
- [ ] Add `Sunset` / `Deprecation` headers on legacy routes

### Phase 1 — Extract Services (Weeks 2–4)
Priority order (highest traffic / most duplicated logic first):

1. **Products** — `productService` (list, detail, create, search)
2. **Auth** — `authService` (OTP, token issue)
3. **User** — `userService` (profile, dashboard)
4. **Feed** — `feedService` (trending, following)
5. **Interactions** — `interactionService` (like, save, follow)
6. **Categories/Filters** — reuse existing `services/filterMatchingService.js`
7. **Admin** — `adminService` (wrap existing admin.js logic incrementally)

**Rule:** Extract logic from route handler → service method. Route file becomes a thin wrapper until v1 controllers replace it.

### Phase 2 — Platform Controllers (Weeks 5–8)
- Implement mobile + web controllers for each module
- Add platform-specific DTOs
- Point new mobile app builds to `/api/v1/mobile/*`
- Web SPA continues on `/api/*` initially

### Phase 3 — Client Migration (Weeks 9–12)
- Update `src/services/api.js` base URL to `/api/v1/web`
- Release mobile app update pointing to `/api/v1/mobile`
- Monitor traffic on legacy routes via middleware logging

### Phase 4 — Deprecation (Month 4+)
- Legacy routes return `Deprecation: true` header
- After 90 days with <5% legacy traffic, remove old route files
- Keep `api/legacy/compat.js` as 301 redirects if needed

### Incremental extraction pattern

```javascript
// BEFORE (routes/products.js — 2400 lines)
router.get('/', async (req, res) => {
  // 200 lines of query + transform inline
})

// STEP 1 — extract service, keep same route
const productService = require('../core/services/productService')
router.get('/', async (req, res) => {
  const result = await productService.listProducts(req.query, { userId: req.user?._id })
  res.json(result) // same response shape
})

// STEP 2 — v1 controller with platform DTO
// server/api/v1/mobile/controllers/products.controller.js
exports.list = async (req, res, next) => {
  const result = await productService.listProducts(req.query, { userId: req.user?._id })
  const items = result.items.map(mobileProductDto.listItem)
  return apiResponse.success(res, 'Products fetched', { items }, result.meta)
}
```

---

## 7. Security Recommendations

### Authentication separation

| Concern | Mobile | Web |
|---------|--------|-----|
| Token transport | Bearer header only | Bearer + HTTP-only cookie |
| Token TTL | Shorter (7d → consider 30d refresh token) | 7d cookie + refresh |
| OAuth redirect | Deep link `myapp://oauth-success` | `FRONTEND_URL/oauth-success` |
| CSRF | Not applicable (no cookies) | SameSite=Lax cookie + CSRF token on mutating web requests |
| Rate limiting | Stricter on OTP (5/min/IP) | Standard (20/min/IP) |

### Middleware stack

```javascript
// Mobile routes
router.use(mobileAuth.optional)       // Bearer only
router.use(rateLimit({ max: 100 })) // per IP
router.use(requireAppVersion())       // block outdated clients

// Web routes
router.use(webAuth.optional)          // Bearer + cookie
router.use(csrfProtection)            // POST/PUT/DELETE only
router.use(rateLimit({ max: 200 }))
```

### Additional hardening
- Add `aud` (audience) claim to JWT: `"mobile"` | `"web"` — reject cross-platform token reuse
- Validate `X-Platform` header matches token audience
- Admin routes: require `role === 'admin'` + IP allowlist in production
- Never expose internal fields (`password`, `adminRole` internals) in any DTO
- Audit log admin mutations to a separate collection

---

## 8. Performance Optimization

### Response optimization by platform

| Optimization | Mobile | Web |
|--------------|--------|-----|
| Field selection | Minimal (id, title, price, thumb) | Full (description, all images, SEO slug) |
| Pagination default | 20 items | 24 items (grid-friendly) |
| Image URLs | Thumbnail / CDN resize param | Full resolution |
| Nested data | Omit category path array | Include breadcrumbs |
| Compression | Enable gzip/brotli | Enable gzip/brotli |
| Caching | `Cache-Control: private, max-age=60` for feeds | `no-store` for authenticated; CDN for public lists |

### Query optimization
- Move repeated aggregations from route files into `productRepository`
- Use `.lean()` for all read paths
- Batch `savedProducts` lookup once per request (already done in products.js)
- Extend Redis caching (currently feed-only) to category trees and filter trees
- Add compound indexes documented per service method

### Scaling path
1. **Now:** Monolith with clean layers (this restructure)
2. **Next:** Extract video transcode queue to Bull + Redis worker
3. **Later:** Read replicas for product search; write to primary
4. **Future:** Split Socket.IO to dedicated service if connection count > 10k

---

## 9. Environment Variables (new)

```env
# API versioning
API_LEGACY_ENABLED=true          # set false after migration
API_DEPRECATION_DATE=2026-09-01  # shown in Sunset header

# JWT audience separation
JWT_MOBILE_AUDIENCE=mobile
JWT_WEB_AUDIENCE=web

# Rate limiting
RATE_LIMIT_MOBILE_MAX=100
RATE_LIMIT_WEB_MAX=200
```

---

## 10. Checklist Before Production

- [ ] All v1 endpoints have OpenAPI definitions
- [ ] Mobile app sends `X-App-Version` and `X-Platform`
- [ ] Legacy routes log deprecation warnings
- [ ] Integration tests for shared services (not duplicated per platform)
- [ ] DTO unit tests ensure no sensitive field leakage
- [ ] Load test mobile list endpoint at 2× expected peak
- [ ] Runbook for rolling back client base URL via env flag
