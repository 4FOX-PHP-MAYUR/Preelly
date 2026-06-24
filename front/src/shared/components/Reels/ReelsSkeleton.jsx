function ReelsSkeleton() {
  return (
    <div className="reels-page-viewport flex items-center justify-center bg-black min-h-screen">
      <div className="w-full max-w-md px-2 sm:px-4">
        <div className="bg-gray-800 rounded-none sm:rounded-lg aspect-[9/16] max-h-[85dvh] mx-auto animate-pulse"></div>
        <div className="mt-3 sm:mt-4 space-y-2">
          <div className="h-3 sm:h-4 bg-gray-800 rounded w-3/4 animate-pulse"></div>
          <div className="h-3 sm:h-4 bg-gray-800 rounded w-1/2 animate-pulse"></div>
        </div>
      </div>
    </div>
  )
}

export default ReelsSkeleton

