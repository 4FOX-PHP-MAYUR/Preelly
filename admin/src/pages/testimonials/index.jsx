import { Routes, Route, Navigate } from 'react-router-dom'
import TestimonialsListPage from './TestimonialsListPage'
import TestimonialFormPage from './TestimonialFormPage'
import TestimonialViewPage from './TestimonialViewPage'

export default function AdminTestimonialsRoutes() {
  return (
    <Routes>
      <Route index element={<TestimonialsListPage />} />
      <Route path="new" element={<TestimonialFormPage />} />
      <Route path=":id/edit" element={<TestimonialFormPage />} />
      <Route path=":id" element={<TestimonialViewPage />} />
      <Route path="*" element={<Navigate to="/testimonials" replace />} />
    </Routes>
  )
}
