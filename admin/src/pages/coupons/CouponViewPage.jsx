import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { adminService } from '@shared/services/api'
import {
  AdminPage,
  PageHeader,
  Panel,
  Button,
  StatusBadge,
  FormSection,
} from '../../components/AdminUI'
import { ArrowLeft, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  DISCOUNT_TYPE_OPTIONS,
  APPLICABLE_TYPE_OPTIONS,
  USER_ELIGIBILITY_OPTIONS,
  COUPON_TYPE_OPTIONS,
  labelFor,
  formatDate,
  formatDiscount,
} from './couponConstants'

const LIST_PATH = '/admin/coupons'

function Field({ label, children }) {
  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-900 dark:text-white">{children ?? '—'}</p>
    </div>
  )
}

function CouponViewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [coupon, setCoupon] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await adminService.getCouponById(id)
        if (!cancelled) setCoupon(res.data)
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load coupon')
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
  if (!coupon) return null

  const usage =
    coupon.usageLimit == null
      ? `${coupon.usedCount} used (unlimited)`
      : `${coupon.usedCount} of ${coupon.usageLimit} used`

  return (
    <AdminPage>
      <PageHeader
        title={coupon.couponCode}
        subtitle={coupon.couponName}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate(LIST_PATH)}>
              Back to list
            </Button>
            <Button icon={Pencil} onClick={() => navigate(`${LIST_PATH}/${coupon.id}/edit`)}>
              Edit
            </Button>
          </div>
        }
      />

      <Panel>
        <div className="space-y-6">
          <FormSection title="Basic Information">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Coupon Code">
                <span className="font-mono">{coupon.couponCode}</span>
              </Field>
              <Field label="Coupon Name">{coupon.couponName}</Field>
              <Field label="Status">
                <StatusBadge status={coupon.status ? 'active' : coupon.isExpired ? 'expired' : 'inactive'} />
              </Field>
              <div className="sm:col-span-3">
                <Field label="Description">{coupon.description}</Field>
              </div>
            </div>
          </FormSection>

          <FormSection title="Discount">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Discount Type">{labelFor(DISCOUNT_TYPE_OPTIONS, coupon.discountType)}</Field>
              <Field label="Discount">{formatDiscount(coupon)}</Field>
              <Field label="Maximum Discount">{coupon.maximumDiscount ?? '—'}</Field>
              <Field label="Minimum Order Amount">{coupon.minimumOrderAmount ?? '—'}</Field>
            </div>
          </FormSection>

          <FormSection title="Validity">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Start Date">{formatDate(coupon.startDate)}</Field>
              <Field label="End Date">{formatDate(coupon.endDate)}</Field>
              <Field label="Expired">{coupon.isExpired ? 'Yes' : 'No'}</Field>
            </div>
          </FormSection>

          <FormSection title="Usage">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Total Usage Limit">
                {coupon.usageLimit == null ? 'Unlimited' : coupon.usageLimit}
              </Field>
              <Field label="Usage Per User">
                {coupon.usagePerUser == null ? 'Unlimited' : coupon.usagePerUser}
              </Field>
              <Field label="Used">{usage}</Field>
            </div>
          </FormSection>

          <FormSection title="Applicability & Eligibility">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Applicable For">{labelFor(APPLICABLE_TYPE_OPTIONS, coupon.applicableType)}</Field>
              <Field label="Selected Items">
                {coupon.applicableIds?.length ? `${coupon.applicableIds.length} selected` : '—'}
              </Field>
              <Field label="User Eligibility">{labelFor(USER_ELIGIBILITY_OPTIONS, coupon.userEligibility)}</Field>
              <Field label="Coupon Type">{labelFor(COUPON_TYPE_OPTIONS, coupon.couponType)}</Field>
              <Field label="Assigned Users">
                {coupon.assignedUsers?.length
                  ? coupon.assignedUsers.map((u) => u.name || u.email || u.id).join(', ')
                  : '—'}
              </Field>
              <Field label="Stackable">{coupon.stackable ? 'Yes' : 'No'}</Field>
            </div>
          </FormSection>

          {coupon.terms && (
            <FormSection title="Terms & Conditions">
              <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{coupon.terms}</p>
            </FormSection>
          )}

          <FormSection title="Audit">
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="Created By">{coupon.createdBy?.name || coupon.createdBy?.email || coupon.createdBy?.id}</Field>
              <Field label="Created At">{formatDate(coupon.createdAt)}</Field>
              <Field label="Updated By">{coupon.updatedBy?.name || coupon.updatedBy?.email || coupon.updatedBy?.id}</Field>
              <Field label="Updated At">{formatDate(coupon.updatedAt)}</Field>
            </div>
          </FormSection>
        </div>
      </Panel>
    </AdminPage>
  )
}

export default CouponViewPage
