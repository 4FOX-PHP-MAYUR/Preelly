import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { adminService } from '@/services/api'
import { getMediaUrl } from '@shared/utils/helpers'
import {
  AdminPage,
  PageHeader,
  Panel,
  Button,
  StatusBadge,
  FormSection,
} from '../../components/AdminUI'
import { ArrowLeft, Pencil, ImageOff } from 'lucide-react'
import toast from 'react-hot-toast'

const LIST_PATH = '/pages'

function Field({ label, children }) {
  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-900 dark:text-white">{children ?? '—'}</p>
    </div>
  )
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

function PageViewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [page, setPage] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await adminService.getPageById(id)
        if (!cancelled) setPage(res.data)
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load page')
        navigate(LIST_PATH)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, navigate])

  if (loading) {
    return (
      <AdminPage>
        <p className="text-sm text-slate-500">Loading…</p>
      </AdminPage>
    )
  }
  if (!page) return null

  return (
    <AdminPage>
      <PageHeader
        title={page.pageTitle}
        subtitle={`/${page.pageSlug}`}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate(LIST_PATH)}>
              Back to list
            </Button>
            <Button icon={Pencil} onClick={() => navigate(`${LIST_PATH}/${page.id}/edit`)}>
              Edit
            </Button>
          </div>
        }
      />

      <Panel>
        <div className="space-y-6">
          <FormSection title="Overview">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-3 flex items-center gap-4">
                {page.pageBannerImage ? (
                  <img
                    src={getMediaUrl(page.pageBannerImage) || page.pageBannerImage}
                    alt={page.pageTitle}
                    className="h-24 w-40 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                  />
                ) : (
                  <div className="h-24 w-40 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400">
                    <ImageOff className="h-6 w-6" aria-hidden="true" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{page.heading}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">/{page.pageSlug}</p>
                </div>
              </div>
              <Field label="Status"><StatusBadge status={page.status ? 'active' : 'inactive'} /></Field>
              <Field label="Display Order">{page.displayOrder ?? 0}</Field>
              <div className="sm:col-span-3">
                <Field label="Description">
                  <div
                    className="admin-richtext-content max-w-none font-normal"
                    dangerouslySetInnerHTML={{ __html: page.description || '' }}
                  />
                </Field>
              </div>
            </div>
          </FormSection>

          <FormSection title="SEO Metadata">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Meta Title">{page.metaTitle}</Field>
              <div className="sm:col-span-2">
                <Field label="Meta Description">{page.metaDescription}</Field>
              </div>
              <Field label="Meta Keywords">{page.metaKeywords}</Field>
            </div>
          </FormSection>

          <FormSection title="Audit">
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="Created By">{page.createdBy?.name || page.createdBy?.email || '—'}</Field>
              <Field label="Created At">{formatDate(page.createdAt)}</Field>
              <Field label="Updated By">{page.updatedBy?.name || page.updatedBy?.email || '—'}</Field>
              <Field label="Updated At">{formatDate(page.updatedAt)}</Field>
            </div>
          </FormSection>
        </div>
      </Panel>
    </AdminPage>
  )
}

export default PageViewPage
