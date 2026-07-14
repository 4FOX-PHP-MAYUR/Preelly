import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import { User, Phone, MessageCircle } from 'lucide-react'
import { isIdentityVerified, getMediaUrl } from '../../utils/helpers'
import { VERIFIED_BADGE_IMAGES } from '../../utils/verifiedBadge'
import { selectIsAuthenticated, selectUser } from '../../store/slices/authSlice'
import { useChat } from '../Chat/ChatContext'
import DetailCard from './DetailCard'
import { pickDisplay } from './detailHelpers'

function formatPhoneForWhatsApp(phone) {
  if (!phone) return null
  const digitsOnly = String(phone).replace(/[^\d]/g, '')
  return digitsOnly || null
}

function SellerInfo({ product }) {
  const seller = product.seller
  const navigate = useNavigate()
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const user = useSelector(selectUser)
  const { createOrGetThread } = useChat()
  const [showPhoneNumber, setShowPhoneNumber] = useState(false)

  if (!seller) return null

  const currentUserId = user?._id || user?.id
  const sellerId = seller?._id || seller?.id
  const isOwner = Boolean(currentUserId && sellerId && String(currentUserId) === String(sellerId))
  const postCount = product.sellerStats?.postCount ?? 0
  const followingCount = product.sellerStats?.followingCount ?? 0
  const phone = product?.contactPhone || seller?.phone || null
  const whatsappPhone = formatPhoneForWhatsApp(phone)
  const sellerRole = pickDisplay(product.sellerType, seller?.role, seller?.userType)

  const handleChat = async () => {
    if (!isAuthenticated) {
      toast.error('Please login to chat with sellers')
      navigate('/login')
      return
    }
    if (isOwner) {
      toast.error('You cannot chat with yourself for your own product')
      return
    }
    try {
      const thread = await createOrGetThread({
        product: { id: product._id, title: product.title, image: getMediaUrl(product.images?.[0]) || '' },
        buyer: { id: user?._id, name: user?.name || user?.email || 'You' },
        seller: { id: sellerId || 'seller', name: seller?.name || seller?.email || 'Seller' },
      })
      if (thread) {
        navigate(`/chat/${thread.id}`)
      } else {
        toast.error('Unable to start chat right now')
      }
    } catch (error) {
      console.error('Error creating chat:', error)
      toast.error('Failed to start chat. Please try again.')
    }
  }

  return (
    <DetailCard title="Posted by">
      <div className="flex items-start gap-4">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-50 sm:h-[72px] sm:w-[72px]">
          {seller.avatar ? (
            <img
              src={getMediaUrl(seller.avatar) || seller.avatar}
              alt={seller.name}
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            <User className="h-8 w-8 text-brand" />
          )}
          {isIdentityVerified(seller) ? (
            <img
              src={VERIFIED_BADGE_IMAGES.medium}
              alt="Identity Verified"
              className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-white p-0.5"
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-slate-900">{seller.name}</p>
          {sellerRole ? <p className="mt-0.5 text-sm text-slate-500">{sellerRole}</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-slate-500">
            <span>
              Post <strong className="font-semibold text-slate-900">{postCount}</strong>
            </span>
            <span>
              Following <strong className="font-semibold text-slate-900">{followingCount}</strong>
            </span>
          </div>
        </div>
      </div>

      {sellerId ? (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => navigate(`/user/${sellerId}`)}
            className="text-sm font-semibold text-brand hover:text-brand-700"
          >
            View All
          </button>
        </div>
      ) : null}

      {!isOwner ? (
        <div className="mt-5 grid grid-cols-1 gap-2 border-t border-[#E8EBF2] pt-5 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setShowPhoneNumber((v) => !v)}
            disabled={!phone}
            title={!phone ? 'Phone number not available for this listing' : undefined}
            className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Phone className="h-4 w-4" />
            <span>{showPhoneNumber ? 'Hide Phone' : 'Call Seller'}</span>
          </button>
          <button
            type="button"
            onClick={handleChat}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-slate-700 transition hover:bg-slate-50"
          >
            <MessageCircle className="h-4 w-4" />
            <span>Message Seller</span>
          </button>
          <a
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-slate-700 no-underline transition hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-50"
            href={whatsappPhone ? `https://wa.me/${whatsappPhone}` : undefined}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!whatsappPhone}
            onClick={(e) => {
              if (!whatsappPhone) e.preventDefault()
            }}
          >
            <MessageCircle className="h-4 w-4" />
            <span>WhatsApp</span>
          </a>
        </div>
      ) : null}

      {showPhoneNumber && phone && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-center">
          <p className="text-xs text-slate-500">Seller Phone</p>
          <a href={`tel:${phone}`} className="text-lg font-semibold text-slate-900 no-underline">
            {phone}
          </a>
        </div>
      )}
    </DetailCard>
  )
}

export default SellerInfo
