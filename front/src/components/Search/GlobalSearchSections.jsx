import { Link } from 'react-router-dom'
import { Building2, FolderTree, User, Store, Package } from 'lucide-react'
import { getMediaUrl } from '@shared/utils/helpers'

function SectionHeader({ icon: Icon, title, count }) {
  if (!count) return null
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-5 w-5 text-primary-600" />
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <span className="text-sm text-gray-500">({count})</span>
    </div>
  )
}

function GlobalSearchSections({ results = {} }) {
  const products = results.products || []
  const categories = results.categories || []
  const agents = results.agents || []
  const agencies = results.agencies || []
  const properties = results.properties || []

  const hasContent =
    products.length > 0 ||
    categories.length > 0 ||
    agents.length > 0 ||
    agencies.length > 0 ||
    properties.length > 0

  if (!hasContent) return null

  const formatPrice = (price) =>
    new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
    }).format(price || 0)

  return (
    <div className="space-y-6 mb-6">
      {products.length > 0 && (
        <section className="bg-white rounded-lg shadow-sm p-4">
          <SectionHeader icon={Package} title="Products" count={products.length} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {products.map((item) => (
              <Link
                key={item._id}
                to={`/products/${item._id}`}
                className="flex gap-3 p-2 rounded-lg hover:bg-gray-50"
              >
                <div className="w-16 h-16 rounded bg-gray-200 overflow-hidden flex-shrink-0">
                  <img
                    src={getMediaUrl(item.images?.[0] || item.videoThumbnail) || '/placeholder.jpg'}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm text-gray-900 line-clamp-2">{item.title}</p>
                  <p className="text-primary-600 text-sm font-semibold">{formatPrice(item.price)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {categories.length > 0 && (
        <section className="bg-white rounded-lg shadow-sm p-4">
          <SectionHeader icon={FolderTree} title="Categories" count={categories.length} />
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Link
                key={cat._id}
                to={`/categories/${cat._id}/products`}
                className="inline-flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-primary-50 rounded-lg text-sm text-gray-800"
              >
                <span>{cat.emoji || '📦'}</span>
                <span>{cat.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {properties.length > 0 && (
        <section className="bg-white rounded-lg shadow-sm p-4">
          <SectionHeader icon={Building2} title="Properties" count={properties.length} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {properties.map((item) => (
              <Link
                key={item._id}
                to={`/products/${item._id}`}
                className="flex gap-3 p-2 rounded-lg hover:bg-gray-50"
              >
                <div className="w-16 h-16 rounded bg-gray-200 overflow-hidden flex-shrink-0">
                  <img
                    src={getMediaUrl(item.images?.[0] || item.videoThumbnail) || '/placeholder.jpg'}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm text-gray-900 line-clamp-2">{item.title}</p>
                  <p className="text-primary-600 text-sm font-semibold">{formatPrice(item.price)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {agents.length > 0 && (
        <section className="bg-white rounded-lg shadow-sm p-4">
          <SectionHeader icon={User} title="Agents" count={agents.length} />
          <div className="flex flex-wrap gap-3">
            {agents.map((agent) => (
              <Link
                key={agent._id}
                to={`/user/${agent._id}`}
                className="inline-flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-primary-50 rounded-lg"
              >
                <img
                  src={getMediaUrl(agent.avatar) || '/placeholder-avatar.png'}
                  alt={agent.name}
                  className="w-8 h-8 rounded-full object-cover"
                />
                <span className="text-sm font-medium text-gray-900">{agent.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {agencies.length > 0 && (
        <section className="bg-white rounded-lg shadow-sm p-4">
          <SectionHeader icon={Store} title="Agencies" count={agencies.length} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {agencies.map((agency) => (
              <div key={agency._id} className="flex gap-3 p-2 rounded-lg bg-gray-50">
                {agency.image ? (
                  <img
                    src={getMediaUrl(agency.image)}
                    alt={agency.name}
                    className="w-12 h-12 rounded object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded bg-primary-100 flex items-center justify-center">
                    <Store className="h-5 w-5 text-primary-600" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-medium text-sm text-gray-900">{agency.name}</p>
                  {agency.synopsis && (
                    <p className="text-xs text-gray-500 line-clamp-2">{agency.synopsis}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default GlobalSearchSections
