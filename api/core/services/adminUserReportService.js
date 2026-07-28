const { Types } = require('mongoose')
const AppError = require('../errors/AppError')
const Report = require('../../models/Report')
const User = require('../../models/User')

const DEFAULT_REPORT_THRESHOLD = Math.max(
  1,
  Number(process.env.USER_REPORT_THRESHOLD) || 5
)

/** Normalize legacy `actioned` → `resolved` for admin UI. */
function normalizeStatus(status) {
  if (status === 'actioned') return 'resolved'
  return status || 'pending'
}

/** Worst-first aggregate status for a set of report statuses. */
function aggregateStatus(statuses = []) {
  const normalized = statuses.map(normalizeStatus)
  if (normalized.includes('pending')) return 'pending'
  if (normalized.includes('reviewed')) return 'reviewed'
  if (normalized.includes('resolved')) return 'resolved'
  if (normalized.includes('dismissed')) return 'dismissed'
  return 'pending'
}

function escapeRegex(value) {
  return String(value).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getReportThreshold(override) {
  const n = Number(override)
  if (Number.isFinite(n) && n >= 1) return Math.floor(n)
  return DEFAULT_REPORT_THRESHOLD
}

/**
 * Resolve user IDs matching search against name / email / ObjectId.
 */
async function findUserIdsBySearch(search) {
  const term = String(search || '').trim()
  if (!term) return null

  const or = [
    { name: new RegExp(escapeRegex(term), 'i') },
    { email: new RegExp(escapeRegex(term), 'i') },
    { displayName: new RegExp(escapeRegex(term), 'i') },
  ]
  if (Types.ObjectId.isValid(term) && String(new Types.ObjectId(term)) === term) {
    or.push({ _id: new Types.ObjectId(term) })
  }

  const users = await User.find({ $or: or }).select('_id').lean()
  return users.map((u) => u._id)
}

/**
 * Build a base $match for individual report documents.
 * Status is intentionally excluded here so grouped reportCount stays accurate;
 * aggregate status is filtered after $group.
 */
async function buildReportMatch({
  reason,
  dateFrom,
  dateTo,
  search,
} = {}) {
  const match = {}

  if (dateFrom || dateTo) {
    match.createdAt = {}
    if (dateFrom) {
      const from = new Date(dateFrom)
      if (!Number.isNaN(from.getTime())) match.createdAt.$gte = from
    }
    if (dateTo) {
      const to = new Date(dateTo)
      if (!Number.isNaN(to.getTime())) {
        // Inclusive end-of-day when date-only string
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(dateTo).trim())) {
          to.setHours(23, 59, 59, 999)
        }
        match.createdAt.$lte = to
      }
    }
    if (!Object.keys(match.createdAt).length) delete match.createdAt
  }

  if (reason && String(reason).trim() && reason !== 'all') {
    match.reason = new RegExp(`^${escapeRegex(reason)}$`, 'i')
  }

  if (search && String(search).trim()) {
    const userIds = await findUserIdsBySearch(search)
    if (!userIds || userIds.length === 0) {
      match._id = { $in: [] }
    } else {
      match.$or = [
        { reportedUser: { $in: userIds } },
        { reporter: { $in: userIds } },
      ]
    }
  }

  return match
}

function resolveGroupSort(sort) {
  const key = String(sort || 'latest').toLowerCase()
  if (key === 'oldest') return { latestReportAt: 1 }
  if (key === 'highest_count' || key === 'highestcount' || key === 'most_reported') {
    return { reportCount: -1, latestReportAt: -1 }
  }
  return { latestReportAt: -1 }
}

/**
 * Paginated list of reported users (grouped by reportedUser).
 */
async function listReportedUsers(params = {}) {
  const page = Math.max(Number(params.page) || 1, 1)
  const limit = Math.min(Math.max(Number(params.limit) || 10, 1), 100)
  const skip = (page - 1) * limit
  const minReports = Math.max(0, Number(params.minReports) || 0)
  const match = await buildReportMatch(params)
  const sort = resolveGroupSort(params.sort)

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: '$reportedUser',
        reportCount: { $sum: 1 },
        pendingCount: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
        },
        reviewedCount: {
          $sum: { $cond: [{ $eq: ['$status', 'reviewed'] }, 1, 0] },
        },
        resolvedCount: {
          $sum: {
            $cond: [{ $in: ['$status', ['resolved', 'actioned']] }, 1, 0],
          },
        },
        dismissedCount: {
          $sum: { $cond: [{ $eq: ['$status', 'dismissed'] }, 1, 0] },
        },
        statuses: { $addToSet: '$status' },
        reasons: { $addToSet: '$reason' },
        latestReportAt: { $max: '$createdAt' },
        oldestReportAt: { $min: '$createdAt' },
        latestReportId: { $max: '$_id' },
        reportIds: { $push: '$_id' },
      },
    },
  ]

  if (minReports > 0) {
    pipeline.push({ $match: { reportCount: { $gte: minReports } } })
  }

  // Keep groups whose aggregate status matches the requested filter.
  if (params.status && params.status !== 'all') {
    const s = String(params.status).toLowerCase()
    if (s === 'pending') {
      pipeline.push({ $match: { pendingCount: { $gt: 0 } } })
    } else if (s === 'reviewed') {
      pipeline.push({
        $match: { pendingCount: 0, reviewedCount: { $gt: 0 } },
      })
    } else if (s === 'resolved') {
      pipeline.push({
        $match: {
          pendingCount: 0,
          reviewedCount: 0,
          resolvedCount: { $gt: 0 },
        },
      })
    } else if (s === 'dismissed') {
      pipeline.push({
        $match: {
          pendingCount: 0,
          reviewedCount: 0,
          resolvedCount: 0,
          dismissedCount: { $gt: 0 },
        },
      })
    }
  }

  pipeline.push({
    $facet: {
      items: [{ $sort: sort }, { $skip: skip }, { $limit: limit }],
      meta: [{ $count: 'total' }],
    },
  })

  const [result] = await Report.aggregate(pipeline)
  const groups = result?.items || []
  const total = result?.meta?.[0]?.total || 0

  if (!groups.length) {
    return {
      items: [],
      total,
      page,
      limit,
      reportThreshold: getReportThreshold(params.threshold),
    }
  }

  const userIds = groups.map((g) => g._id).filter(Boolean)

  const [latestReports, users] = await Promise.all([
    Report.find({
      $or: groups.map((g) => ({
        reportedUser: g._id,
        createdAt: g.latestReportAt,
      })),
    })
      .populate('reporter', 'name email avatar displayName status')
      .lean(),
    User.find({ _id: { $in: userIds } })
      .select('name email avatar displayName status role phone createdAt')
      .lean(),
  ])

  // Prefer one latest report per user (ties broken by newest _id)
  const latestByUser = {}
  for (const r of latestReports) {
    const key = String(r.reportedUser)
    if (!latestByUser[key] || String(r._id) > String(latestByUser[key]._id)) {
      latestByUser[key] = r
    }
  }
  const userMap = Object.fromEntries(users.map((u) => [String(u._id), u]))

  const items = groups.map((g) => {
    const latest = latestByUser[String(g._id)] || null
    const reportedUser = userMap[String(g._id)] || null
    return {
      reportedUserId: g._id,
      reportedUser,
      reportCount: g.reportCount,
      pendingCount: g.pendingCount,
      reviewedCount: g.reviewedCount,
      resolvedCount: g.resolvedCount,
      dismissedCount: g.dismissedCount,
      status: aggregateStatus(g.statuses),
      reasons: Array.isArray(g.reasons) ? g.reasons.filter(Boolean) : [],
      latestReportAt: g.latestReportAt,
      oldestReportAt: g.oldestReportAt,
      latestReportId: latest?._id || g.latestReportId,
      latestReason: latest?.reason || null,
      latestDetails: latest?.details || '',
      latestReporter: latest?.reporter || null,
      reportIds: g.reportIds || [],
    }
  })

  return {
    items,
    total,
    page,
    limit,
    reportThreshold: getReportThreshold(params.threshold),
  }
}

/**
 * Detail view for all reports against a single user.
 */
async function getReportedUserDetail(userId) {
  if (!Types.ObjectId.isValid(userId)) {
    throw new AppError('Invalid user id', 400, 'INVALID_ID')
  }

  const reportedUser = await User.findById(userId)
    .select(
      'name email avatar displayName status role phone createdAt isVerified identityVerified gender dob'
    )
    .lean()

  if (!reportedUser) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND')
  }

  const reports = await Report.find({ reportedUser: userId })
    .populate('reporter', 'name email avatar displayName status')
    .populate('resolvedBy', 'name email')
    .populate('chat', 'type updatedAt')
    .sort({ createdAt: -1 })
    .lean()

  const statuses = reports.map((r) => r.status)
  const reasons = [...new Set(reports.map((r) => r.reason).filter(Boolean))]

  const counts = {
    total: reports.length,
    pending: reports.filter((r) => normalizeStatus(r.status) === 'pending').length,
    reviewed: reports.filter((r) => normalizeStatus(r.status) === 'reviewed').length,
    resolved: reports.filter((r) => normalizeStatus(r.status) === 'resolved').length,
    dismissed: reports.filter((r) => normalizeStatus(r.status) === 'dismissed').length,
  }

  return {
    reportedUser,
    reports,
    reasons,
    status: aggregateStatus(statuses),
    counts,
    latestReportAt: reports[0]?.createdAt || null,
    reportThreshold: DEFAULT_REPORT_THRESHOLD,
  }
}

/**
 * Dashboard summary cards for the User Reports module.
 */
async function getReportStats() {
  const [statusAgg, reportedUsersCount, mostReported] = await Promise.all([
    Report.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),
    Report.distinct('reportedUser').then((ids) => ids.length),
    Report.aggregate([
      {
        $group: {
          _id: '$reportedUser',
          reportCount: { $sum: 1 },
        },
      },
      { $sort: { reportCount: -1 } },
      { $limit: 1 },
    ]),
  ])

  const counts = { pending: 0, reviewed: 0, resolved: 0, dismissed: 0 }
  for (const row of statusAgg || []) {
    const key = normalizeStatus(row._id)
    if (counts[key] !== undefined) counts[key] += row.count
  }

  const totalReports =
    counts.pending + counts.reviewed + counts.resolved + counts.dismissed

  return {
    totalUserReports: totalReports,
    pendingReports: counts.pending,
    reviewedReports: counts.reviewed,
    resolvedReports: counts.resolved + counts.dismissed,
    totalReportedUsers: reportedUsersCount,
    mostReportedCount: mostReported?.[0]?.reportCount || 0,
    mostReportedUserId: mostReported?.[0]?._id || null,
    reportThreshold: DEFAULT_REPORT_THRESHOLD,
  }
}

/**
 * Top reported users for the highlight section.
 */
async function getMostReportedUsers(params = {}) {
  const limit = Math.min(Math.max(Number(params.limit) || 5, 1), 20)
  const threshold = getReportThreshold(params.threshold)

  const groups = await Report.aggregate([
    {
      $group: {
        _id: '$reportedUser',
        reportCount: { $sum: 1 },
        pendingCount: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
        },
        statuses: { $addToSet: '$status' },
        reasons: { $addToSet: '$reason' },
        latestReportAt: { $max: '$createdAt' },
      },
    },
    { $sort: { reportCount: -1, latestReportAt: -1 } },
    { $limit: limit },
  ])

  if (!groups.length) {
    return { items: [], reportThreshold: threshold }
  }

  const users = await User.find({ _id: { $in: groups.map((g) => g._id) } })
    .select('name email avatar displayName status role')
    .lean()
  const userMap = Object.fromEntries(users.map((u) => [String(u._id), u]))

  const items = groups.map((g) => ({
    reportedUserId: g._id,
    reportedUser: userMap[String(g._id)] || null,
    reportCount: g.reportCount,
    pendingCount: g.pendingCount,
    status: aggregateStatus(g.statuses),
    reasons: Array.isArray(g.reasons) ? g.reasons.filter(Boolean) : [],
    latestReportAt: g.latestReportAt,
    exceedsThreshold: g.reportCount >= threshold,
  }))

  return { items, reportThreshold: threshold }
}

/**
 * Distinct report reasons for filter dropdowns.
 */
async function getReportReasons() {
  const reasons = await Report.distinct('reason')
  return (reasons || []).filter(Boolean).sort((a, b) => a.localeCompare(b))
}

const ACTION_STATUS_MAP = {
  review: 'reviewed',
  resolve: 'resolved',
  dismiss: 'dismissed',
}

/**
 * Apply an admin action to reports for a user.
 * action: review | resolve | dismiss | block
 */
async function applyUserReportAction({
  userId,
  action,
  adminId,
  reportIds,
  adminNotes,
  blockUser = false,
} = {}) {
  if (!Types.ObjectId.isValid(userId)) {
    throw new AppError('Invalid user id', 400, 'INVALID_ID')
  }

  const normalizedAction = String(action || '').toLowerCase()
  const shouldBlock = normalizedAction === 'block' || blockUser === true

  if (!['review', 'resolve', 'dismiss', 'block'].includes(normalizedAction) && !shouldBlock) {
    throw new AppError(
      'Valid action required: review, resolve, dismiss, or block',
      400,
      'INVALID_ACTION'
    )
  }

  const user = await User.findById(userId)
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND')

  const targetStatus = shouldBlock
    ? 'resolved'
    : ACTION_STATUS_MAP[normalizedAction]

  const filter = { reportedUser: userId }
  if (Array.isArray(reportIds) && reportIds.length) {
    const validIds = reportIds.filter((id) => Types.ObjectId.isValid(id))
    filter._id = { $in: validIds }
  } else if (normalizedAction === 'review') {
    filter.status = 'pending'
  } else {
    filter.status = { $in: ['pending', 'reviewed'] }
  }

  const update = {
    status: targetStatus,
    resolvedAt: new Date(),
    resolvedBy: adminId || null,
  }
  if (adminNotes != null && String(adminNotes).trim()) {
    update.adminNotes = String(adminNotes).trim()
  }

  const result = await Report.updateMany(filter, { $set: update })

  let blocked = false
  if (shouldBlock) {
    if (adminId && String(adminId) === String(userId)) {
      throw new AppError('You cannot block your own account', 400, 'CANNOT_BLOCK_SELF')
    }
    user.status = 'inactive'
    await user.save()
    blocked = true
  }

  return {
    modifiedCount: result.modifiedCount || 0,
    matchedCount: result.matchedCount || 0,
    status: targetStatus,
    blocked,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      status: user.status,
    },
  }
}

module.exports = {
  listReportedUsers,
  getReportedUserDetail,
  getReportStats,
  getMostReportedUsers,
  getReportReasons,
  applyUserReportAction,
  normalizeStatus,
  aggregateStatus,
  DEFAULT_REPORT_THRESHOLD,
  getReportThreshold,
}
