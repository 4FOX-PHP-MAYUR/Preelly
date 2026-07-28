import { Routes, Route, Navigate } from 'react-router-dom'
import ReportsListPage from './ReportsListPage'
import ReportDetailPage from './ReportDetailPage'

export default function AdminReportsRoutes() {
  return (
    <Routes>
      <Route index element={<ReportsListPage />} />
      <Route path=":userId" element={<ReportDetailPage />} />
      <Route path="*" element={<Navigate to="/reports" replace />} />
    </Routes>
  )
}
