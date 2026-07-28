/**
 * Admin-facing DTOs for user reports (grouped by reported user).
 */

function normalizeStatus(status) {
  if (status === 'actioned') return 'resolved'
  return status || 'pending'
}

function toUserBrief(value) {
  if (!value) return null
  if (typeof value === 'object' && (value.name || value.email || value.avatar || value._id)) {
    return {
      id: String(value._id),
      name: value.name || value.displayName || null,
      displayName: value.displayName || null,
      email: value.email || null,
      avatar: value.avatar || null,
      status: value.status || null,
      role: value.role || null,
      phone: value.phone || null,
      createdAt: value.createdAt || null,
      isVerified: value.isVerified ?? null,
      identityVerified: value.identityVerified ?? null,
    }
  }
  return value ? { id: String(value._id || value), name: null, email: null, avatar: null, status: null } : null
}

function statusLabel(status) {
  const s = normalizeStatus(status)
  const map = {
    pending: 'Pending',
    reviewed: 'Reviewed',
    resolved: 'Resolved',
    dismissed: 'Dismissed',
  }
  return map[s] || String(status || 'Pending')
}

function statusBadge(status) {
  const s = normalizeStatus(status)
  if (s === 'resolved') return 'resolved'
  if (s === 'dismissed') return 'dismissed'
  if (s === 'reviewed') return 'reviewed'
  return s || 'pending'
}

function formatDate(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function truncateId(id, head = 6, tail = 4) {
  const s = String(id || '')
  if (s.length <= head + tail + 1) return s
  return `${s.slice(0, head)}…${s.slice(-tail)}`
}

function toReportedUserListItem(row, reportThreshold) {
  const reported = toUserBrief(row.reportedUser)
  const reporter = toUserBrief(row.latestReporter)
  const count = Number(row.reportCount || 0)
  const threshold = Number(reportThreshold) || 5

  return {
    id: String(row.reportedUserId || row.reportedUser?._id || ''),
    reportId: row.latestReportId ? String(row.latestReportId) : null,
    reportIdShort: row.latestReportId ? truncateId(row.latestReportId) : null,
    reportedUser: reported,
    reportedBy: reporter,
    reportReason: row.latestReason || (row.reasons && row.reasons[0]) || null,
    reasons: Array.isArray(row.reasons) ? row.reasons : [],
    description: row.latestDetails || '',
    reportCount: count,
    pendingCount: Number(row.pendingCount || 0),
    latestReportDate: formatDate(row.latestReportAt),
    oldestReportDate: formatDate(row.oldestReportAt),
    status: normalizeStatus(row.status),
    statusLabel: statusLabel(row.status),
    statusBadge: statusBadge(row.status),
    exceedsThreshold: count >= threshold,
    accountStatus: reported?.status || null,
  }
}

function toReportedUserListResponse(result) {
  const threshold = result.reportThreshold
  return {
    items: (result.items || []).map((row) => toReportedUserListItem(row, threshold)),
    page: result.page,
    limit: result.limit,
    total: result.total,
    hasMore: result.page * result.limit < result.total,
    reportThreshold: threshold,
  }
}

function toReportHistoryItem(report) {
  return {
    id: String(report._id),
    reason: report.reason || null,
    details: report.details || '',
    status: normalizeStatus(report.status),
    statusLabel: statusLabel(report.status),
    statusBadge: statusBadge(report.status),
    createdAt: formatDate(report.createdAt),
    updatedAt: formatDate(report.updatedAt),
    resolvedAt: formatDate(report.resolvedAt),
    adminNotes: report.adminNotes || '',
    reporter: toUserBrief(report.reporter),
    resolvedBy: report.resolvedBy
      ? {
          id: String(report.resolvedBy._id || report.resolvedBy),
          name: report.resolvedBy.name || null,
          email: report.resolvedBy.email || null,
        }
      : null,
    chatId: report.chat?._id ? String(report.chat._id) : report.chat ? String(report.chat) : null,
  }
}

function toReportedUserDetailDto(detail) {
  const reported = toUserBrief(detail.reportedUser)
  const count = Number(detail.counts?.total || 0)
  const threshold = detail.reportThreshold || 5

  return {
    reportedUser: reported,
    status: normalizeStatus(detail.status),
    statusLabel: statusLabel(detail.status),
    statusBadge: statusBadge(detail.status),
    counts: detail.counts || {
      total: 0,
      pending: 0,
      reviewed: 0,
      resolved: 0,
      dismissed: 0,
    },
    reasons: Array.isArray(detail.reasons) ? detail.reasons : [],
    latestReportDate: formatDate(detail.latestReportAt),
    exceedsThreshold: count >= threshold,
    reportThreshold: threshold,
    reports: (detail.reports || []).map(toReportHistoryItem),
  }
}

function toReportStatsDto(stats) {
  return {
    totalUserReports: stats.totalUserReports || 0,
    pendingReports: stats.pendingReports || 0,
    reviewedReports: stats.reviewedReports || 0,
    resolvedReports: stats.resolvedReports || 0,
    totalReportedUsers: stats.totalReportedUsers || 0,
    mostReportedUsers: stats.mostReportedCount || 0,
    mostReportedUserId: stats.mostReportedUserId
      ? String(stats.mostReportedUserId)
      : null,
    reportThreshold: stats.reportThreshold || 5,
  }
}

function toMostReportedResponse(result) {
  const threshold = result.reportThreshold
  return {
    items: (result.items || []).map((row) => {
      const reported = toUserBrief(row.reportedUser)
      return {
        id: String(row.reportedUserId || ''),
        reportedUser: reported,
        reportCount: Number(row.reportCount || 0),
        pendingCount: Number(row.pendingCount || 0),
        status: normalizeStatus(row.status),
        statusLabel: statusLabel(row.status),
        statusBadge: statusBadge(row.status),
        reasons: Array.isArray(row.reasons) ? row.reasons : [],
        latestReportDate: formatDate(row.latestReportAt),
        accountStatus: reported?.status || null,
        exceedsThreshold: Boolean(row.exceedsThreshold),
      }
    }),
    reportThreshold: threshold,
  }
}

module.exports = {
  toReportedUserListResponse,
  toReportedUserDetailDto,
  toReportStatsDto,
  toMostReportedResponse,
  toUserBrief,
  statusLabel,
  statusBadge,
}
