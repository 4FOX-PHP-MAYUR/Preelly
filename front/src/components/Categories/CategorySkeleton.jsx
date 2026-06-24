function CategorySkeleton({ dark = false }) {
  if (dark) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-800 rounded-xl p-4 animate-pulse">
        <div className="mb-3 flex justify-center">
          <div className="w-14 h-14 bg-gray-700 rounded-full"></div>
        </div>
        <div className="h-4 bg-gray-700 rounded w-3/4 mx-auto"></div>
        <div className="h-3 bg-gray-700 rounded w-1/2 mx-auto mt-2"></div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
      <div className="mb-3 flex justify-center">
        <div className="w-16 h-16 bg-gray-200 rounded-full"></div>
      </div>
      <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
      <div className="h-3 bg-gray-200 rounded w-1/2 mx-auto mt-2"></div>
    </div>
  )
}

export default CategorySkeleton

