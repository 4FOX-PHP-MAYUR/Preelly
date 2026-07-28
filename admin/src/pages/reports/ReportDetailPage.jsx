import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { adminService } from '@/services/api'
import { selectPermissions } from '@shared/store/slices/authSlice'
import { getMediaUrl } from '@shared/utils/helpers'
import {
  AdminPage,
  PageHeader,
  Panel,
  Button,
  StatusBadge,
  FormSection,
  Card,
} from '../../components/AdminUI'
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Clock3,
  Flag,
  ShieldCheck,
  XCircle,
  AlertTriangle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  formatDateTime,
  truncateId,
  displayName,
} from './reportConstants'

const LIST_PATH = '/reports'

function Field({ label, children, className = '' }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <div className="mt-0.5 text-sm font-medium text-slate-900 dark:text-white break-words">
        {children ?? '—'}
      </div>
    </div>
  )
}

function SectionGrid({ children }) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </div>
  )
}

function canEditReports(permissions) {
  if (!permissions) return true
  const mod = permissions.Reports || permissions.Users
  if (!mod) return false
  return !!(mod.can_edit || mod.can_delete)
}

function ReportDetailPage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const permissions = useSelector(selectPermissions)
  const allowActions = canEditReports(permissions)

  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await adminService.getUserReportByUserId(userId)
      setDetail(res.data)
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to load report details'
      setError(message)
      toast.error(message)
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const runAction = async (action) => {
    if (!allowActions) {
      toast.error('You do not have permission to moderate reports')
      return
    }
    if (action === 'block') {
      const name = displayName(detail?.reportedUser)
      if (!window.confirm(`Block ${name}? Their account will be set inactive and open reports will be resolved.`)) {
        return
      }
    }
    try {
      setActionLoading(action)
      const res = await adminService.resolveUserReport(userId, { action })
      toast.success(res.data?.message || 'Action completed')
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to apply action')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <AdminPage>
        <p className="text-sm text-slate-500">Loading report details…</p>
      </AdminPage>
    )
  }

  if (error || !detail) {
    return (
      <AdminPage>
        <PageHeader
          title="User Report"
          action={
            <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate(LIST_PATH)}>
              Back to list
            </Button>
          }
        />
        <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 px-4 py-6 text-center">
          <p className="text-sm font-medium text-red-700 dark:text-red-300">
            {error || 'Report details not found'}
          </p>
          <Button variant="secondary" className="mt-3 w-full sm:w-auto" onClick={() => navigate(LIST_PATH)}>
            Return to reports
          </Button>
        </div>
      </AdminPage>
    )
  }

  const user = detail.reportedUser
  const avatarUrl = user?.avatar ? getMediaUrl(user.avatar) || user.avatar : null
  const counts = detail.counts || {}
  const openReports = (counts.pending || 0) + (counts.reviewed || 0)

  return (
    <AdminPage>
      <PageHeader
        title={displayName(user)}
        subtitle="Reported user"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate(LIST_PATH)}>
              Back to list
            </Button>
            {user?.id && (
              <Button variant="secondary" onClick={() => navigate(`/users/${user.id}`)}>
                View profile
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <Card title="Total Reports" value={counts.total || 0} icon={Flag} />
        <Card title="Pending" value={counts.pending || 0} icon={Clock3} accent="yellow" />
        <Card title="Reviewed" value={counts.reviewed || 0} icon={ShieldCheck} accent="purple" />
        <Card title="Resolved" value={(counts.resolved || 0) + (counts.dismissed || 0)} icon={CheckCircle2} accent="green" />
      </div>

      <Panel className="mb-4 sm:mb-6">
        <div className="flex flex-col lg:flex-row gap-4 lg:items-start lg:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-14 w-14 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0 flex items-center justify-center text-lg font-semibold text-slate-600 dark:text-slate-300">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                displayName(user).charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white truncate">
                  {displayName(user)}
                </h2>
                <StatusBadge status={detail.statusBadge || detail.status} label={detail.statusLabel} />
                {detail.exceedsThreshold && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 px-2 py-0.5 text-xs font-medium">
                    <AlertTriangle className="h-3 w-3" />
                    Above threshold ({detail.reportThreshold}+)
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 break-all">{user?.email || '—'}</p>
            </div>
          </div>

          {allowActions && openReports > 0 && (
            <div className="flex flex-wrap gap-2 shrink-0">
              {counts.pending > 0 && (
                <Button
                  variant="secondary"
                  icon={ShieldCheck}
                  loading={actionLoading === 'review'}
                  disabled={!!actionLoading}
                  onClick={() => runAction('review')}
                >
                  Mark Reviewed
                </Button>
              )}
              <Button
                variant="secondary"
                icon={CheckCircle2}
                loading={actionLoading === 'resolve'}
                disabled={!!actionLoading}
                onClick={() => runAction('resolve')}
              >
                Resolve
              </Button>
              <Button
                variant="secondary"
                icon={XCircle}
                loading={actionLoading === 'dismiss'}
                disabled={!!actionLoading}
                onClick={() => runAction('dismiss')}
              >
                Dismiss
              </Button>
              {user?.status !== 'inactive' && (
                <Button
                  variant="danger"
                  icon={Ban}
                  loading={actionLoading === 'block'}
                  disabled={!!actionLoading}
                  onClick={() => runAction('block')}
                >
                  Block User
                </Button>
              )}
            </div>
          )}
        </div>
      </Panel>

      <Panel className="mb-4 sm:mb-6">
        <div className="space-y-6 sm:space-y-8">
          <FormSection title="User Information">
            <SectionGrid>
              <Field label="Name">{user?.name || '—'}</Field>
              <Field label="Display Name">{user?.displayName || '—'}</Field>
              <Field label="Email" className="sm:col-span-2 lg:col-span-1">
                <span className="break-all">{user?.email || '—'}</span>
              </Field>
              <Field label="Phone">{user?.phone || '—'}</Field>
              <Field label="Role">{user?.role || '—'}</Field>
              <Field label="Account Status">
                <StatusBadge
                  status={user?.status === 'inactive' ? 'inactive' : 'active'}
                  label={user?.status === 'inactive' ? 'Blocked / Inactive' : 'Active'}
                />
              </Field>
              <Field label="Member Since">{formatDateTime(user?.createdAt)}</Field>
              <Field label="Latest Report">{formatDateTime(detail.latestReportDate)}</Field>
            </SectionGrid>
          </FormSection>

          <FormSection title="Report Summary">
            <SectionGrid>
              <Field label="Aggregate Status">
                <StatusBadge status={detail.statusBadge || detail.status} label={detail.statusLabel} />
              </Field>
              <Field label="All Reasons">
                {(detail.reasons || []).length
                  ? detail.reasons.join(', ')
                  : '—'}
              </Field>
              <Field label="Total Reports Received">{counts.total || 0}</Field>
            </SectionGrid>
          </FormSection>
        </div>
      </Panel>

      <Panel>
        <FormSection title="Report History">
          {(detail.reports || []).length === 0 ? (
            <p className="text-sm text-slate-500">No reports found for this user.</p>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800 -mx-1">
              {detail.reports.map((report) => (
                <div key={report.id} className="py-4 px-1 first:pt-0 last:pb-0">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-slate-500" title={report.id}>
                          {truncateId(report.id)}
                        </span>
                        <StatusBadge status={report.statusBadge || report.status} label={report.statusLabel} />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {report.reason || 'No reason'}
                        </span>
                      </div>
                      {report.details ? (
                        <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                          {report.details}
                        </p>
                      ) : (
                        <p className="text-sm text-slate-400 italic">No description provided</p>
                      )}
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Reported by{' '}
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {displayName(report.reporter)}
                        </span>
                        {report.reporter?.email ? ` · ${report.reporter.email}` : ''}
                        {' · '}
                        {formatDateTime(report.createdAt)}
                      </p>
                      {report.resolvedAt && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Closed {formatDateTime(report.resolvedAt)}
                          {report.resolvedBy?.name ? ` by ${report.resolvedBy.name}` : ''}
                          {report.adminNotes ? ` · ${report.adminNotes}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </FormSection>
      </Panel>
    </AdminPage>
  )
}

export default ReportDetailPage
