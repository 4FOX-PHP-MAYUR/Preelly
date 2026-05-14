function CategoryCard({ category, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow text-center group"
    >
      <div className="mb-3 flex justify-center">
        <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center group-hover:bg-primary-200 transition-colors">
          {category.icon ? (
            <img src={category.icon} alt={category.name} className="w-10 h-10" />
          ) : (
            <span className="text-2xl">{category.emoji || '📦'}</span>
          )}
        </div>
      </div>
      <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
        {category.name}
      </h3>
      <p className="text-sm text-gray-500 mt-1">
        {category.count !== undefined && category.count !== null
          ? `${category.count} ${category.count === 1 ? 'ad' : 'ads'}`
          : '0 ads'}
      </p>
    </button>
  )
}

export default CategoryCard

