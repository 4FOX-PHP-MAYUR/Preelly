/**
 * Indexes the Admin Dashboard aggregations depend on.
 *
 * These are registered on the existing schemas at require time rather than
 * created ad-hoc, because `server.js` runs `syncIndexes()` / `fixIndexes()` on
 * boot for Product, ProductDraft, User, Chat, SearchHistory, SearchAnalytics
 * and PaymentTransaction — and `syncIndexes` DROPS any index the schema doesn't
 * declare. An index created by a one-off script would silently disappear on the
 * next restart.
 *
 * Registering here keeps every model file untouched while making the dashboard's
 * indexes first-class: Mongoose's `autoIndex` builds them on connect, and
 * `syncIndexes` preserves them from then on.
 *
 * Only indexes the schemas don't already declare are listed. Each is named
 * `dash_*` so it is obvious where it came from and trivial to drop if the
 * dashboard is ever removed.
 *
 * Required for its side effect from `routes/adminDashboard.js`, which loads
 * during route mounting — before the boot-time index sync runs.
 */

const Product = require('../models/Product')
const ProductView = require('../models/ProductView')
const User = require('../models/User')
const Chat = require('../models/Chat')
const PaymentTransaction = require('../models/PaymentTransaction')

/** [model, keys, options] — `background` keeps builds non-blocking on large collections. */
const DASHBOARD_INDEXES = [
  // Trending products (most viewed) and "avg time to sell".
  [Product, { views: -1 }, { name: 'dash_product_views' }],
  [Product, { soldAt: -1 }, { name: 'dash_product_soldAt', sparse: true }],
  // Top performing cities.
  [Product, { city: 1 }, { name: 'dash_product_city' }],
  // Top sellers groups by seller and counts active listings in one pass.
  [Product, { seller: 1, status: 1 }, { name: 'dash_product_seller_status' }],
  // Category-wise products, range-scoped.
  [Product, { categoryPath: 1, createdAt: -1 }, { name: 'dash_product_categoryPath_createdAt' }],

  // Registration trend + the active / blocked / verified cards.
  [User, { createdAt: -1 }, { name: 'dash_user_createdAt' }],
  [User, { status: 1, createdAt: -1 }, { name: 'dash_user_status_createdAt' }],
  [User, { isVerified: 1 }, { name: 'dash_user_isVerified' }],

  // Revenue, package and storage aggregations always filter on these together;
  // the schema only declares each field on its own.
  [
    PaymentTransaction,
    { deletedAt: 1, orderStatus: 1, createdAt: -1 },
    { name: 'dash_txn_deleted_status_createdAt' },
  ],
  [
    PaymentTransaction,
    { deletedAt: 1, orderStatus: 1, paymentType: 1, packageId: 1 },
    { name: 'dash_txn_type_package' },
  ],
  [
    PaymentTransaction,
    { deletedAt: 1, orderStatus: 1, storagefacilitiesId: 1 },
    { name: 'dash_txn_storage' },
  ],
  [PaymentTransaction, { sellerId: 1, orderStatus: 1 }, { name: 'dash_txn_seller_status' }],
  [PaymentTransaction, { buyerId: 1, orderStatus: 1 }, { name: 'dash_txn_buyer_status' }],
  [PaymentTransaction, { productId: 1, orderStatus: 1 }, { name: 'dash_txn_product_status' }],

  // Active-user proxy and trending chats.
  [ProductView, { dateAdded: -1 }, { name: 'dash_view_dateAdded' }],
  [Chat, { product: 1, createdAt: -1 }, { name: 'dash_chat_product_createdAt' }],

  // ProductDraft is deliberately absent: its schema declares `userId` twice
  // (`index: true` plus a unique partial index), so `syncIndexes()` on that
  // model already throws on every boot — a pre-existing issue, unrelated to the
  // dashboard. The draft count only needs the `{ status: 1 }` index the schema
  // already declares, so nothing is added here rather than piggy-backing on a
  // sync that never completes.
]

let registered = false

/** Idempotent — safe to call from several entry points. */
function registerDashboardIndexes() {
  if (registered) return DASHBOARD_INDEXES
  registered = true
  DASHBOARD_INDEXES.forEach(([model, keys, options]) => {
    model.schema.index(keys, { background: true, ...options })
  })
  return DASHBOARD_INDEXES
}

/** Distinct models touched — used by the manual sync script. */
function dashboardIndexedModels() {
  return [...new Set(DASHBOARD_INDEXES.map(([model]) => model))]
}

module.exports = { registerDashboardIndexes, dashboardIndexedModels, DASHBOARD_INDEXES }
