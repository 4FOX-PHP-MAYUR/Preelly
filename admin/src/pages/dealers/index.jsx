import { Routes, Route, Navigate } from 'react-router-dom'
import DealersListPage from './DealersListPage'
import DealerFormPage from './DealerFormPage'

export default function AdminDealersRoutes() {
  return (
    <Routes>
      <Route index element={<DealersListPage />} />
      <Route path="new" element={<DealerFormPage />} />
      <Route path=":id/edit" element={<DealerFormPage />} />
      <Route path="*" element={<Navigate to="/admin/dealers" replace />} />
    </Routes>
  )
}
