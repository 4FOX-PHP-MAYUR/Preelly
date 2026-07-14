import { Routes, Route, Navigate } from 'react-router-dom'
import CouponsListPage from './CouponsListPage'
import CouponFormPage from './CouponFormPage'
import CouponViewPage from './CouponViewPage'

export default function AdminCouponsRoutes() {
  return (
    <Routes>
      <Route index element={<CouponsListPage />} />
      <Route path="new" element={<CouponFormPage />} />
      <Route path=":id/edit" element={<CouponFormPage />} />
      <Route path=":id" element={<CouponViewPage />} />
      <Route path="*" element={<Navigate to="/admin/coupons" replace />} />
    </Routes>
  )
}
