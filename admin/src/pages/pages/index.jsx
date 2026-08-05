import { Routes, Route, Navigate } from 'react-router-dom'
import PagesListPage from './PagesListPage'
import PageFormPage from './PageFormPage'
import PageViewPage from './PageViewPage'

export default function AdminPagesRoutes() {
  return (
    <Routes>
      <Route index element={<PagesListPage />} />
      <Route path="new" element={<PageFormPage />} />
      <Route path=":id/edit" element={<PageFormPage />} />
      <Route path=":id" element={<PageViewPage />} />
      <Route path="*" element={<Navigate to="/pages" replace />} />
    </Routes>
  )
}
