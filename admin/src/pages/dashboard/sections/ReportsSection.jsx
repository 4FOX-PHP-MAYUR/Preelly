import React, { useEffect, useState } from 'react'
import { Download, FileSpreadsheet, FileText, Table2 } from 'lucide-react'
import toast from 'react-hot-toast'
import Panel from '../../../components/AdminUI/Panel'
import { dashboardService } from '@/services/api'
import { toQueryParams } from '../dashboardConstants'

const FORMAT_META = {
  excel: { label: 'Excel', icon: FileSpreadsheet },
  csv: { label: 'CSV', icon: Table2 },
  pdf: { label: 'PDF', icon: FileText },
}

/**
 * Downloadable reports.
 *
 * Every report honours the dashboard's active filters, so what you export is
 * what you were looking at. Downloads stream as blobs and are named by the
 * server (`Content-Disposition`), matching the existing export flows.
 */
function ReportsSection({ filters, meta }) {
  const [reports, setReports] = useState([])
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    let cancelled = false
    dashboardService
      .getReports()
      .then((response) => {
        if (!cancelled) setReports(response.data?.reports || [])
      })
      .catch(() => {
        if (!cancelled) setReports([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const download = async (type, format) => {
    const key = `${type}:${format}`
    try {
      setBusy(key)
      const response = await dashboardService.downloadReport(type, {
        ...toQueryParams(filters),
        format,
      })

      const blob =
        response.data instanceof Blob ? response.data : new Blob([response.data])

      // A JSON body here means the server returned an error, not a file.
      if (blob.type && blob.type.includes('application/json')) {
        const text = await blob.text()
        let message = 'Failed to generate report'
        try {
          message = JSON.parse(text)?.message || message
        } catch {
          /* keep the default */
        }
        throw new Error(message)
      }

      const disposition = response.headers?.['content-disposition'] || ''
      const match = disposition.match(/filename="?([^"]+)"?/i)
      const filename = match?.[1] || `${type}-report.${format === 'excel' ? 'xlsx' : format}`

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      const total = response.headers?.['x-export-total']
      const truncated = String(response.headers?.['x-export-truncated'] || '') === '1'
      toast.success(
        truncated
          ? 'Report downloaded (first 10,000 rows)'
          : `Report downloaded${total ? ` · ${total} rows` : ''}`,
      )
    } catch (error) {
      let message = 'Failed to generate report'
      const data = error.response?.data
      if (data instanceof Blob) {
        try {
          message = JSON.parse(await data.text())?.message || message
        } catch {
          /* keep the default */
        }
      } else {
        message = error.message || error.response?.data?.message || message
      }
      toast.error(message)
    } finally {
      setBusy(null)
    }
  }

  if (!reports.length) return null

  return (
    <Panel>
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Reports
        </h3>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Exports use the filters above{meta?.fromDate ? ` · ${meta.fromDate} → ${meta.toDate}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <div
            key={report.type}
            className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800"
          >
            <div className="mb-3 flex items-center gap-2">
              <Download className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
              <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                {report.title}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {report.formats.map((format) => {
                const info = FORMAT_META[format] || { label: format, icon: Download }
                const key = `${report.type}:${format}`
                const isBusy = busy === key
                return (
                  <button
                    key={format}
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => download(report.type, format)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    aria-label={`Download ${report.title} as ${info.label}`}
                  >
                    <info.icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {isBusy ? 'Preparing…' : info.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}

export default ReportsSection
