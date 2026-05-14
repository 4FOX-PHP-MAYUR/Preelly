import React from 'react'

function StatusBadge({ status }) {
  const map = {
    approved: 'bg-green-100 text-green-800',
    active: 'bg-green-100 text-green-800',
    pending: 'bg-amber-100 text-amber-800',
    rejected: 'bg-red-100 text-red-800',
    sold: 'bg-purple-100 text-purple-800',
    inactive: 'bg-gray-100 text-gray-800',
  }
  const cls = map[status] || 'bg-gray-100 text-gray-800'
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${cls}`}>{String(status).charAt(0).toUpperCase() + String(status).slice(1)}</span>
}

export default StatusBadge

