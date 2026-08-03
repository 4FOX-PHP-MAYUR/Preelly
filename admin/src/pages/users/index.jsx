import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy } from 'react'
import UsersListPage from './UsersListPage'
import UserFormPage from './UserFormPage'
import AdminUserIdentityPanel from '../../components/AdminUI/AdminUserIdentityPanel'

const UserProfilePage = lazy(() => import('@shared/pages/UserProfilePage'))

function AdminUserProfilePage() {
  return (
    <UserProfilePage
      adminMode
      renderAdminPanel={(props) => <AdminUserIdentityPanel {...props} />}
    />
  )
}

export default function AdminUsersRoutes() {
  return (
    <Routes>
      <Route index element={<UsersListPage />} />
      <Route path="new" element={<UserFormPage />} />
      <Route path=":id/edit" element={<UserFormPage />} />
      <Route path=":id" element={<AdminUserProfilePage />} />
      <Route path="*" element={<Navigate to="/users" replace />} />
    </Routes>
  )
}
