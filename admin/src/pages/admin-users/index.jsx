import { Routes, Route, Navigate } from 'react-router-dom'
import AdminUsersListPage from './AdminUsersListPage'
import AdminUserFormPage from './AdminUserFormPage'
import AdminUserViewPage from './AdminUserViewPage'

export default function AdminUsersRoutes() {
  return (
    <Routes>
      <Route index element={<AdminUsersListPage />} />
      <Route path="new" element={<AdminUserFormPage />} />
      <Route path=":id/edit" element={<AdminUserFormPage />} />
      <Route path=":id" element={<AdminUserViewPage />} />
      <Route path="*" element={<Navigate to="/admin-users" replace />} />
    </Routes>
  )
}
