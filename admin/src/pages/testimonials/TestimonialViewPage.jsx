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
import StarRating from './StarRating'

const LIST_PATH = '/testimonials'

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

function TestimonialViewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [testimonial, setTestimonial] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await adminService.getTestimonialById(id)
        if (!cancelled) setTestimonial(res.data)
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load testimonial')
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
  if (!testimonial) return null

  return (
    <AdminPage>
      <PageHeader
        title={testimonial.testimonialName}
        subtitle={testimonial.customerType === 'seller' ? 'Seller' : 'Buyer'}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate(LIST_PATH)}>
              Back to list
            </Button>
            <Button icon={Pencil} onClick={() => navigate(`${LIST_PATH}/${testimonial.id}/edit`)}>
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
                {testimonial.profileImage ? (
                  <img
                    src={getMediaUrl(testimonial.profileImage) || testimonial.profileImage}
                    alt={testimonial.testimonialName}
                    className="h-16 w-16 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-full border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400">
                    <ImageOff className="h-6 w-6" aria-hidden="true" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{testimonial.testimonialName}</p>
                </div>
              </div>
              <Field label="Customer Type">{testimonial.customerType === 'seller' ? 'Seller' : 'Buyer'}</Field>
              <Field label="Rating"><StarRating value={testimonial.rating} size="sm" /></Field>
              <Field label="Status"><StatusBadge status={testimonial.status ? 'active' : 'inactive'} /></Field>
              <div className="sm:col-span-3">
                <Field label="Testimonial">
                  <span className="whitespace-pre-wrap font-normal">{testimonial.testimonial}</span>
                </Field>
              </div>
            </div>
          </FormSection>

          <FormSection title="Display">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Display Order">{testimonial.displayOrder ?? 0}</Field>
            </div>
          </FormSection>

          <FormSection title="Audit">
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="Created By">{testimonial.createdBy?.name || testimonial.createdBy?.email || '—'}</Field>
              <Field label="Created At">{formatDate(testimonial.createdAt)}</Field>
              <Field label="Updated By">{testimonial.updatedBy?.name || testimonial.updatedBy?.email || '—'}</Field>
              <Field label="Updated At">{formatDate(testimonial.updatedAt)}</Field>
            </div>
          </FormSection>
        </div>
      </Panel>
    </AdminPage>
  )
}

export default TestimonialViewPage
