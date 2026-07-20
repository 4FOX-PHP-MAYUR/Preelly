import { Routes, Route, Navigate } from 'react-router-dom'
import BuyersCouponsListPage from './BuyersCouponsListPage'
import BuyerCouponFormPage from './BuyerCouponFormPage'

export default function AdminBuyersCouponsRoutes() {
  return (
    <Routes>
      <Route index element={<BuyersCouponsListPage />} />
      <Route path="new" element={<BuyerCouponFormPage />} />
      <Route path=":id/edit" element={<BuyerCouponFormPage />} />
      <Route path="*" element={<Navigate to="/admin/buyers-coupons" replace />} />
    </Routes>
  )
}
