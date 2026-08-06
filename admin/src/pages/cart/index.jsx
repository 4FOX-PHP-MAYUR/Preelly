import { Routes, Route, Navigate } from 'react-router-dom'
import CartListPage from './CartListPage'
import CartViewPage from './CartViewPage'

export default function AdminCartRoutes() {
  return (
    <Routes>
      <Route index element={<CartListPage scope="all" />} />
      <Route path="pending" element={<CartListPage scope="pending" />} />
      <Route path="purchased" element={<CartListPage scope="purchased" />} />
      <Route path=":id" element={<CartViewPage />} />
      <Route path="*" element={<Navigate to="/cart" replace />} />
    </Routes>
  )
}
