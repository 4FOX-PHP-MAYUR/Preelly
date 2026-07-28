import React from 'react'
import Breadcrumbs from './Breadcrumbs'
import PageHeader from './PageHeader'

function AdminPage({ title, subtitle, breadcrumbs, action, children, className = '' }) {
  return (
    <div className={`admin-page max-w-7xl mx-auto w-full ${className}`}>
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
      {(title || action) && (
        <PageHeader title={title} subtitle={subtitle} action={action} className="mb-6" />
      )}
      {children}
    </div>
  )
}

export default AdminPage
