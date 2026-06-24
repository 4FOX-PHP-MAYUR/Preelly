function ProductDetailSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-md">
            <div className="aspect-video bg-gray-200 animate-pulse"></div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-4 animate-pulse"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6 animate-pulse"></div>
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="h-8 bg-gray-200 rounded w-3/4 mb-4 animate-pulse"></div>
            <div className="h-12 bg-gray-200 rounded w-1/2 mb-6 animate-pulse"></div>
            <div className="space-y-3">
              <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductDetailSkeleton

