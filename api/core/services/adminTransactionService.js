const { Types } = require('mongoose')
const AppError = require('../errors/AppError')
const PaymentTransaction = require('../../models/PaymentTransaction')
const PaymentLog = require('../../models/PaymentLog')
const {
  normalizePaymentMethod,
  orderStatusesForPaymentStatusFilter,
  paymentFromForPlatformFilter,
  PAYMENT_METHOD_OPTIONS,
} = require('../../utils/paymentLabels')

function escapeRegex(value) {
  return String(value).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Build a Mongo query for the admin transactions list.
 * Soft-deleted rows (deletedAt set) are excluded.
 */
function buildListQuery({
  search,
  paymentStatus,
  orderPlatform,
  paymentMethod,
  fromDate,
  toDate,
} = {}) {
  const query = { deletedAt: null }

  if (search && String(search).trim()) {
    const term = String(search).trim()
    const rx = new RegExp(escapeRegex(term), 'i')
    const or = [
      { orderId: rx },
      { trackingId: rx },
      { billingName: rx },
      { billingEmail: rx },
    ]
    if (Types.ObjectId.isValid(term) && String(new Types.ObjectId(term)) === term) {
      or.push({ _id: new Types.ObjectId(term) })
    }
    query.$or = or
  }

  const statuses = orderStatusesForPaymentStatusFilter(paymentStatus)
  if (statuses) query.orderStatus = { $in: statuses }

  const paymentFrom = paymentFromForPlatformFilter(orderPlatform)
  if (paymentFrom != null) query.paymentFrom = paymentFrom

  if (paymentMethod && String(paymentMethod).trim() && paymentMethod !== 'all') {
    const method = String(paymentMethod).trim()
    const lower = method.toLowerCase()
    let pattern = escapeRegex(method)
    if (lower === 'upi') pattern = 'upi|unified.?payment|bhim'
    else if (lower === 'credit card') pattern = 'credit(\\s*card)?|visa|master|amex|american.?express'
    else if (lower === 'debit card') pattern = 'debit'
    else if (lower === 'net banking') pattern = 'net.?bank|\\bnb\\b|internet.?bank'
    else if (lower === 'wallet') pattern = 'wallet|paytm|phonepe|amazon.?pay|mobikwik|paypal'
    else if (lower === 'cod') pattern = 'cod|cash.?on.?delivery'

    if (lower === 'other') {
      query.paymentMode = {
        $exists: true,
        $nin: [null, ''],
        $not: {
          $regex: /upi|credit|debit|net.?bank|wallet|cod|cash.?on.?delivery|card|visa|master/i,
        },
      }
    } else {
      query.paymentMode = { $regex: new RegExp(pattern, 'i') }
    }
  }

  // Date range on createdAt (always present). Inclusive end-of-day for toDate.
  const createdAt = {}
  if (fromDate) {
    const start = new Date(fromDate)
    if (!Number.isNaN(start.getTime())) {
      start.setHours(0, 0, 0, 0)
      createdAt.$gte = start
    }
  }
  if (toDate) {
    const end = new Date(toDate)
    if (!Number.isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999)
      createdAt.$lte = end
    }
  }
  if (Object.keys(createdAt).length) query.createdAt = createdAt

  return query
}

function resolveSort({ sort, sortBy, sortDir } = {}) {
  const key = String(sort || '').toLowerCase()
  if (key === 'latest') return { createdAt: -1 }
  if (key === 'oldest') return { createdAt: 1 }
  if (key === 'highest_amount' || key === 'highestamount') return { amount: -1 }
  if (key === 'lowest_amount' || key === 'lowestamount') return { amount: 1 }

  const allowed = { createdAt: 1, amount: 1, paymentDate: 1, orderStatus: 1, updatedAt: 1 }
  const field = allowed[sortBy] !== undefined ? sortBy : 'createdAt'
  return { [field]: sortDir === 'asc' ? 1 : -1 }
}

async function listTransactions(params = {}) {
  const page = Math.max(Number(params.page) || 1, 1)
  const limit = Math.min(Math.max(Number(params.limit) || 10, 1), 100)
  const query = buildListQuery(params)
  const sort = resolveSort(params)
  const skip = (page - 1) * limit

  const [items, total] = await Promise.all([
    PaymentTransaction.find(query)
      .populate('userId', 'name email phone')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    PaymentTransaction.countDocuments(query),
  ])

  return { items, total, page, limit }
}

async function getTransactionById(id) {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid transaction id', 400, 'INVALID_ID')
  }

  const txn = await PaymentTransaction.findOne({ _id: id, deletedAt: null })
    .populate('userId', 'name email phone')
    .populate('buyerId', 'name email phone')
    .populate('sellerId', 'name email phone')
    .populate('productId', 'title images videoScreenshots')
    .populate('packageId', 'packageName packageAmount')
    .populate('storagefacilitiesId', 'facilityWeek facilityAmount')
    .lean()

  if (!txn) throw new AppError('Transaction not found', 404, 'TRANSACTION_NOT_FOUND')

  const logs = await PaymentLog.find({ orderId: txn.orderId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean()

  return { txn, logs }
}

/**
 * Dashboard summary for the admin Transactions module.
 * Amount totals only successful (SUCCESS) payments.
 */
async function getTransactionStats(params = {}) {
  const match = buildListQuery({
    search: params.search,
    paymentStatus: undefined, // stats ignore status filter so cards stay global
    orderPlatform: params.orderPlatform,
    paymentMethod: params.paymentMethod,
    fromDate: params.fromDate,
    toDate: params.toDate,
  })
  // When listing is filtered by status we still want global cards — use only
  // soft-delete + optional platform/method/date filters above.
  delete match.orderStatus

  const [agg] = await PaymentTransaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalTransactions: { $sum: 1 },
        successfulTransactions: {
          $sum: { $cond: [{ $eq: ['$orderStatus', 'SUCCESS'] }, 1, 0] },
        },
        failedTransactions: {
          $sum: {
            $cond: [{ $in: ['$orderStatus', ['FAILED', 'CANCELLED']] }, 1, 0],
          },
        },
        pendingTransactions: {
          $sum: {
            $cond: [{ $in: ['$orderStatus', ['PENDING', 'INITIATED']] }, 1, 0],
          },
        },
        totalTransactionAmount: {
          $sum: {
            $cond: [{ $eq: ['$orderStatus', 'SUCCESS'] }, '$amount', 0],
          },
        },
      },
    },
  ])

  return {
    totalTransactions: agg?.totalTransactions || 0,
    successfulTransactions: agg?.successfulTransactions || 0,
    failedTransactions: agg?.failedTransactions || 0,
    pendingTransactions: agg?.pendingTransactions || 0,
    totalTransactionAmount: Math.round((Number(agg?.totalTransactionAmount || 0) + Number.EPSILON) * 100) / 100,
    currency: 'AED',
    paymentMethodOptions: PAYMENT_METHOD_OPTIONS,
  }
}

const EXPORT_MAX_ROWS = 10000

/**
 * Fetch transactions for Excel export using the same filters/sort as the list.
 * Requires fromDate + toDate. Caps at EXPORT_MAX_ROWS to keep memory/response size bounded.
 */
async function exportTransactions(params = {}) {
  if (!params.fromDate || !params.toDate) {
    throw new AppError('From date and To date are required for export', 400, 'DATE_RANGE_REQUIRED')
  }

  const from = new Date(params.fromDate)
  const to = new Date(params.toDate)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new AppError('Invalid from date or to date', 400, 'INVALID_DATE')
  }
  if (from.getTime() > to.getTime()) {
    throw new AppError('From date cannot be after To date', 400, 'INVALID_DATE_RANGE')
  }

  const query = buildListQuery(params)
  const sort = resolveSort(params)
  const limit = Math.min(Math.max(Number(params.limit) || EXPORT_MAX_ROWS, 1), EXPORT_MAX_ROWS)

  const [items, total] = await Promise.all([
    PaymentTransaction.find(query)
      .populate('userId', 'name email phone')
      .sort(sort)
      .limit(limit)
      .lean(),
    PaymentTransaction.countDocuments(query),
  ])

  return { items, total, truncated: total > items.length }
}

module.exports = {
  listTransactions,
  getTransactionById,
  getTransactionStats,
  exportTransactions,
  EXPORT_MAX_ROWS,
  normalizePaymentMethod,
  buildListQuery,
}
