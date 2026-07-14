import { Routes, Route, Navigate } from 'react-router-dom'
import PackagesListPage from './PackagesListPage'
import PackageFormPage from './PackageFormPage'

export default function AdminPackagesRoutes() {
  return (
    <Routes>
      <Route index element={<PackagesListPage />} />
      <Route path="new" element={<PackageFormPage />} />
      <Route path=":id/edit" element={<PackageFormPage />} />
      <Route path="*" element={<Navigate to="/admin/packages" replace />} />
    </Routes>
  )
}
