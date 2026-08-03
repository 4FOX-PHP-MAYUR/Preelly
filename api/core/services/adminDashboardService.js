/**
 * Admin Dashboard aggregation service.
 *
 * One place for every dashboard read. Endpoints stay thin: they resolve a date
 * range + filters into a `context`, call a function here, and hand the result
 * to the DTO layer.
 *
 * Conventions used throughout:
 *  - Money totals only count `orderStatus: 'SUCCESS'` transactions.
 *  - `paymentType` 1 = seller "ads" payment (package / storage add-on),
 *    `paymentType` 2 = buyer product-checkout payment.
 *  - Soft-deleted rows (`deletedAt`, `isDeleted`) are always excluded.
 *  - Every count is range-scoped unless the metric is explicitly lifetime
 *    ("Total Registered Users" is lifetime; "New Users Today" is not).
 */

const { Types } = require('mongoose')

const Product = require('../../models/Product')
const ProductDraft = require('../../models/ProductDraft')
const ProductView = require('../../models/ProductView')
const User = require('../../models/User')
const Category = require('../../models/Category')
const Chat = require('../../models/Chat')
const PaymentTransaction = require('../../models/PaymentTransaction')
const Package = require('../../models/Package')
const StorageFacility = require('../../models/StorageFacility')
const SearchHistory = require('../../models/SearchHistory')
const SearchAnalytics = require('../../models/SearchAnalytics')

const {
  resolveDateRange,
  enumerateBuckets,
  humanizeBucket,
  buildDateFilter,
} = require('../../utils/dashboardDateRange')
const {
  paymentStatusLabel,
  paymentStatusBadge,
  normalizePaymentMethod,
  paymentFromToPlatform,
  platformLabel,
  orderStatusesForPaymentStatusFilter,
  paymentFromForPlatformFilter,
} = require('../../utils/paymentLabels')

const MS_PER_DAY = 24 * 60 * 60 * 1000
const CURRENCY = 'AED'

/** Collection names read off the models so a `collection:` override can't drift. */
const COLLECTIONS = {
  products: Product.collection.name,
  users: User.collection.name,
  categories: Category.collection.name,
  packages: Package.collection.name,
  storageFacilities: StorageFacility.collection.name,
  transactions: PaymentTransaction.collection.name,
  chats: Chat.collection.name,
}

const PRODUCT_STATUSES = ['active', 'pending', 'rejected', 'sold', 'inactive', 'paused']

// ---------------------------------------------------------------------------
// Context + shared match builders
// ---------------------------------------------------------------------------

function toObjectId(value) {
  if (!value) return null
  const str = String(value)
  return Types.ObjectId.isValid(str) && String(new Types.ObjectId(str)) === str
    ? new Types.ObjectId(str)
    : null
}

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
}

/**
 * Normalize a request query into the shape every aggregation expects.
 * Exported so routes and the report exporter build identical windows.
 */
function buildContext(query = {}, now = new Date()) {
  const range = resolveDateRange(query, now)
  return {
    range,
    now,
    filters: {
      category: toObjectId(query.category),
      packageId: toObjectId(query.packageId),
      paymentStatus:
        query.paymentStatus && query.paymentStatus !== 'all' ? String(query.paymentStatus) : null,
      productStatus:
        query.productStatus && query.productStatus !== 'all' ? String(query.productStatus) : null,
      userType: query.userType && query.userType !== 'all' ? String(query.userType) : null,
      platform: query.platform && query.platform !== 'all' ? String(query.platform) : null,
    },
  }
}

/** Match for products created inside the window, honouring category/status filters. */
function productMatch(ctx, { ignoreDate = false, ignoreStatus = false } = {}) {
  const { range, filters } = ctx
  const match = {}
  if (!ignoreDate) {
    const createdAt = buildDateFilter(range.start, range.end)
    if (createdAt) match.createdAt = createdAt
  }
  if (filters.category) {
    // `categoryPath` holds every ancestor, so a parent-category filter also
    // matches listings posted under its children.
    match.$or = [
      { category: filters.category },
      { subcategory: filters.category },
      { categoryPath: filters.category },
    ]
  }
  if (!ignoreStatus && filters.productStatus) match.status = filters.productStatus
  return match
}

function userMatch(ctx, { ignoreDate = false } = {}) {
  const { range, filters } = ctx
  const match = {}
  if (!ignoreDate) {
    const createdAt = buildDateFilter(range.start, range.end)
    if (createdAt) match.createdAt = createdAt
  }
  if (filters.userType === 'admin' || filters.userType === 'user') match.role = filters.userType
  else if (filters.userType === 'verified') match.isVerified = true
  else if (filters.userType === 'unverified') match.isVerified = false
  return match
}

/**
 * Match for payment transactions.
 * @param {object} ctx
 * @param {object} [opts]
 * @param {boolean} [opts.ignoreDate]    lifetime totals
 * @param {boolean} [opts.successOnly]   restrict to SUCCESS (money metrics)
 * @param {number}  [opts.paymentType]   1 = ads/package, 2 = product checkout
 * @param {boolean} [opts.ignoreStatusFilter] keep cards global while list is filtered
 */
function transactionMatch(ctx, opts = {}) {
  const { range, filters } = ctx
  const match = { deletedAt: null }

  if (!opts.ignoreDate) {
    const createdAt = buildDateFilter(range.start, range.end)
    if (createdAt) match.createdAt = createdAt
  }
  if (opts.successOnly) {
    match.orderStatus = 'SUCCESS'
  } else if (!opts.ignoreStatusFilter && filters.paymentStatus) {
    const statuses = orderStatusesForPaymentStatusFilter(filters.paymentStatus)
    if (statuses) match.orderStatus = { $in: statuses }
  }
  if (opts.paymentType) match.paymentType = opts.paymentType
  if (filters.packageId) match.packageId = filters.packageId
  if (filters.platform) {
    const paymentFrom = paymentFromForPlatformFilter(filters.platform)
    if (paymentFrom != null) match.paymentFrom = paymentFrom
  }
  return match
}

/**
 * Coerce a field to a number inside a pipeline.
 * Some historic rows store `validityDays` / `facilityWeek` as strings, and
 * arithmetic operators throw on those rather than skipping the document.
 */
function asNumber(field, fallback = 0) {
  return { $convert: { input: field, to: 'double', onError: fallback, onNull: fallback } }
}

/**
 * `expiresAt` for a package purchase: payment date + the package's validity.
 * `$add` is used instead of `$dateAdd` so the pipeline runs on MongoDB 4.x too.
 * A package with no `validityDays` never expires and yields `null`.
 */
const PACKAGE_EXPIRY_STAGES = [
  {
    $lookup: {
      from: COLLECTIONS.packages,
      localField: 'packageId',
      foreignField: '_id',
      as: 'package',
    },
  },
  { $unwind: { path: '$package', preserveNullAndEmptyArrays: true } },
  { $addFields: { validityDays: asNumber('$package.validityDays') } },
  {
    $addFields: {
      paidAt: { $ifNull: ['$paymentDate', '$createdAt'] },
      expiresAt: {
        $cond: [
          { $gt: ['$validityDays', 0] },
          {
            $add: [
              { $ifNull: ['$paymentDate', '$createdAt'] },
              { $multiply: ['$validityDays', MS_PER_DAY] },
            ],
          },
          null,
        ],
      },
    },
  },
]

/**
 * Sum of a numeric field. Values are coerced so a stray string amount adds its
 * value instead of being silently skipped by `$sum`.
 */
function sumField(field) {
  return { $sum: asNumber(field) }
}

// ---------------------------------------------------------------------------
// Summary cards
// ---------------------------------------------------------------------------

async function getUserSummary(ctx) {
  const scoped = userMatch(ctx)
  const lifetime = userMatch(ctx, { ignoreDate: true })
  const { range, now } = ctx

  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    totalRegistered,
    activeUsers,
    inactiveUsers,
    verifiedUsers,
    newInRange,
    newToday,
    newThisMonth,
    identityVerified,
  ] = await Promise.all([
    User.countDocuments(lifetime),
    User.countDocuments({ ...lifetime, status: 'active' }),
    User.countDocuments({ ...lifetime, status: 'inactive' }),
    User.countDocuments({ ...lifetime, isVerified: true }),
    User.countDocuments(scoped),
    User.countDocuments({ ...lifetime, createdAt: { $gte: startOfToday } }),
    User.countDocuments({ ...lifetime, createdAt: { $gte: startOfMonth } }),
    User.countDocuments({ ...lifetime, identityVerificationStatus: 'approved' }),
  ])

  return {
    totalRegistered,
    activeUsers,
    // Blocking a user sets `status: 'inactive'` — same signal, surfaced under
    // both labels because admins look for each by name.
    inactiveUsers,
    blockedUsers: inactiveUsers,
    verifiedUsers,
    identityVerifiedUsers: identityVerified,
    newUsers: newInRange,
    newUsersToday: newToday,
    newUsersThisMonth: newThisMonth,
    rangeLabel: range.label,
  }
}

async function getProductSummary(ctx) {
  const scoped = productMatch(ctx, { ignoreStatus: true })
  const lifetime = productMatch(ctx, { ignoreDate: true, ignoreStatus: true })
  const { now } = ctx

  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)

  const [byStatus, totalInRange, addedToday, drafts, expiredCount] = await Promise.all([
    Product.aggregate([{ $match: lifetime }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Product.countDocuments(scoped),
    Product.countDocuments({ ...lifetime, createdAt: { $gte: startOfToday } }),
    ProductDraft.countDocuments({ status: 'draft' }),
    countExpiredProducts(ctx),
  ])

  const statusCounts = PRODUCT_STATUSES.reduce((acc, status) => ({ ...acc, [status]: 0 }), {})
  let total = 0
  byStatus.forEach((row) => {
    const key = String(row._id || 'unknown')
    statusCounts[key] = row.count
    total += row.count
  })

  return {
    total,
    totalInRange,
    active: statusCounts.active || 0,
    pending: statusCounts.pending || 0,
    rejected: statusCounts.rejected || 0,
    sold: statusCounts.sold || 0,
    inactive: statusCounts.inactive || 0,
    paused: statusCounts.paused || 0,
    drafts,
    expired: expiredCount,
    addedToday,
  }
}

/**
 * "Expired" is not a product status in this schema — a listing is expired once
 * the package that promoted it has run out. Counted from the paid transaction.
 */
async function countExpiredProducts(ctx) {
  const [row] = await PaymentTransaction.aggregate([
    {
      $match: {
        deletedAt: null,
        orderStatus: 'SUCCESS',
        paymentType: 1,
        packageId: { $ne: null },
      },
    },
    ...PACKAGE_EXPIRY_STAGES,
    { $match: { expiresAt: { $ne: null, $lt: ctx.now } } },
    { $group: { _id: '$productId' } },
    { $count: 'count' },
  ])
  return row?.count || 0
}

async function getTransactionSummary(ctx) {
  const { now } = ctx
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const rangeMatch = transactionMatch(ctx, { ignoreStatusFilter: true })
  const lifetimeMatch = transactionMatch(ctx, { ignoreDate: true, ignoreStatusFilter: true })

  const [agg] = await PaymentTransaction.aggregate([
    { $match: rangeMatch },
    {
      $group: {
        _id: null,
        totalTransactions: { $sum: 1 },
        successful: { $sum: { $cond: [{ $eq: ['$orderStatus', 'SUCCESS'] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $in: ['$orderStatus', ['FAILED', 'CANCELLED']] }, 1, 0] } },
        pending: { $sum: { $cond: [{ $in: ['$orderStatus', ['PENDING', 'INITIATED']] }, 1, 0] } },
        revenue: { $sum: { $cond: [{ $eq: ['$orderStatus', 'SUCCESS'] }, asNumber('$amount'), 0] } },
      },
    },
  ])

  const [todayAgg, monthAgg, lifetimeAgg] = await Promise.all([
    PaymentTransaction.aggregate([
      { $match: { ...lifetimeMatch, orderStatus: 'SUCCESS', createdAt: { $gte: startOfToday } } },
      { $group: { _id: null, revenue: sumField('$amount'), count: { $sum: 1 } } },
    ]),
    PaymentTransaction.aggregate([
      { $match: { ...lifetimeMatch, orderStatus: 'SUCCESS', createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, revenue: sumField('$amount'), count: { $sum: 1 } } },
    ]),
    PaymentTransaction.aggregate([
      { $match: { ...lifetimeMatch, orderStatus: 'SUCCESS' } },
      { $group: { _id: null, revenue: sumField('$amount'), count: { $sum: 1 } } },
    ]),
  ])

  const successful = agg?.successful || 0
  const revenue = round2(agg?.revenue)

  return {
    currency: CURRENCY,
    totalTransactions: agg?.totalTransactions || 0,
    successfulTransactions: successful,
    failedTransactions: agg?.failed || 0,
    pendingTransactions: agg?.pending || 0,
    revenue,
    lifetimeRevenue: round2(lifetimeAgg?.[0]?.revenue),
    todayRevenue: round2(todayAgg?.[0]?.revenue),
    monthlyRevenue: round2(monthAgg?.[0]?.revenue),
    averageTransactionValue: successful > 0 ? round2(revenue / successful) : 0,
  }
}

async function getPackageSummary(ctx) {
  const match = {
    ...transactionMatch(ctx, { successOnly: true, paymentType: 1 }),
    packageId: { $ne: null },
  }

  const [agg] = await PaymentTransaction.aggregate([
    { $match: match },
    ...PACKAGE_EXPIRY_STAGES,
    {
      $group: {
        _id: null,
        totalPurchases: { $sum: 1 },
        revenue: sumField('$amount'),
        active: {
          $sum: {
            $cond: [{ $or: [{ $eq: ['$expiresAt', null] }, { $gt: ['$expiresAt', ctx.now] }] }, 1, 0],
          },
        },
        expired: {
          $sum: {
            $cond: [
              { $and: [{ $ne: ['$expiresAt', null] }, { $lte: ['$expiresAt', ctx.now] }] },
              1,
              0,
            ],
          },
        },
      },
    },
  ])

  const [mostPurchased] = await PaymentTransaction.aggregate([
    { $match: match },
    { $group: { _id: '$packageId', purchases: { $sum: 1 }, revenue: sumField('$amount') } },
    { $sort: { purchases: -1, revenue: -1 } },
    { $limit: 1 },
    {
      $lookup: {
        from: COLLECTIONS.packages,
        localField: '_id',
        foreignField: '_id',
        as: 'package',
      },
    },
    { $unwind: { path: '$package', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        packageId: '$_id',
        name: { $ifNull: ['$package.packageName', 'Unknown package'] },
        purchases: 1,
        revenue: 1,
      },
    },
  ])

  return {
    currency: CURRENCY,
    totalPurchases: agg?.totalPurchases || 0,
    activeSubscriptions: agg?.active || 0,
    expiredSubscriptions: agg?.expired || 0,
    revenue: round2(agg?.revenue),
    mostPurchased: mostPurchased
      ? { ...mostPurchased, revenue: round2(mostPurchased.revenue) }
      : null,
  }
}

async function getStorageSummary(ctx) {
  const match = {
    ...transactionMatch(ctx, { successOnly: true }),
    storagefacilitiesId: { $ne: null },
  }

  const [agg] = await PaymentTransaction.aggregate([
    { $match: match },
    {
      $lookup: {
        from: COLLECTIONS.storageFacilities,
        localField: 'storagefacilitiesId',
        foreignField: '_id',
        as: 'facility',
      },
    },
    { $unwind: { path: '$facility', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        // A booking runs for `facilityWeek` weeks from the payment date.
        endsAt: {
          $add: [
            { $ifNull: ['$paymentDate', '$createdAt'] },
            { $multiply: [asNumber('$facility.facilityWeek'), 7 * MS_PER_DAY] },
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        totalBookings: { $sum: 1 },
        revenue: sumField('$amount'),
        active: { $sum: { $cond: [{ $gt: ['$endsAt', ctx.now] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $lte: ['$endsAt', ctx.now] }, 1, 0] } },
      },
    },
  ])

  return {
    currency: CURRENCY,
    totalBookings: agg?.totalBookings || 0,
    activeBookings: agg?.active || 0,
    completedBookings: agg?.completed || 0,
    revenue: round2(agg?.revenue),
  }
}

/** Period-over-period deltas against the equally-sized preceding window. */
async function getGrowth(ctx) {
  const { range } = ctx
  if (!range.previous.start || !range.previous.end) {
    return { users: null, products: null, revenue: null, transactions: null }
  }

  const prevCtx = {
    ...ctx,
    range: { ...range, start: range.previous.start, end: range.previous.end },
  }

  const [
    currentUsers,
    previousUsers,
    currentProducts,
    previousProducts,
    currentRevenue,
    previousRevenue,
  ] = await Promise.all([
    User.countDocuments(userMatch(ctx)),
    User.countDocuments(userMatch(prevCtx)),
    Product.countDocuments(productMatch(ctx, { ignoreStatus: true })),
    Product.countDocuments(productMatch(prevCtx, { ignoreStatus: true })),
    PaymentTransaction.aggregate([
      { $match: transactionMatch(ctx, { successOnly: true }) },
      { $group: { _id: null, revenue: sumField('$amount'), count: { $sum: 1 } } },
    ]),
    PaymentTransaction.aggregate([
      { $match: transactionMatch(prevCtx, { successOnly: true }) },
      { $group: { _id: null, revenue: sumField('$amount'), count: { $sum: 1 } } },
    ]),
  ])

  const percent = (current, previous) => {
    if (!previous) return current > 0 ? 100 : 0
    return round2(((current - previous) / previous) * 100)
  }

  return {
    users: { current: currentUsers, previous: previousUsers, changePercent: percent(currentUsers, previousUsers) },
    products: {
      current: currentProducts,
      previous: previousProducts,
      changePercent: percent(currentProducts, previousProducts),
    },
    revenue: {
      current: round2(currentRevenue?.[0]?.revenue),
      previous: round2(previousRevenue?.[0]?.revenue),
      changePercent: percent(currentRevenue?.[0]?.revenue || 0, previousRevenue?.[0]?.revenue || 0),
    },
    transactions: {
      current: currentRevenue?.[0]?.count || 0,
      previous: previousRevenue?.[0]?.count || 0,
      changePercent: percent(currentRevenue?.[0]?.count || 0, previousRevenue?.[0]?.count || 0),
    },
  }
}

/** Every KPI card in one round trip. */
async function getSummary(ctx) {
  const [users, products, transactions, packages, storage, growth] = await Promise.all([
    getUserSummary(ctx),
    getProductSummary(ctx),
    getTransactionSummary(ctx),
    getPackageSummary(ctx),
    getStorageSummary(ctx),
    getGrowth(ctx),
  ])
  return { users, products, transactions, packages, storage, growth }
}

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------

/** Group-by-bucket stage shared by every time series. */
function bucketStage(ctx, dateField = '$createdAt') {
  return {
    $dateToString: {
      format: ctx.range.bucketFormat,
      date: dateField,
      timezone: ctx.range.timezone,
    },
  }
}

/**
 * Turn `[{ _id: '2026-08-04', value: 3 }]` into a dense, ordered series with
 * zero-filled gaps and pre-formatted axis labels.
 */
function toSeries(ctx, rows, keys = ['value']) {
  const buckets = enumerateBuckets(
    ctx.range.start,
    ctx.range.end,
    ctx.range.granularity,
    ctx.range.timezone,
  )
  const byBucket = new Map(rows.map((row) => [String(row._id), row]))

  // Unbounded (all-time) ranges have no enumerable window — fall back to the
  // buckets the data itself produced, sorted lexicographically.
  const ordered = buckets.length
    ? buckets
    : rows.map((row) => String(row._id)).sort()

  return ordered.map((bucket) => {
    const row = byBucket.get(bucket) || {}
    const point = { bucket, label: humanizeBucket(bucket, ctx.range.granularity) }
    keys.forEach((key) => {
      point[key] = round2(row[key] || 0)
    })
    return point
  })
}

async function getUserRegistrationTrend(ctx) {
  const rows = await User.aggregate([
    { $match: userMatch(ctx) },
    { $group: { _id: bucketStage(ctx), value: { $sum: 1 } } },
  ])
  return toSeries(ctx, rows)
}

async function getProductPostingTrend(ctx) {
  const rows = await Product.aggregate([
    { $match: productMatch(ctx, { ignoreStatus: true }) },
    { $group: { _id: bucketStage(ctx), value: { $sum: 1 } } },
  ])
  return toSeries(ctx, rows)
}

async function getRevenueTrend(ctx) {
  const rows = await PaymentTransaction.aggregate([
    { $match: transactionMatch(ctx, { successOnly: true }) },
    {
      $group: {
        _id: bucketStage(ctx),
        value: sumField('$amount'),
        transactions: { $sum: 1 },
      },
    },
  ])
  return toSeries(ctx, rows, ['value', 'transactions'])
}

async function getPackagePurchaseTrend(ctx) {
  const rows = await PaymentTransaction.aggregate([
    {
      $match: {
        ...transactionMatch(ctx, { successOnly: true, paymentType: 1 }),
        packageId: { $ne: null },
      },
    },
    { $group: { _id: bucketStage(ctx), value: { $sum: 1 }, revenue: sumField('$amount') } },
  ])
  return toSeries(ctx, rows, ['value', 'revenue'])
}

/**
 * Active users per bucket.
 *
 * This schema has no login audit trail, so "active" is derived from product
 * views (`productview`), the highest-volume authenticated signal available.
 * Exposed alongside registrations so the two can be read together.
 */
async function getUserActivityTrend(ctx) {
  const dateFilter = buildDateFilter(ctx.range.start, ctx.range.end)
  const rows = await ProductView.aggregate([
    { $match: dateFilter ? { dateAdded: dateFilter } : {} },
    {
      $group: {
        _id: { bucket: bucketStage(ctx, '$dateAdded'), user: '$userID' },
      },
    },
    { $group: { _id: '$_id.bucket', value: { $sum: 1 } } },
  ])
  return toSeries(ctx, rows)
}

async function getProductStatusDistribution(ctx) {
  const rows = await Product.aggregate([
    { $match: productMatch(ctx, { ignoreStatus: true }) },
    { $group: { _id: '$status', value: { $sum: 1 } } },
  ])

  const byStatus = new Map(rows.map((row) => [String(row._id), row.value]))
  const [drafts, expired] = await Promise.all([
    ProductDraft.countDocuments({
      status: 'draft',
      ...(buildDateFilter(ctx.range.start, ctx.range.end)
        ? { createdAt: buildDateFilter(ctx.range.start, ctx.range.end) }
        : {}),
    }),
    countExpiredProducts(ctx),
  ])

  return [
    { key: 'active', label: 'Active', value: byStatus.get('active') || 0 },
    { key: 'pending', label: 'Pending', value: byStatus.get('pending') || 0 },
    { key: 'rejected', label: 'Rejected', value: byStatus.get('rejected') || 0 },
    { key: 'sold', label: 'Sold', value: byStatus.get('sold') || 0 },
    { key: 'inactive', label: 'Inactive', value: byStatus.get('inactive') || 0 },
    { key: 'expired', label: 'Expired', value: expired },
    { key: 'draft', label: 'Draft', value: drafts },
  ]
}

async function getPackageSalesDistribution(ctx) {
  const rows = await PaymentTransaction.aggregate([
    {
      $match: {
        ...transactionMatch(ctx, { successOnly: true, paymentType: 1 }),
        packageId: { $ne: null },
      },
    },
    { $group: { _id: '$packageId', value: { $sum: 1 }, revenue: sumField('$amount') } },
    { $sort: { value: -1 } },
    { $limit: 12 },
    {
      $lookup: {
        from: COLLECTIONS.packages,
        localField: '_id',
        foreignField: '_id',
        as: 'package',
      },
    },
    { $unwind: { path: '$package', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        key: { $toString: '$_id' },
        label: { $ifNull: ['$package.packageName', 'Unknown package'] },
        value: 1,
        revenue: 1,
      },
    },
  ])
  return rows.map((row) => ({ ...row, revenue: round2(row.revenue) }))
}

/**
 * Products per top-level category.
 * Listings carry `categoryPath` (all ancestors) so a leaf listing rolls up into
 * its root category; listings without a path fall back to `category`.
 */
async function getCategoryProductDistribution(ctx, limit = 10) {
  const rows = await Product.aggregate([
    { $match: productMatch(ctx, { ignoreStatus: true }) },
    {
      $addFields: {
        rootCategory: {
          $ifNull: [{ $arrayElemAt: ['$categoryPath', 0] }, '$category'],
        },
      },
    },
    { $match: { rootCategory: { $ne: null } } },
    { $group: { _id: '$rootCategory', value: { $sum: 1 } } },
    { $sort: { value: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: COLLECTIONS.categories,
        localField: '_id',
        foreignField: '_id',
        as: 'category',
      },
    },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        key: { $toString: '$_id' },
        label: { $ifNull: ['$category.name', 'Uncategorised'] },
        value: 1,
      },
    },
  ])
  return rows
}

async function getCharts(ctx) {
  const [
    userRegistrations,
    productPostings,
    revenue,
    packagePurchases,
    userActivity,
    productStatus,
    packageSales,
    categoryProducts,
  ] = await Promise.all([
    getUserRegistrationTrend(ctx),
    getProductPostingTrend(ctx),
    getRevenueTrend(ctx),
    getPackagePurchaseTrend(ctx),
    getUserActivityTrend(ctx),
    getProductStatusDistribution(ctx),
    getPackageSalesDistribution(ctx),
    getCategoryProductDistribution(ctx),
  ])

  return {
    granularity: ctx.range.granularity,
    currency: CURRENCY,
    userRegistrations,
    productPostings,
    revenue,
    packagePurchases,
    userActivity,
    productStatus,
    packageSales,
    categoryProducts,
  }
}

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------

/** Top categories by listing count and by revenue generated. */
async function getTopCategories(ctx, limit = 10) {
  const [byCount, byRevenue] = await Promise.all([
    getCategoryProductDistribution(ctx, limit),
    PaymentTransaction.aggregate([
      { $match: transactionMatch(ctx, { successOnly: true }) },
      {
        $lookup: {
          from: COLLECTIONS.products,
          localField: 'productId',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      {
        $addFields: {
          rootCategory: {
            $ifNull: [{ $arrayElemAt: ['$product.categoryPath', 0] }, '$product.category'],
          },
        },
      },
      { $match: { rootCategory: { $ne: null } } },
      { $group: { _id: '$rootCategory', value: sumField('$amount'), transactions: { $sum: 1 } } },
      { $sort: { value: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: COLLECTIONS.categories,
          localField: '_id',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          key: { $toString: '$_id' },
          label: { $ifNull: ['$category.name', 'Uncategorised'] },
          value: 1,
          transactions: 1,
        },
      },
    ]),
  ])

  return {
    byProductCount: byCount,
    byRevenue: byRevenue.map((row) => ({ ...row, value: round2(row.value) })),
  }
}

/** Top listing locations. `city` is free text; `country` stands in for state. */
async function getTopLocations(ctx, limit = 8) {
  const match = productMatch(ctx, { ignoreStatus: true })

  const buildTop = (field) =>
    Product.aggregate([
      { $match: { ...match, [field]: { $nin: [null, ''] } } },
      { $group: { _id: { $trim: { input: `$${field}` } }, value: { $sum: 1 } } },
      { $match: { _id: { $nin: [null, ''] } } },
      { $sort: { value: -1 } },
      { $limit: limit },
      { $project: { _id: 0, label: '$_id', value: 1 } },
    ])

  const [cities, regions] = await Promise.all([buildTop('city'), buildTop('country')])
  return { cities, regions }
}

/** Conversion, per-user averages and marketplace engagement ratios. */
async function getConversionMetrics(ctx) {
  const lifetimeUsers = userMatch(ctx, { ignoreDate: true })

  const [
    totalUsers,
    payingUsers,
    totalProducts,
    sellersWithProducts,
    revenueAgg,
    repeatBuyers,
    repeatSellers,
    totalChats,
  ] = await Promise.all([
    User.countDocuments(lifetimeUsers),
    PaymentTransaction.distinct('userId', {
      ...transactionMatch(ctx, { successOnly: true, paymentType: 1 }),
      packageId: { $ne: null },
    }).then((ids) => ids.length),
    Product.countDocuments(productMatch(ctx, { ignoreDate: true, ignoreStatus: true })),
    Product.distinct('seller', productMatch(ctx, { ignoreDate: true, ignoreStatus: true })).then(
      (ids) => ids.length,
    ),
    PaymentTransaction.aggregate([
      { $match: transactionMatch(ctx, { successOnly: true }) },
      { $group: { _id: null, revenue: sumField('$amount') } },
    ]),
    PaymentTransaction.aggregate([
      {
        $match: {
          ...transactionMatch(ctx, { successOnly: true, paymentType: 2 }),
          buyerId: { $ne: null },
        },
      },
      { $group: { _id: '$buyerId', purchases: { $sum: 1 } } },
      { $match: { purchases: { $gt: 1 } } },
      { $count: 'count' },
    ]),
    PaymentTransaction.aggregate([
      {
        $match: {
          ...transactionMatch(ctx, { successOnly: true, paymentType: 1 }),
          packageId: { $ne: null },
        },
      },
      { $group: { _id: '$userId', purchases: { $sum: 1 } } },
      { $match: { purchases: { $gt: 1 } } },
      { $count: 'count' },
    ]),
    Chat.countDocuments({
      product: { $ne: null },
      ...(buildDateFilter(ctx.range.start, ctx.range.end)
        ? { createdAt: buildDateFilter(ctx.range.start, ctx.range.end) }
        : {}),
    }),
  ])

  const revenue = round2(revenueAgg?.[0]?.revenue)

  return {
    currency: CURRENCY,
    conversionRate: totalUsers > 0 ? round2((payingUsers / totalUsers) * 100) : 0,
    payingUsers,
    averageProductsPerUser: sellersWithProducts > 0 ? round2(totalProducts / sellersWithProducts) : 0,
    averageRevenuePerUser: totalUsers > 0 ? round2(revenue / totalUsers) : 0,
    repeatBuyers: repeatBuyers?.[0]?.count || 0,
    repeatSellers: repeatSellers?.[0]?.count || 0,
    totalChatsStarted: totalChats,
    // No Offer model exists in this schema; surfaced as unsupported rather than
    // silently reported as zero.
    totalOffers: null,
    offerAcceptanceRate: null,
  }
}

/** Mean days between a listing going live and being marked sold. */
async function getAverageTimeToSell(ctx) {
  // Scoped by when the sale happened, not when the listing was created.
  const soldFilter = buildDateFilter(ctx.range.start, ctx.range.end) || { $ne: null }

  const [row] = await Product.aggregate([
    {
      $match: {
        ...productMatch(ctx, { ignoreStatus: true, ignoreDate: true }),
        soldAt: soldFilter,
      },
    },
    { $addFields: { daysToSell: { $divide: [{ $subtract: ['$soldAt', '$createdAt'] }, MS_PER_DAY] } } },
    { $match: { daysToSell: { $gte: 0 } } },
    { $group: { _id: null, averageDays: { $avg: '$daysToSell' }, soldCount: { $sum: 1 } } },
  ])

  return {
    averageDays: round2(row?.averageDays),
    soldCount: row?.soldCount || 0,
  }
}

/** The single best revenue month across all time — useful as a benchmark. */
async function getHighestRevenueMonth(ctx) {
  const [row] = await PaymentTransaction.aggregate([
    { $match: transactionMatch(ctx, { ignoreDate: true, successOnly: true }) },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: ctx.range.timezone },
        },
        revenue: sumField('$amount'),
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: 1 },
  ])
  if (!row) return null
  return {
    month: row._id,
    label: humanizeBucket(row._id, 'month'),
    revenue: round2(row.revenue),
  }
}

/** Package purchases whose validity runs out inside the next `days`. */
async function getExpiringPackages(ctx, days = 7, limit = 10) {
  const until = new Date(ctx.now.getTime() + days * MS_PER_DAY)

  const rows = await PaymentTransaction.aggregate([
    {
      $match: {
        deletedAt: null,
        orderStatus: 'SUCCESS',
        paymentType: 1,
        packageId: { $ne: null },
      },
    },
    ...PACKAGE_EXPIRY_STAGES,
    { $match: { expiresAt: { $ne: null, $gte: ctx.now, $lte: until } } },
    { $sort: { expiresAt: 1 } },
    { $limit: limit },
    { $lookup: { from: COLLECTIONS.users, localField: 'userId', foreignField: '_id', as: 'user' } },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        transactionId: { $toString: '$_id' },
        userId: { $toString: '$userId' },
        userName: { $ifNull: ['$user.name', '—'] },
        userEmail: { $ifNull: ['$user.email', '—'] },
        packageName: { $ifNull: ['$package.packageName', '—'] },
        expiresAt: 1,
        amount: 1,
      },
    },
  ])

  const [countRow] = await PaymentTransaction.aggregate([
    {
      $match: {
        deletedAt: null,
        orderStatus: 'SUCCESS',
        paymentType: 1,
        packageId: { $ne: null },
      },
    },
    ...PACKAGE_EXPIRY_STAGES,
    { $match: { expiresAt: { $ne: null, $gte: ctx.now, $lte: until } } },
    { $count: 'count' },
  ])

  return { days, total: countRow?.count || 0, items: rows }
}

/** Listings whose promoting package expires inside the next `days`. */
async function getProductsNearExpiry(ctx, days = 7, limit = 10) {
  const until = new Date(ctx.now.getTime() + days * MS_PER_DAY)

  const rows = await PaymentTransaction.aggregate([
    {
      $match: {
        deletedAt: null,
        orderStatus: 'SUCCESS',
        paymentType: 1,
        packageId: { $ne: null },
      },
    },
    ...PACKAGE_EXPIRY_STAGES,
    { $match: { expiresAt: { $ne: null, $gte: ctx.now, $lte: until } } },
    { $sort: { expiresAt: 1 } },
    { $limit: limit },
    {
      $lookup: {
        from: COLLECTIONS.products,
        localField: 'productId',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
    { $match: { 'product.status': { $in: ['active', 'pending'] } } },
    {
      $project: {
        _id: 0,
        productId: { $toString: '$productId' },
        title: { $ifNull: ['$product.title', '—'] },
        status: { $ifNull: ['$product.status', 'unknown'] },
        image: { $arrayElemAt: [{ $ifNull: ['$product.images', []] }, 0] },
        packageName: { $ifNull: ['$package.packageName', '—'] },
        expiresAt: 1,
      },
    },
  ])

  return { days, items: rows }
}

/** Counts behind the "needs your attention" tiles. */
async function getPendingApprovals(ctx) {
  const [products, identities] = await Promise.all([
    Product.countDocuments({ status: 'pending' }),
    User.countDocuments({ identityVerificationStatus: 'pending' }),
  ])
  return { products, identityVerifications: identities, total: products + identities }
}

/** Search keywords in the window, falling back to lifetime analytics. */
async function getPopularSearches(ctx, limit = 10) {
  const dateFilter = buildDateFilter(ctx.range.start, ctx.range.end)

  const scoped = await SearchHistory.aggregate([
    { $match: dateFilter ? { createdAt: dateFilter } : {} },
    { $group: { _id: { $toLower: '$keyword' }, value: { $sum: 1 } } },
    { $sort: { value: -1 } },
    { $limit: limit },
    { $project: { _id: 0, label: '$_id', value: 1 } },
  ])

  if (scoped.length) return { source: 'range', items: scoped }

  const lifetime = await SearchAnalytics.find({})
    .sort({ searchCount: -1, lastSearchedAt: -1 })
    .limit(limit)
    .lean()

  return {
    source: 'all_time',
    items: lifetime.map((row) => ({ label: row.keyword, value: row.searchCount })),
  }
}

/** New vs returning: users who registered in the window vs. those active earlier. */
async function getNewVsReturning(ctx) {
  const dateFilter = buildDateFilter(ctx.range.start, ctx.range.end)
  if (!dateFilter) return { newUsers: 0, returningUsers: 0 }

  const activeUserIds = await ProductView.distinct('userID', { dateAdded: dateFilter })
  if (!activeUserIds.length) {
    const newUsers = await User.countDocuments(userMatch(ctx))
    return { newUsers, returningUsers: 0 }
  }

  const newUsers = await User.countDocuments({
    _id: { $in: activeUserIds },
    createdAt: dateFilter,
  })

  return { newUsers, returningUsers: Math.max(0, activeUserIds.length - newUsers) }
}

async function getInsights(ctx) {
  const [
    topCategories,
    locations,
    conversion,
    timeToSell,
    highestRevenueMonth,
    expiringPackages,
    productsNearExpiry,
    pendingApprovals,
    popularSearches,
    newVsReturning,
    mostViewedProducts,
  ] = await Promise.all([
    getTopCategories(ctx),
    getTopLocations(ctx),
    getConversionMetrics(ctx),
    getAverageTimeToSell(ctx),
    getHighestRevenueMonth(ctx),
    getExpiringPackages(ctx),
    getProductsNearExpiry(ctx),
    getPendingApprovals(ctx),
    getPopularSearches(ctx),
    getNewVsReturning(ctx),
    getMostViewedProducts(ctx),
  ])

  return {
    currency: CURRENCY,
    topCategories,
    locations,
    conversion,
    timeToSell,
    highestRevenueMonth,
    expiringPackages,
    productsNearExpiry,
    pendingApprovals,
    popularSearches,
    newVsReturning,
    mostViewedProducts,
  }
}

async function getMostViewedProducts(ctx, limit = 5) {
  const rows = await Product.find(productMatch(ctx, { ignoreStatus: true }))
    .select('title views images category')
    .sort({ views: -1 })
    .limit(limit)
    .populate('category', 'name')
    .lean()

  return rows.map((row) => ({
    productId: String(row._id),
    title: row.title || '—',
    views: row.views || 0,
    image: row.images?.[0] || null,
    category: row.category?.name || '—',
  }))
}

// ---------------------------------------------------------------------------
// Tables (all paginated)
// ---------------------------------------------------------------------------

function paginate(query = {}) {
  const page = Math.max(Number(query.page) || 1, 1)
  const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100)
  return { page, limit, skip: (page - 1) * limit }
}

const TRENDING_SORTS = Object.freeze(['views', 'favorites', 'chats', 'sales', 'revenue'])

/**
 * Keep only ids that still resolve to a product matching the dashboard filters.
 *
 * Favourites, chats and payments all outlive the listings they point at, so a
 * driver that ranks by those alone reports a page count it can't fill. Joining
 * back to `products` inside the pipeline keeps `total` and the rows honest.
 */
function existingProductStage(baseMatch) {
  return [
    {
      $lookup: {
        from: COLLECTIONS.products,
        let: { productId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$_id', '$$productId'] } } },
          ...(Object.keys(baseMatch).length ? [{ $match: baseMatch }] : []),
          { $project: { _id: 1 } },
        ],
        as: '__product',
      },
    },
    { $match: { __product: { $ne: [] } } },
  ]
}

/** Run a ranking pipeline once for the page and once for the count. */
async function rankProductIds(model, pipeline, baseMatch, { skip, limit, sortKey }) {
  const stages = [...pipeline, ...existingProductStage(baseMatch)]
  const [rows, countRow] = await Promise.all([
    model.aggregate([...stages, { $sort: sortKey }, { $skip: skip }, { $limit: limit }]),
    model.aggregate([...stages, { $count: 'count' }]),
  ])
  return { ids: rows.map((row) => row._id).filter(Boolean), total: countRow?.[0]?.count || 0 }
}

/**
 * Trending products with view / favourite / chat / sales metrics.
 *
 * Sorting drives which collection leads the pipeline so we never scan every
 * product to rank by a derived metric; the leader picks candidate ids and the
 * remaining metrics are looked up only for those.
 */
async function getTrendingProducts(ctx, query = {}) {
  const { page, limit, skip } = paginate(query)
  const sort = TRENDING_SORTS.includes(String(query.sort)) ? String(query.sort) : 'views'
  const baseMatch = productMatch(ctx, { ignoreStatus: true })
  const dateFilter = buildDateFilter(ctx.range.start, ctx.range.end)

  let ids = []
  let total = 0

  if (sort === 'views') {
    // Views live on the product itself — no join needed.
    const [rows, count] = await Promise.all([
      Product.find(baseMatch).select('_id').sort({ views: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      Product.countDocuments(baseMatch),
    ])
    ids = rows.map((row) => row._id)
    total = count
  } else if (sort === 'favorites') {
    ;({ ids, total } = await rankProductIds(
      User,
      [
        { $match: { savedProducts: { $exists: true, $ne: [] } } },
        { $unwind: '$savedProducts' },
        { $group: { _id: '$savedProducts', value: { $sum: 1 } } },
      ],
      baseMatch,
      { skip, limit, sortKey: { value: -1 } },
    ))
  } else if (sort === 'chats') {
    ;({ ids, total } = await rankProductIds(
      Chat,
      [
        { $match: { product: { $ne: null }, ...(dateFilter ? { createdAt: dateFilter } : {}) } },
        { $group: { _id: '$product', value: { $sum: 1 } } },
      ],
      baseMatch,
      { skip, limit, sortKey: { value: -1 } },
    ))
  } else {
    ;({ ids, total } = await rankProductIds(
      PaymentTransaction,
      [
        { $match: transactionMatch(ctx, { successOnly: true, paymentType: 2 }) },
        { $group: { _id: '$productId', sales: { $sum: 1 }, revenue: sumField('$amount') } },
      ],
      baseMatch,
      { skip, limit, sortKey: sort === 'revenue' ? { revenue: -1 } : { sales: -1 } },
    ))
  }

  if (!ids.length) return { items: [], total, page, limit, sort }

  const items = await enrichTrendingProducts(ctx, ids, sort)
  return { items, total, page, limit, sort }
}

/** Attach every trending metric to an already-ranked list of product ids. */
async function enrichTrendingProducts(ctx, ids, sort) {
  const dateFilter = buildDateFilter(ctx.range.start, ctx.range.end)

  const [products, favorites, chats, sales, views] = await Promise.all([
    Product.find({ _id: { $in: ids } })
      .select('title images video price priceType status views category seller createdAt')
      .populate('category', 'name')
      .populate('seller', 'name email')
      .lean(),
    User.aggregate([
      { $match: { savedProducts: { $in: ids } } },
      { $unwind: '$savedProducts' },
      { $match: { savedProducts: { $in: ids } } },
      { $group: { _id: '$savedProducts', value: { $sum: 1 } } },
    ]),
    Chat.aggregate([
      { $match: { product: { $in: ids }, ...(dateFilter ? { createdAt: dateFilter } : {}) } },
      { $group: { _id: '$product', value: { $sum: 1 } } },
    ]),
    PaymentTransaction.aggregate([
      {
        $match: {
          ...transactionMatch(ctx, { successOnly: true, paymentType: 2 }),
          productId: { $in: ids },
        },
      },
      { $group: { _id: '$productId', sales: { $sum: 1 }, revenue: sumField('$amount') } },
    ]),
    ProductView.aggregate([
      { $match: { productID: { $in: ids }, status: 'active' } },
      { $group: { _id: '$productID', value: { $sum: 1 } } },
    ]),
  ])

  const toMap = (rows, key = 'value') =>
    new Map(rows.map((row) => [String(row._id), key === '*' ? row : row[key]]))

  const favoriteMap = toMap(favorites)
  const chatMap = toMap(chats)
  const viewMap = toMap(views)
  const salesMap = toMap(sales, '*')
  const productMap = new Map(products.map((product) => [String(product._id), product]))

  // Preserve the ranking order established by the driver query.
  return ids
    .map((id) => {
      const key = String(id)
      const product = productMap.get(key)
      if (!product) return null
      const sale = salesMap.get(key) || {}
      const favoritesCount = favoriteMap.get(key) || 0
      const chatsCount = chatMap.get(key) || 0
      const uniqueViewers = viewMap.get(key) || 0

      return {
        productId: key,
        title: product.title || '—',
        image: product.images?.[0] || null,
        video: product.video || null,
        category: product.category?.name || '—',
        seller: product.seller?.name || '—',
        sellerId: product.seller?._id ? String(product.seller._id) : null,
        status: product.status || 'unknown',
        price: product.price ?? null,
        views: product.views || 0,
        uniqueViewers,
        favorites: favoritesCount,
        chats: chatsCount,
        offers: null, // no Offer model in this schema
        totalInquiries: chatsCount + favoritesCount,
        totalSales: sale.sales || 0,
        revenue: round2(sale.revenue),
        sortedBy: sort,
      }
    })
    .filter(Boolean)
}

async function getRecentTransactions(ctx, query = {}) {
  const { page, limit, skip } = paginate(query)
  const match = transactionMatch(ctx)

  const [rows, total] = await Promise.all([
    PaymentTransaction.find(match)
      .select(
        'orderId amount currency orderStatus paymentMode gatewayName paymentType paymentFrom createdAt paymentDate userId buyerId sellerId productId packageId billingName billingEmail',
      )
      .populate('userId', 'name email')
      .populate('buyerId', 'name email')
      .populate('sellerId', 'name email')
      .populate('productId', 'title')
      .populate('packageId', 'packageName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    PaymentTransaction.countDocuments(match),
  ])

  const items = rows.map((row) => ({
    id: String(row._id),
    transactionId: String(row._id),
    orderId: row.orderId || '—',
    buyer: row.buyerId?.name || (row.paymentType === 2 ? row.userId?.name : null) || '—',
    seller: row.sellerId?.name || (row.paymentType === 1 ? row.userId?.name : null) || '—',
    product: row.productId?.title || '—',
    package: row.packageId?.packageName || '—',
    paymentType: row.paymentType === 2 ? 'Product Checkout' : 'Ads Payment',
    amount: round2(row.amount),
    currency: row.currency || CURRENCY,
    gateway: row.gatewayName || '—',
    paymentMethod: normalizePaymentMethod(row.paymentMode) || '—',
    platform: platformLabel(paymentFromToPlatform(row.paymentFrom)),
    status: paymentStatusLabel(row.orderStatus),
    statusBadge: paymentStatusBadge(row.orderStatus),
    date: row.paymentDate || row.createdAt,
  }))

  return { items, total, page, limit }
}

async function getRecentUsers(ctx, query = {}) {
  const { page, limit, skip } = paginate(query)
  const match = userMatch(ctx)

  const [rows, total] = await Promise.all([
    User.find(match)
      .select('name email phone phoneCountryCode status isVerified memberSince createdAt avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(match),
  ])

  const items = rows.map((row) => ({
    id: String(row._id),
    name: row.name || '—',
    email: row.email || '—',
    mobile: [row.phoneCountryCode, row.phone].filter(Boolean).join(' ') || '—',
    avatar: row.avatar || null,
    registeredAt: row.memberSince || row.createdAt,
    status: row.status || 'active',
    isVerified: Boolean(row.isVerified),
    // No login audit trail exists in this schema.
    lastLogin: null,
  }))

  return { items, total, page, limit }
}

async function getRecentProducts(ctx, query = {}) {
  const { page, limit, skip } = paginate(query)
  const match = productMatch(ctx)

  const [rows, total] = await Promise.all([
    Product.find(match)
      .select('title images video price priceType status createdAt category seller')
      .populate('category', 'name')
      .populate('seller', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.countDocuments(match),
  ])

  const items = rows.map((row) => ({
    id: String(row._id),
    title: row.title || '—',
    image: row.images?.[0] || null,
    video: row.video || null,
    category: row.category?.name || '—',
    seller: row.seller?.name || '—',
    price: row.price ?? null,
    priceType: row.priceType || null,
    status: row.status || 'unknown',
    postedAt: row.createdAt,
  }))

  return { items, total, page, limit }
}

async function getPackagePurchaseHistory(ctx, query = {}) {
  const { page, limit, skip } = paginate(query)
  const match = {
    ...transactionMatch(ctx, { successOnly: true, paymentType: 1 }),
    packageId: { $ne: null },
  }

  const [rows, countRow] = await Promise.all([
    PaymentTransaction.aggregate([
      { $match: match },
      ...PACKAGE_EXPIRY_STAGES,
      { $sort: { paidAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      { $lookup: { from: COLLECTIONS.users, localField: 'userId', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          amount: 1,
          currency: 1,
          paidAt: 1,
          expiresAt: 1,
          userName: { $ifNull: ['$user.name', '—'] },
          userEmail: { $ifNull: ['$user.email', '—'] },
          userId: 1,
          packageName: { $ifNull: ['$package.packageName', '—'] },
          validityDays: '$package.validityDays',
        },
      },
    ]),
    PaymentTransaction.countDocuments(match),
  ])

  const items = rows.map((row) => ({
    id: String(row._id),
    userId: row.userId ? String(row.userId) : null,
    user: row.userName,
    userEmail: row.userEmail,
    package: row.packageName,
    amount: round2(row.amount),
    currency: row.currency || CURRENCY,
    purchasedAt: row.paidAt,
    expiresAt: row.expiresAt || null,
    status: !row.expiresAt || row.expiresAt > ctx.now ? 'active' : 'expired',
  }))

  return { items, total: countRow, page, limit }
}

async function getTopSellers(ctx, query = {}) {
  const { page, limit, skip } = paginate(query)
  const productFilter = productMatch(ctx, { ignoreStatus: true })

  const rows = await Product.aggregate([
    { $match: { ...productFilter, seller: { $ne: null } } },
    {
      $group: {
        _id: '$seller',
        totalProducts: { $sum: 1 },
        activeListings: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        soldProducts: { $sum: { $cond: [{ $eq: ['$status', 'sold'] }, 1, 0] } },
      },
    },
    { $sort: { totalProducts: -1 } },
    { $skip: skip },
    { $limit: limit },
    { $lookup: { from: COLLECTIONS.users, localField: '_id', foreignField: '_id', as: 'user' } },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
  ])

  const sellerIds = rows.map((row) => row._id)
  const revenue = sellerIds.length
    ? await PaymentTransaction.aggregate([
        {
          $match: {
            ...transactionMatch(ctx, { successOnly: true, paymentType: 2 }),
            sellerId: { $in: sellerIds },
          },
        },
        { $group: { _id: '$sellerId', revenue: sumField('$amount'), sales: { $sum: 1 } } },
      ])
    : []

  const revenueMap = new Map(revenue.map((row) => [String(row._id), row]))
  const total = await Product.aggregate([
    { $match: { ...productFilter, seller: { $ne: null } } },
    { $group: { _id: '$seller' } },
    { $count: 'count' },
  ]).then((res) => res?.[0]?.count || 0)

  const items = rows.map((row) => {
    const stats = revenueMap.get(String(row._id)) || {}
    return {
      id: String(row._id),
      name: row.user?.name || '—',
      email: row.user?.email || '—',
      avatar: row.user?.avatar || null,
      totalProducts: row.totalProducts,
      activeListings: row.activeListings,
      totalSales: stats.sales || row.soldProducts || 0,
      revenue: round2(stats.revenue),
      currency: CURRENCY,
    }
  })

  return { items, total, page, limit }
}

async function getTopBuyers(ctx, query = {}) {
  const { page, limit, skip } = paginate(query)
  const match = {
    ...transactionMatch(ctx, { successOnly: true, paymentType: 2 }),
    buyerId: { $ne: null },
  }

  const [rows, total] = await Promise.all([
    PaymentTransaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$buyerId',
          totalPurchases: { $sum: 1 },
          amountSpent: sumField('$amount'),
          lastPurchase: { $max: { $ifNull: ['$paymentDate', '$createdAt'] } },
        },
      },
      { $sort: { amountSpent: -1 } },
      { $skip: skip },
      { $limit: limit },
      { $lookup: { from: COLLECTIONS.users, localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    ]),
    PaymentTransaction.aggregate([
      { $match: match },
      { $group: { _id: '$buyerId' } },
      { $count: 'count' },
    ]).then((res) => res?.[0]?.count || 0),
  ])

  const items = rows.map((row) => ({
    id: String(row._id),
    name: row.user?.name || '—',
    email: row.user?.email || '—',
    avatar: row.user?.avatar || null,
    totalPurchases: row.totalPurchases,
    amountSpent: round2(row.amountSpent),
    currency: CURRENCY,
    lastPurchase: row.lastPurchase || null,
  }))

  return { items, total, page, limit }
}

/**
 * Activity feed built from the events the schema already records: signups,
 * listings awaiting approval, payments, package purchases, storage bookings.
 */
async function getActivityFeed(ctx, query = {}) {
  const limit = Math.min(Math.max(Number(query.limit) || 8, 1), 25)
  const dateFilter = buildDateFilter(ctx.range.start, ctx.range.end)
  const withDate = dateFilter ? { createdAt: dateFilter } : {}

  const [users, pendingProducts, transactions] = await Promise.all([
    User.find(withDate).select('name email createdAt').sort({ createdAt: -1 }).limit(limit).lean(),
    Product.find({ ...withDate, status: 'pending' })
      .select('title createdAt seller')
      .populate('seller', 'name')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),
    PaymentTransaction.find({ deletedAt: null, ...withDate })
      .select('orderId amount currency orderStatus packageId storagefacilitiesId createdAt')
      .populate('packageId', 'packageName')
      .sort({ createdAt: -1 })
      .limit(limit * 2)
      .lean(),
  ])

  const events = []

  users.forEach((user) => {
    events.push({
      id: `user-${user._id}`,
      type: 'user_registered',
      severity: 'info',
      title: 'New user registered',
      description: `${user.name || 'Unnamed user'} · ${user.email || 'no email'}`,
      at: user.createdAt,
      link: `/users/${user._id}`,
    })
  })

  pendingProducts.forEach((product) => {
    events.push({
      id: `product-${product._id}`,
      type: 'product_approval',
      severity: 'warning',
      title: 'Product awaiting approval',
      description: `${product.title || 'Untitled'} · ${product.seller?.name || 'Unknown seller'}`,
      at: product.createdAt,
      link: `/products/${product._id}`,
    })
  })

  transactions.forEach((txn) => {
    const status = paymentStatusLabel(txn.orderStatus)
    const isStorage = Boolean(txn.storagefacilitiesId)
    const isPackage = Boolean(txn.packageId)
    events.push({
      id: `txn-${txn._id}`,
      type: isStorage ? 'storage_booking' : isPackage ? 'package_purchase' : 'payment',
      severity: status === 'Failed' ? 'error' : status === 'Success' ? 'success' : 'info',
      title: isStorage
        ? 'Storage booking'
        : isPackage
        ? `Package purchase — ${txn.packageId?.packageName || 'package'}`
        : `Payment ${status.toLowerCase()}`,
      description: `${txn.orderId || '—'} · ${txn.currency || CURRENCY} ${round2(txn.amount)}`,
      at: txn.createdAt,
      link: `/transactions/${txn._id}`,
    })
  })

  const items = events
    .filter((event) => event.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit)

  return { items, total: items.length }
}

const TABLE_RESOLVERS = Object.freeze({
  'trending-products': getTrendingProducts,
  'recent-transactions': getRecentTransactions,
  'recent-users': getRecentUsers,
  'recent-products': getRecentProducts,
  'package-purchases': getPackagePurchaseHistory,
  'top-sellers': getTopSellers,
  'top-buyers': getTopBuyers,
  notifications: getActivityFeed,
})

function getTableResolver(name) {
  return TABLE_RESOLVERS[String(name)] || null
}

// ---------------------------------------------------------------------------
// Filter options for the dashboard filter bar
// ---------------------------------------------------------------------------

async function getFilterOptions() {
  const [categories, packages] = await Promise.all([
    Category.find({ isDeleted: { $ne: true }, parentId: null, isActive: true })
      .select('name')
      .sort({ sortOrder: 1, name: 1 })
      .limit(200)
      .lean(),
    Package.find({ isDeleted: { $ne: true } })
      .select('packageName')
      .sort({ displayOrder: 1, packageName: 1 })
      .limit(200)
      .lean(),
  ])

  return {
    categories: categories.map((row) => ({ value: String(row._id), label: row.name })),
    packages: packages.map((row) => ({ value: String(row._id), label: row.packageName })),
    productStatuses: PRODUCT_STATUSES.map((status) => ({
      value: status,
      label: status.charAt(0).toUpperCase() + status.slice(1),
    })),
    paymentStatuses: [
      { value: 'success', label: 'Success' },
      { value: 'failed', label: 'Failed' },
      { value: 'pending', label: 'Pending' },
    ],
    userTypes: [
      { value: 'user', label: 'Customers' },
      { value: 'admin', label: 'Admins' },
      { value: 'verified', label: 'Verified' },
      { value: 'unverified', label: 'Unverified' },
    ],
    platforms: [
      { value: 'web', label: 'Web' },
      { value: 'ios', label: 'iOS' },
      { value: 'android', label: 'Android' },
    ],
  }
}

module.exports = {
  CURRENCY,
  PRODUCT_STATUSES,
  TRENDING_SORTS,
  buildContext,
  getSummary,
  getUserSummary,
  getProductSummary,
  getTransactionSummary,
  getPackageSummary,
  getStorageSummary,
  getGrowth,
  getCharts,
  getInsights,
  getFilterOptions,
  getTableResolver,
  getTrendingProducts,
  getRecentTransactions,
  getRecentUsers,
  getRecentProducts,
  getPackagePurchaseHistory,
  getTopSellers,
  getTopBuyers,
  getActivityFeed,
}
