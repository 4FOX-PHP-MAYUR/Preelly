import { Routes, Route, Navigate } from 'react-router-dom'
import FieldTypesListPage from './FieldTypesListPage'
import FieldTypeFormPage from './FieldTypeFormPage'

export default function AdminFieldTypesRoutes() {
  return (
    <Routes>
      <Route index element={<FieldTypesListPage />} />
      <Route path="new" element={<FieldTypeFormPage />} />
      <Route path=":id/edit" element={<FieldTypeFormPage />} />
      <Route path="*" element={<Navigate to="/admin/field-types" replace />} />
    </Routes>
  )
}
