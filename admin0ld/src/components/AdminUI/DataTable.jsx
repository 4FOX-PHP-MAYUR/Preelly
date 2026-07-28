import React, { useState, useMemo } from 'react'
import { Search, ChevronLeft, ChevronRight, Edit2, Trash2, MoreHorizontal } from 'lucide-react'
import EmptyState from './EmptyState'
import LoadingSpinner from './LoadingSpinner'
import Input from './Input'

function DataTable({
  columns = [],
  data = [],
  loading = false,
  onEdit,
  onDelete,
  onRowClick,
  pagination = null,
  serverSide = false,
  searchPlaceholder = 'Search...',
  showSearch = true,
  emptyTitle = 'No records found',
  emptyDescription,
  actions = true,
  customActions,
  className = '',
}) {
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    if (serverSide || !q) return data
    const s = q.toLowerCase()
    return data.filter((row) =>
      Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(s))
    )
  }, [data, q, serverSide])

  const colSpan = columns.length + (actions ? 1 : 0)
  const showingFrom = pagination ? (pagination.page - 1) * pagination.limit + 1 : 1
  const showingTo = pagination
    ? Math.min(pagination.page * pagination.limit, pagination.total || filtered.length)
    : filtered.length
  const totalCount = pagination?.total ?? filtered.length

  const getColumnHeader = (col) => col.title || col.label || col.key

  return (
    <div className={`admin-table-wrapper overflow-hidden ${className}`}>
      {showSearch && (
        <div className="admin-table-toolbar px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-md">
            <Input
              icon={Search}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label="Search table"
            />
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="admin-table min-w-full">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`text-left ${c.className || ''}`}
                  style={c.width ? { width: c.width } : undefined}
                >
                  {getColumnHeader(c)}
                </th>
              ))}
              {actions && (
                <th className="text-right w-[100px]">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={colSpan}>
                  <LoadingSpinner message="Loading data..." size="sm" />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={colSpan}>
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            ) : (
              filtered.map((row, rowIndex) => (
                <tr
                  key={row._id || row.id || rowIndex}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={onRowClick ? 'cursor-pointer' : ''}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={c.cellClassName || ''}>
                      {c.render ? c.render(row) : row[c.key]}
                    </td>
                  ))}
                  {actions && (
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {onEdit && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onEdit(row) }}
                            className="admin-table-action text-primary-600 dark:text-primary-400"
                            aria-label="Edit row"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onDelete(row) }}
                            className="admin-table-action text-red-600 dark:text-red-400"
                            aria-label="Delete row"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                        {customActions?.(row)}
                        {!onEdit && !onDelete && !customActions && (
                          <button type="button" className="admin-table-action text-slate-400" aria-label="More actions">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && totalCount > 0 && (
        <div className="admin-table-pagination px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          <p className="text-slate-500 dark:text-slate-400">
            Showing <span className="font-medium text-slate-700 dark:text-slate-300">{showingFrom}</span>
            {' – '}
            <span className="font-medium text-slate-700 dark:text-slate-300">{showingTo}</span>
            {' of '}
            <span className="font-medium text-slate-700 dark:text-slate-300">{totalCount}</span>
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => pagination.onPageChange(Math.max(1, pagination.page - 1))}
              disabled={pagination.page <= 1}
              className="admin-pagination-btn"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 text-slate-600 dark:text-slate-400">
              Page <span className="font-medium text-slate-900 dark:text-white">{pagination.page}</span>
            </span>
            <button
              type="button"
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page * pagination.limit >= totalCount}
              className="admin-pagination-btn"
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
