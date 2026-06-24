import { Routes, Route, Navigate } from 'react-router-dom'
import FormFieldsListPage from './FormFieldsListPage'
import FormFieldFormPage from './FormFieldFormPage'

export default function AdminFormFieldsRoutes() {
  return (
    <Routes>
      <Route index element={<FormFieldsListPage />} />
      <Route path="new" element={<FormFieldFormPage />} />
      <Route path=":id/edit" element={<FormFieldFormPage />} />
      <Route path="*" element={<Navigate to="/admin/form-fields" replace />} />
    </Routes>
  )
}
