import { Routes, Route, Navigate } from 'react-router-dom'
import CheckoutServicesListPage from './CheckoutServicesListPage'
import CheckoutServiceFormPage from './CheckoutServiceFormPage'

export default function AdminCheckoutServicesRoutes() {
  return (
    <Routes>
      <Route index element={<CheckoutServicesListPage />} />
      <Route path="new" element={<CheckoutServiceFormPage />} />
      <Route path=":id/edit" element={<CheckoutServiceFormPage />} />
      <Route path="*" element={<Navigate to="/admin/checkout-services" replace />} />
    </Routes>
  )
}
