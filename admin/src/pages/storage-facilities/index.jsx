import { Routes, Route, Navigate } from 'react-router-dom'
import StorageFacilitiesListPage from './StorageFacilitiesListPage'
import StorageFacilityFormPage from './StorageFacilityFormPage'

export default function AdminStorageFacilitiesRoutes() {
  return (
    <Routes>
      <Route index element={<StorageFacilitiesListPage />} />
      <Route path="new" element={<StorageFacilityFormPage />} />
      <Route path=":id/edit" element={<StorageFacilityFormPage />} />
      <Route path="*" element={<Navigate to="/admin/storage-facilities" replace />} />
    </Routes>
  )
}
