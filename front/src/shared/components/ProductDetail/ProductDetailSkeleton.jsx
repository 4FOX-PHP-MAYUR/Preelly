import CategoryBrowseLayout from '@shared/components/CategoryBrowseLayout'
import {
  DETAIL_GALLERY_ASPECT,
  DETAIL_GALLERY_OVERLAY,
  DETAIL_GALLERY_OVERLAY_PADDING,
  DETAIL_GALLERY_SHELL,
  DETAIL_PAGE_PADDING,
  DETAIL_SECTION_GAP,
} from './detailStyles'

function ProductDetailSkeleton() {
  return (
    <CategoryBrowseLayout variant="listing" layoutPreset="detail" showMobileAppPromo showTrending={false} showMessages={false}>
      <div className={`flex-1 overflow-y-auto bg-[#F7F8FC] ${DETAIL_PAGE_PADDING}`}>
        <div className={`w-full ${DETAIL_SECTION_GAP}`}>
          <div className="relative">
            <div className={DETAIL_GALLERY_SHELL}>
              <div className={`relative animate-pulse bg-slate-200 ${DETAIL_GALLERY_ASPECT}`}>
                <div className={`${DETAIL_GALLERY_OVERLAY} ${DETAIL_GALLERY_OVERLAY_PADDING}`}>
                  <div className="rounded-xl border border-[#E8EBF2] bg-white p-3.5 shadow-[0_4px_20px_rgba(15,23,42,0.12)] sm:p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="h-6 w-28 animate-pulse rounded-full bg-slate-200" />
                      <div className="h-6 w-20 animate-pulse rounded-full bg-slate-200" />
                    </div>
                    <div className="mb-2 h-5 w-3/4 animate-pulse rounded bg-slate-200" />
                    <div className="flex flex-wrap gap-3">
                      <div className="h-3.5 w-12 animate-pulse rounded bg-slate-200" />
                      <div className="h-3.5 w-20 animate-pulse rounded bg-slate-200" />
                      <div className="h-3.5 w-24 animate-pulse rounded bg-slate-200" />
                    </div>
                  </div>
                  <div className="mt-[10px] flex gap-1.5">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-8 w-[68px] animate-pulse rounded-full bg-slate-200 sm:h-9 sm:w-[72px]" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-[#E8EBF2] bg-white shadow-[0_1px_4px_rgba(15,23,42,0.05)]">
              <div className="border-b border-[#E8EBF2] px-5 py-4">
                <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
              </div>
              <div className="p-5 sm:p-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {Array.from({ length: 6 }).map((__, j) => (
                    <div key={j} className="space-y-2">
                      <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
                      <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </CategoryBrowseLayout>
  )
}

export default ProductDetailSkeleton
