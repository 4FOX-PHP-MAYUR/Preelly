import { Link } from 'react-router-dom'
import { ShieldOff } from 'lucide-react'
import { AdminPage } from '../components/AdminUI'

function ForbiddenPage({ moduleName }) {
  return (
    <AdminPage>
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <div className="h-14 w-14 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
          <ShieldOff className="h-7 w-7 text-red-500" />
        </div>
        <h1 className="text-2xl font-semibold text-slate-900 mb-2">403 — Unauthorized</h1>
        <p className="text-sm text-slate-600 max-w-md mb-6">
          {moduleName
            ? `You do not have permission to access ${moduleName}. Contact a Super Admin if you need access.`
            : 'You do not have permission to access this page.'}
        </p>
        <Link
          to="/"
          className="inline-flex items-center px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
        >
          Back to Dashboard
        </Link>
      </div>
    </AdminPage>
  )
}

export default ForbiddenPage
