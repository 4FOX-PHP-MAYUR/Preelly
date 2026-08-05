import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Home } from 'lucide-react'

/**
 * Generic 404 — shown for unmatched routes and for `/pages/:slug` when the
 * slug doesn't resolve to an active page.
 */
function NotFoundPage() {
  return (
    <>
      <Helmet>
        <title>Page Not Found</title>
      </Helmet>
      <div className="mx-auto flex max-w-4xl flex-col items-center px-4 py-20 text-center sm:py-28">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">404</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Page not found</h1>
        <p className="mt-3 max-w-md text-sm text-slate-500 sm:text-base">
          The page you're looking for doesn't exist or is no longer available.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700"
        >
          <Home className="h-4 w-4" />
          Back to Home
        </Link>
      </div>
    </>
  )
}

export default NotFoundPage
