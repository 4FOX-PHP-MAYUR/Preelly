import { Routes, Route, Navigate } from 'react-router-dom'
import CategoriesListPage from './CategoriesListPage'
import CategoryFormPage from './CategoryFormPage'

export default function AdminCategoriesRoutes() {
  return (
    <Routes>
      <Route index element={<CategoriesListPage />} />
      <Route path="new" element={<CategoryFormPage />} />
      <Route path=":id/edit" element={<CategoryFormPage />} />
      <Route path="*" element={<Navigate to="/admin/categories" replace />} />
    </Routes>
  )
}
