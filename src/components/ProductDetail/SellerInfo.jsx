import { User, Calendar, Star } from 'lucide-react'
import { isUserVerified, getMediaUrl } from '../../utils/helpers'
import { VERIFIED_BADGE_IMAGES } from '../../utils/verifiedBadge'

function SellerInfo({ seller }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Seller Information</h3>
      <div className="flex items-start space-x-4 mb-4">
        <div className="relative w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
          {seller.avatar ? (
            <img
              src={getMediaUrl ? getMediaUrl(seller.avatar) : seller.avatar}
              alt={seller.name}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <User className="h-8 w-8 text-primary-600" />
          )}
          {isUserVerified(seller) ? (
            <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 z-10">
              <img 
                src={VERIFIED_BADGE_IMAGES.medium} 
                alt="Verified" 
                className="h-5 w-5"
              />
            </div>
          ) : null}
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900 flex items-center gap-2">
            {seller.name}
            {isUserVerified(seller) ? (
              <img 
                src={VERIFIED_BADGE_IMAGES.medium} 
                alt="Verified" 
                className="h-5 w-5"
                title="Verified Account"
              />
            ) : null}
          </h4>
          {seller.rating && (
            <div className="flex items-center space-x-1 mt-1">
              <Star className="h-4 w-4 text-yellow-400 fill-current" />
              <span className="text-sm text-gray-600">{seller.rating.toFixed(1)}</span>
            </div>
          )}
        </div>
      </div>
      {seller.memberSince && (
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Calendar className="h-4 w-4" />
          <span>Member since {new Date(seller.memberSince).getFullYear()}</span>
        </div>
      )}
    </div>
  )
}

export default SellerInfo

