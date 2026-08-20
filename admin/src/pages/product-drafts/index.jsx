import { Routes, Route, Navigate } from 'react-router-dom'
import ProductDraftsListPage from './ProductDraftsListPage'
import ProductDraftFormPage from './ProductDraftFormPage'
import ProductDraftViewPage from './ProductDraftViewPage'

export default function AdminProductDraftsRoutes() {
  return (
    <Routes>
      <Route index element={<ProductDraftsListPage />} />
      <Route path="new" element={<ProductDraftFormPage />} />
      <Route path=":id/edit" element={<ProductDraftFormPage />} />
      <Route path=":id" element={<ProductDraftViewPage />} />
      <Route path="*" element={<Navigate to="/product-drafts" replace />} />
    </Routes>
  )
}
