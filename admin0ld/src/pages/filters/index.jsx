import { Routes, Route, Navigate } from 'react-router-dom'
import FiltersListPage from './FiltersListPage'
import FilterFormPage from './FilterFormPage'

export default function AdminFiltersRoutes() {
  return (
    <Routes>
      <Route index element={<FiltersListPage />} />
      <Route path="new" element={<FilterFormPage />} />
      <Route path=":id/edit" element={<FilterFormPage />} />
      <Route path="*" element={<Navigate to="/admin/filters" replace />} />
    </Routes>
  )
}
