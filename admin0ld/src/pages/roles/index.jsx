import { Routes, Route, Navigate } from 'react-router-dom'
import RolesListPage from './RolesListPage'
import RoleFormPage from './RoleFormPage'
import AdminRolePermissionsPage from '../AdminRolePermissionsPage'

export default function AdminRolesRoutes() {
  return (
    <Routes>
      <Route index element={<RolesListPage />} />
      <Route path="new" element={<RoleFormPage />} />
      <Route path=":id/edit" element={<RoleFormPage />} />
      <Route path=":id/permissions" element={<AdminRolePermissionsPage />} />
      <Route path="*" element={<Navigate to="/admin/roles" replace />} />
    </Routes>
  )
}
