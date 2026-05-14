import React, { useState, useMemo } from 'react'
import { Search, ChevronLeft, ChevronRight, Edit2, Trash2 } from 'lucide-react'

function DataTable({
  columns = [],
  data = [],
  loading = false,
  onEdit = () => {},
  onDelete = () => {},
  pagination = null, // { page, limit, total, onPageChange }
  serverSide = false, // when true, search is performed server-side
}) {
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    if (serverSide || !q) return data
    const s = q.toLowerCase()
    return data.filter((row) => Object.values(row).some((v) => String(v || '').toLowerCase().includes(s)))
  }, [data, q, serverSide])

  const showingFrom = pagination ? (pagination.page - 1) * pagination.limit + 1 : 1
  const showingTo = pagination ? Math.min(pagination.page * pagination.limit, pagination.total || filtered.length) : filtered.length

  return (
    <div className="rounded-2xl bg-white shadow-md overflow-hidden">
      <div className="p-4 border-b flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search..."
            className="pl-10 pr-3 py-2 w-full border border-gray-200 rounded-lg"
          />
        </div>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full">
          <thead className="bg-white sticky top-0">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="text-left px-4 py-3 text-sm text-gray-500">{c.title}</th>
              ))}
              <th className="px-4 py-3 text-sm text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length + 1} className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="p-8 text-center text-gray-500">No rows</td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row._id || row.id} className="hover:bg-gray-50">
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-3 text-sm text-gray-700">{c.render ? c.render(row) : row[c.key]}</td>
                  ))}
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <div className="flex items-center gap-2">
                      <button onClick={() => onEdit(row)} className="p-2 rounded-md hover:bg-gray-100" aria-label="Edit">
                        <Edit2 className="h-4 w-4 text-indigo-600" />
                      </button>
                      <button onClick={() => onDelete(row)} className="p-2 rounded-md hover:bg-gray-100" aria-label="Delete">
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="px-4 py-3 border-t flex items-center justify-between text-sm text-gray-600">
          <div>
            Showing {showingFrom} – {showingTo} of {pagination.total ?? filtered.length}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => pagination.onPageChange(Math.max(1, pagination.page - 1))}
              disabled={pagination.page <= 1}
              className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-xs text-gray-500">Page <span className="font-medium">{pagination.page}</span></div>
            <button
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page * pagination.limit >= (pagination.total ?? filtered.length)}
              className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default DataTable

