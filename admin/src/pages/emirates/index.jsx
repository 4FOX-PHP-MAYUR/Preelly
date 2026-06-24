import { Routes, Route, Navigate } from 'react-router-dom'
import EmiratesListPage from './EmiratesListPage'
import EmirateFormPage from './EmirateFormPage'

export default function AdminEmiratesRoutes() {
  return (
    <Routes>
      <Route index element={<EmiratesListPage />} />
      <Route path="new" element={<EmirateFormPage />} />
      <Route path=":id/edit" element={<EmirateFormPage />} />
      <Route path="*" element={<Navigate to="/admin/emirates" replace />} />
    </Routes>
  )
}
