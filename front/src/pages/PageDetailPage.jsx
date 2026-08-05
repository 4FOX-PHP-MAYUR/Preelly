import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { pageService } from '@shared/services/api'
import { getMediaUrl } from '@shared/utils/helpers'
import NotFoundPage from './NotFoundPage'

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
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <div className="h-6 w-1/3 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 h-40 w-full animate-pulse rounded-2xl bg-slate-200" />
        <div className="mt-6 space-y-3">
          <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
        </div>
      </div>
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

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
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
    </>
  )
}

export default PageDetailPage
