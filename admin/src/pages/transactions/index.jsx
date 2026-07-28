import { Routes, Route, Navigate } from 'react-router-dom'
import TransactionsListPage from './TransactionsListPage'
import TransactionViewPage from './TransactionViewPage'

export default function AdminTransactionsRoutes() {
  return (
    <Routes>
      <Route index element={<TransactionsListPage />} />
      <Route path=":id" element={<TransactionViewPage />} />
      <Route path="*" element={<Navigate to="/transactions" replace />} />
    </Routes>
  )
}
