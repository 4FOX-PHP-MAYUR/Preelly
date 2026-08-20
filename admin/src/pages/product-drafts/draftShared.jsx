import React from 'react'
import { StatusBadge } from '../../components/AdminUI'

export const LIST_PATH = '/product-drafts'

export const DRAFT_STATUSES = ['draft', 'published', 'discarded']

/**
 * `productDraft.status` has its own vocabulary, so map it onto the shared
 * StatusBadge palette rather than adding a new variant to that component.
 */
const STATUS_BADGE = {
  draft: { status: 'draft', label: 'Draft' },
  published: { status: 'approved', label: 'Published' },
  discarded: { status: 'cancelled', label: 'Discarded' },
}

export function DraftStatusBadge({ status }) {
  const mapped = STATUS_BADGE[String(status || '').toLowerCase()] || {
    status: 'inactive',
    label: status || 'Unknown',
  }
  return <StatusBadge status={mapped.status} label={mapped.label} />
}

export const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft (in progress)' },
  { value: 'published', label: 'Published' },
  { value: 'discarded', label: 'Discarded' },
]

export const STATUS_FORM_OPTIONS = [
  { value: 'draft', label: 'Draft (in progress)' },
  { value: 'published', label: 'Published' },
  { value: 'discarded', label: 'Discarded' },
]

/** Wizard steps the Post Your Ad flow exposes; used for the step filter/form. */
export const STEP_OPTIONS = [1, 2, 3, 4, 5, 6]

export function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDateOnly(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatBytes(bytes) {
  if (bytes === null || bytes === undefined || Number.isNaN(Number(bytes))) return '—'
  const size = Number(bytes)
  if (size <= 0) return '0 KB'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(size) / Math.log(1024)))
  const value = size / 1024 ** exponent
  return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`
}

export function userLabel(user) {
  if (!user) return 'Unknown user'
  return user.name || user.email || user.id || 'Unknown user'
}

export function draftLabel(draft) {
  if (!draft) return 'Draft'
  return draft.title?.trim() || `Untitled draft (${userLabel(draft.user)})`
}
