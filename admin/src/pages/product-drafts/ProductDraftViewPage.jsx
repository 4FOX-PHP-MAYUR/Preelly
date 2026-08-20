import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { adminService } from '@/services/api'
import {
  AdminPage,
  PageHeader,
  Panel,
  Button,
  FormSection,
  LoadingSpinner,
  EmptyState,
  StatusBadge,
} from '../../components/AdminUI'
import { ArrowLeft, Pencil, Trash2, Archive, ImageIcon, Video, ExternalLink, FileQuestion } from 'lucide-react'
import toast from 'react-hot-toast'
import { usePermission } from '../../hooks/usePermission'
import {
  LIST_PATH,
  DraftStatusBadge,
  formatDateTime,
  formatBytes,
  userLabel,
  draftLabel,
} from './draftShared'

const MODULE = 'Product Drafts'

function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <div className="mt-0.5 text-sm font-medium text-slate-900 dark:text-white break-words">
        {children ?? '—'}
      </div>
    </div>
  )
}

/** A resolved reference the API annotated with a human name. */
function RefChip({ value }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-200">
      {value.name || value.id}
    </span>
  )
}

/**
 * Renders any value the wizard may have stored — scalars, resolved category
 * references, nested option objects and arrays — as readable markup instead of
 * a JSON dump.
 */
function DynamicValue({ value, depth = 0 }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-slate-400">—</span>
  }

  if (typeof value === 'boolean') {
    return <span>{value ? 'Yes' : 'No'}</span>
  }

  if (typeof value === 'number' || typeof value === 'string') {
    return <span className="whitespace-pre-wrap">{String(value)}</span>
  }

  if (Array.isArray(value)) {
    if (!value.length) return <span className="text-slate-400">Empty list</span>
    const allSimple = value.every(
      (item) => item === null || ['string', 'number', 'boolean'].includes(typeof item) || item?.__ref
    )
    if (allSimple) {
      return (
        <div className="flex flex-wrap gap-1.5">
          {value.map((item, i) =>
            item?.__ref ? (
              <RefChip key={`${item.id}-${i}`} value={item} />
            ) : (
              <span
                key={`${String(item)}-${i}`}
                className="inline-flex rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                {item === null ? '—' : String(item)}
              </span>
            )
          )}
        </div>
      )
    }
    return (
      <ul className="space-y-1.5">
        {value.map((item, i) => (
          <li key={i} className="rounded-lg border border-slate-200 dark:border-slate-800 p-2">
            <DynamicValue value={item} depth={depth + 1} />
          </li>
        ))}
      </ul>
    )
  }

  if (typeof value === 'object') {
    if (value.__ref) return <RefChip value={value} />

    const entries = Object.entries(value)
    if (!entries.length) return <span className="text-slate-400">—</span>
    return (
      <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {entries.map(([key, nested]) => (
          <div key={key} className="min-w-0">
            <dt className="text-xs text-slate-500 dark:text-slate-400">{humanize(key)}</dt>
            <dd className="text-sm text-slate-800 dark:text-slate-200">
              <DynamicValue value={nested} depth={depth + 1} />
            </dd>
          </div>
        ))}
      </dl>
    )
  }

  return <span className="text-slate-400">—</span>
}

function humanize(key) {
  const label = String(key || '')
    .replace(/^_+/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .trim()
  if (!label) return String(key)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function FieldEntryGrid({ fields }) {
  if (!fields?.length) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No values saved yet.</p>
  }
  return (
    <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {fields.map((field) => (
        <div key={field.key} className="min-w-0">
          <dt className="text-xs text-slate-500 dark:text-slate-400">{field.label}</dt>
          <dd className="mt-0.5 text-sm text-slate-900 dark:text-white">
            <DynamicValue value={field.value} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

function ProductDraftViewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { canEdit, canDelete } = usePermission(MODULE)
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [busy, setBusy] = useState(false)
  const [showInternal, setShowInternal] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await adminService.getProductDraftById(id)
      setDraft(res.data)
      setNotFound(false)
    } catch (err) {
      if (err.code === 'ERR_CANCELED') return
      if (err.response?.status === 404 || err.response?.status === 400) {
        setNotFound(true)
      } else {
        toast.error(err.response?.data?.message || 'Failed to load draft')
        navigate(LIST_PATH)
      }
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => {
    load()
  }, [load])

  const handleDiscard = async () => {
    if (
      !window.confirm(
        `Discard "${draftLabel(draft)}"? The record is kept with status "Discarded" and disappears from the seller’s Post Your Ad flow.`
      )
    ) {
      return
    }
    try {
      setBusy(true)
      await adminService.deleteProductDraft(id, { soft: true })
      toast.success('Draft discarded')
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to discard draft')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (
      !window.confirm(
        `Permanently delete "${draftLabel(draft)}"? This removes the record from the database and cannot be undone.`
      )
    ) {
      return
    }
    try {
      setBusy(true)
      await adminService.deleteProductDraft(id)
      toast.success('Draft deleted')
      navigate(LIST_PATH)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete draft')
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <AdminPage>
        <Panel>
          <LoadingSpinner message="Loading draft…" />
        </Panel>
      </AdminPage>
    )
  }

  if (notFound) {
    return (
      <AdminPage>
        <Panel>
          <EmptyState
            icon={FileQuestion}
            title="Draft not found"
            description="This draft no longer exists — it may have been deleted or published."
            action={
              <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate(LIST_PATH)}>
                Back to list
              </Button>
            }
          />
        </Panel>
      </AdminPage>
    )
  }

  if (!draft) return null

  const internalCount = (draft.formInternalFields?.length || 0) + (draft.dynamicInternalFields?.length || 0)

  return (
    <AdminPage>
      <PageHeader
        title={draft.title?.trim() || 'Untitled draft'}
        subtitle={`${userLabel(draft.user)} · step ${draft.currentStep}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate(LIST_PATH)}>
              Back to list
            </Button>
            {canEdit ? (
              <Button icon={Pencil} onClick={() => navigate(`${LIST_PATH}/${draft.id}/edit`)}>
                Edit
              </Button>
            ) : null}
            {canDelete && draft.status !== 'discarded' ? (
              <Button variant="secondary" icon={Archive} onClick={handleDiscard} loading={busy}>
                Discard
              </Button>
            ) : null}
            {canDelete ? (
              <Button variant="danger" icon={Trash2} onClick={handleDelete} loading={busy}>
                Delete
              </Button>
            ) : null}
          </div>
        }
      />

      <Panel>
        <div className="space-y-6">
          <FormSection title="Overview">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Field label="Status"><DraftStatusBadge status={draft.status} /></Field>
              <Field label="Draft ID"><span className="font-mono text-xs">{draft.id}</span></Field>
              <Field label="Current Step">{draft.currentStep}</Field>
              <Field label="Last Saved Step">{draft.lastSavedStep ?? '—'}</Field>
              <Field label="Seller">
                <div className="min-w-0">
                  <p className="truncate">{userLabel(draft.user)}</p>
                  {draft.user?.email ? (
                    <p className="truncate text-xs font-normal text-slate-500 dark:text-slate-400">
                      {draft.user.email}
                    </p>
                  ) : null}
                  {draft.user?.phone ? (
                    <p className="truncate text-xs font-normal text-slate-500 dark:text-slate-400">
                      {draft.user.phone}
                    </p>
                  ) : null}
                </div>
              </Field>
              <Field label="Category Level">{draft.categoryLevel}</Field>
              <Field label="Created">{formatDateTime(draft.createdAt)}</Field>
              <Field label="Last Updated">{formatDateTime(draft.updatedAt)}</Field>
              <Field label="Last Saved">{formatDateTime(draft.lastSavedAt)}</Field>
              <Field label="Published">{draft.publishedAt ? formatDateTime(draft.publishedAt) : '—'}</Field>
              <Field label="Description" className="sm:col-span-2 xl:col-span-4">
                {draft.description ? (
                  <span className="whitespace-pre-wrap font-normal">{draft.description}</span>
                ) : null}
              </Field>
            </div>
          </FormSection>

          <FormSection title="Category">
            {draft.categoryPath?.length ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {draft.categoryPath.map((cat, index) => (
                  <React.Fragment key={cat.id}>
                    {index > 0 ? <span className="text-slate-400">›</span> : null}
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-200">
                      {cat.name || cat.id}
                      {cat.level !== null && cat.level !== undefined ? (
                        <span className="text-slate-400">L{cat.level}</span>
                      ) : null}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">No category selected yet.</p>
            )}
          </FormSection>

          <FormSection title="Media">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
                  <Video className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  Video
                </p>
                {draft.media?.hasVideo && draft.media?.video ? (
                  <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-300">
                    <li>Name: {draft.media.video.name || '—'}</li>
                    <li>Size: {formatBytes(draft.media.video.size)}</li>
                    <li>Type: {draft.media.video.type || '—'}</li>
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No video uploaded.</p>
                )}
              </div>
              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
                  <ImageIcon className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  Photos ({draft.media?.imageCount || 0})
                </p>
                {draft.media?.images?.length ? (
                  <div className="mt-2 overflow-x-auto">
                    <table className="admin-table min-w-full text-sm">
                      <thead>
                        <tr>
                          <th className="text-left">File</th>
                          <th className="text-left">Size</th>
                          <th className="text-left">Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {draft.media.images.map((img, index) => (
                          <tr key={`${img.name}-${index}`}>
                            <td className="max-w-[220px] truncate">{img.name || '—'}</td>
                            <td>{formatBytes(img.size)}</td>
                            <td>
                              {img.isScreenshot ? (
                                <StatusBadge status="reviewed" label="Video frame" showDot={false} />
                              ) : (
                                <StatusBadge status="active" label="Upload" showDot={false} />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No photos added.</p>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Photo and video files stay in the seller’s browser storage while the ad is in progress — only
              this metadata is saved server-side.
            </p>
          </FormSection>

          <FormSection title="Form Values">
            <FieldEntryGrid fields={draft.formFields} />
          </FormSection>

          <FormSection title="Category Form Values">
            <FieldEntryGrid fields={draft.dynamicFields} />
          </FormSection>

          {draft.product ? (
            <FormSection title="Published Listing">
              <div className="flex flex-wrap items-center gap-4">
                <Field label="Title">{draft.product.title || '—'}</Field>
                <Field label="Status">
                  {draft.product.status ? <StatusBadge status={draft.product.status} /> : '—'}
                </Field>
                <Button
                  variant="secondary"
                  icon={ExternalLink}
                  onClick={() => navigate(`/products/${draft.product.id}`)}
                >
                  Open listing
                </Button>
              </div>
            </FormSection>
          ) : null}

          {internalCount > 0 ? (
            <FormSection title="Wizard Internals">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {internalCount} internal field(s) written by the AI/autofill steps.
              </p>
              <Button variant="secondary" onClick={() => setShowInternal((prev) => !prev)}>
                {showInternal ? 'Hide internal fields' : 'Show internal fields'}
              </Button>
              {showInternal ? (
                <div className="space-y-6 pt-2">
                  <FieldEntryGrid fields={draft.formInternalFields} />
                  <FieldEntryGrid fields={draft.dynamicInternalFields} />
                </div>
              ) : null}
            </FormSection>
          ) : null}
        </div>
      </Panel>
    </AdminPage>
  )
}

export default ProductDraftViewPage
