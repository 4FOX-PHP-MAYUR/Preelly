import { ChevronRight, Home } from 'lucide-react'

/** Category → step trail shown across the post-ad flow (and the package step after it). */
export function PostAdListingBreadcrumb({ items = [] }) {
  return (
    <nav className="mb-6 sm:mb-8 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500" aria-label="Breadcrumb">
      <Home className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
      {items.map((name, i) => (
        <span key={`${name}-${i}`} className="inline-flex items-center gap-2">
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
          <span className={i === items.length - 1 ? 'font-medium text-gray-800' : 'text-gray-500'}>
            {name}
          </span>
        </span>
      ))}
    </nav>
  )
}

export default PostAdListingBreadcrumb
