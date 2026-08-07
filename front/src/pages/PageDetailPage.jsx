import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { pageService } from '@shared/services/api'
import { getMediaUrl } from '@shared/utils/helpers'
import CategoryBrowseLayout from '@shared/components/CategoryBrowseLayout'
import NotFoundPage from './NotFoundPage'

// Content spans the full content column with a 100px gutter each side on desktop.
// Narrow screens step the gutter down — 100px either side of a phone viewport
// would leave almost nothing for the text.
const PAGE_GUTTER = 'w-full px-4 sm:px-8 lg:px-[100px]'

/**
 * Same shell the other content pages use (profile, product detail, search), so
 * these pages get the home top bar instead of the plain site header. Header.jsx
 * skips /pages/* so the two never stack.
 *
 * The shell is a fixed-height viewport whose content section is overflow-hidden,
 * so the scroll container has to come from here — otherwise long CMS copy is cut
 * off at the fold with no way to reach the rest.
 */
function PageShell({ children }) {
  return (
    <CategoryBrowseLayout
      featuredProducts={[]}
      layoutPreset="marketplace"
      variant="listing"
      showTrending={false}
      showMessages={false}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </CategoryBrowseLayout>
  )
}

/**
 * Fully dynamic static-content page — renders whatever page an admin created
 * for this slug via the Pages module, with no code changes required.
 * Shows a 404 when the slug is unknown or the page has been deactivated.
 */
function PageDetailPage() {
  const { slug } = useParams()
  const [page, setPage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    setPage(null)

    pageService
      .getPageBySlug(slug)
      .then((res) => {
        if (cancelled) return
        setPage(res.data?.data || null)
      })
      .catch((err) => {
        if (cancelled) return
        if (err?.response?.status === 404) {
          setNotFound(true)
        } else {
          setNotFound(true)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [slug])

  if (loading) {
    return (
      <PageShell>
        <div className={`${PAGE_GUTTER} py-16`}>
          <div className="h-6 w-1/3 animate-pulse rounded bg-slate-200" />
          <div className="mt-4 h-40 w-full animate-pulse rounded-2xl bg-slate-200" />
          <div className="mt-6 space-y-3">
            <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
          </div>
        </div>
      </PageShell>
    )
  }

  if (notFound || !page) {
    return <NotFoundPage />
  }

  const bannerUrl = page.pageBannerImage ? getMediaUrl(page.pageBannerImage) || page.pageBannerImage : null
  const metaTitle = page.metaTitle || page.pageTitle
  const metaDescription = page.metaDescription || ''

  return (
    <>
      <Helmet>
        <title>{metaTitle}</title>
        {metaDescription && <meta name="description" content={metaDescription} />}
        {page.metaKeywords && <meta name="keywords" content={page.metaKeywords} />}
        <link rel="canonical" href={typeof window !== 'undefined' ? window.location.href : undefined} />
        <meta property="og:title" content={metaTitle} />
        {metaDescription && <meta property="og:description" content={metaDescription} />}
        <meta property="og:type" content="website" />
        {bannerUrl && <meta property="og:image" content={bannerUrl} />}
        <meta name="twitter:card" content={bannerUrl ? 'summary_large_image' : 'summary'} />
        <meta name="twitter:title" content={metaTitle} />
        {metaDescription && <meta name="twitter:description" content={metaDescription} />}
        {bannerUrl && <meta name="twitter:image" content={bannerUrl} />}
      </Helmet>

      <PageShell>
        <div className={`${PAGE_GUTTER} py-10 sm:py-14`}>
          {bannerUrl && (
            <div className="mb-8 overflow-hidden rounded-2xl">
              <img src={bannerUrl} alt={page.heading} className="h-56 w-full object-cover sm:h-72" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{page.heading}</h1>
          <div
            className="cms-page-content mt-6 text-sm leading-relaxed text-slate-700 sm:text-base"
            dangerouslySetInnerHTML={{ __html: page.description || '' }}
          />
        </div>
      </PageShell>
    </>
  )
}

export default PageDetailPage
