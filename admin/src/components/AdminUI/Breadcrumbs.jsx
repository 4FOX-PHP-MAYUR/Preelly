import React from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'

function Breadcrumbs({ items = [] }) {
  if (!items.length) return null

  return (
    <nav aria-label="Breadcrumb" className="mb-1">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
        <li>
          <Link
            to="/admin"
            className="inline-flex items-center hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            aria-label="Admin home"
          >
            <Home className="h-3.5 w-3.5" />
          </Link>
        </li>
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 shrink-0" aria-hidden="true" />
              {item.to && !isLast ? (
                <Link to={item.to} className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span className={isLast ? 'font-medium text-slate-900 dark:text-slate-100' : ''} aria-current={isLast ? 'page' : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export default Breadcrumbs
