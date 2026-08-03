import React from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import DashboardPage from './DashboardPage'

function AdminDashboardRoutes() {
  return (
    <Routes>
      <Route index element={<DashboardPage />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default AdminDashboardRoutes
