import { useState } from 'react'
import { BadgeCheck, Copy, Facebook, Instagram, Linkedin, Mail, MessageCircle, Send, Share2, User } from 'lucide-react'
import toast from 'react-hot-toast'
import ModalDialog from '../../../components/ui/ModalDialog'
import { getMediaUrl, isIdentityVerified } from '@shared/utils/helpers'
import { VERIFIED_BADGE_IMAGES } from '@shared/utils/verifiedBadge'
import {
  buildEmailShareUrl,
  buildFacebookShareUrl,
  buildLinkedInShareUrl,
  buildProfileShareText,
  buildProfileShareUrl,
  buildTelegramShareUrl,
  buildWhatsAppShareUrl,
  buildXShareUrl,
  copyProfileLink,
  isNativeShareSupported,
  shareProfileNative,
  shareProfileToInstagram,
} from '@shared/utils/profileShareUtils'

function XIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  )
}

export default function ShareProfileModal({ open, onClose, profileUser, profileId }) {
  const [copying, setCopying] = useState(false)

  if (!profileUser || !profileId) return null

  const url = buildProfileShareUrl(profileId)
  const displayName = profileUser.displayName || profileUser.name || 'User'
  const avatarSrc = profileUser.avatar ? getMediaUrl(profileUser.avatar) || profileUser.avatar : null
  const verified = isIdentityVerified(profileUser) || profileUser.isVerified
  const shareText = buildProfileShareText(displayName)

  const openWindow = (href) => {
    window.open(href, '_blank', 'noopener,noreferrer,width=640,height=560')
  }

  const handleCopy = async () => {
    setCopying(true)
    try {
      await copyProfileLink(url)
      toast.success('Profile link copied successfully')
    } catch {
      toast.error('Unable to copy link')
    } finally {
      setCopying(false)
    }
  }

  const handleNativeShare = async () => {
    try {
      const shared = await shareProfileNative({ title: displayName, text: shareText, url })
      if (shared) onClose?.()
    } catch {
      toast.error('Unable to open share sheet')
    }
  }

  const handleInstagramShare = async () => {
    try {
      await shareProfileToInstagram(url, shareText)
      toast.success('Link copied — paste it into Instagram')
    } catch {
      toast.error('Unable to share to Instagram')
    }
  }

  const actions = [
    {
      key: 'copy',
      label: 'Copy Link',
      Icon: Copy,
      onClick: handleCopy,
      disabled: copying,
    },
    ...(isNativeShareSupported()
      ? [
          {
            key: 'native',
            label: 'Share via…',
            Icon: Share2,
            onClick: handleNativeShare,
          },
        ]
      : []),
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      Icon: MessageCircle,
      onClick: () => openWindow(buildWhatsAppShareUrl(url, shareText)),
    },
    {
      key: 'instagram',
      label: 'Instagram',
      Icon: Instagram,
      onClick: handleInstagramShare,
    },
    {
      key: 'facebook',
      label: 'Facebook',
      Icon: Facebook,
      onClick: () => openWindow(buildFacebookShareUrl(url, shareText)),
    },
    {
      key: 'x',
      label: 'Twitter / X',
      Icon: XIcon,
      onClick: () => openWindow(buildXShareUrl(url, shareText)),
    },
    {
      key: 'telegram',
      label: 'Telegram',
      Icon: Send,
      onClick: () => openWindow(buildTelegramShareUrl(url, shareText)),
    },
    {
      key: 'linkedin',
      label: 'LinkedIn',
      Icon: Linkedin,
      onClick: () => openWindow(buildLinkedInShareUrl(url)),
    },
    {
      key: 'email',
      label: 'Email',
      Icon: Mail,
      onClick: () => {
        window.location.href = buildEmailShareUrl(url, shareText, `${displayName}'s profile on Preelly`)
      },
    },
  ]

  return (
    <ModalDialog open={open} onClose={onClose} title="Share Profile" maxWidthClass="sm:max-w-sm">
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[#E8EAED] bg-[#F8F9FB] p-3">
        <div className="relative shrink-0">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gray-200">
            {avatarSrc ? (
              <img src={avatarSrc} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <User className="h-6 w-6 text-gray-400" />
            )}
          </div>
          {verified && (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full border-2 border-white bg-primary-600">
              <BadgeCheck className="h-2.5 w-2.5 text-white" />
            </span>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-bold text-slate-900">{displayName}</p>
            {verified &&
              (isIdentityVerified(profileUser) ? (
                <img src={VERIFIED_BADGE_IMAGES.large} alt="Verified" className="h-4 w-4 shrink-0" />
              ) : (
                <BadgeCheck className="h-4 w-4 shrink-0 text-primary-600" />
              ))}
          </div>
          <p className="truncate text-xs text-slate-500">{url.replace(/^https?:\/\//, '')}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {actions.map(({ key, label, Icon, onClick, disabled }) => (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={onClick}
            className="flex flex-col items-center gap-2 rounded-[14px] border border-[#E8EAED] bg-[#F8F9FB] px-2 py-4 text-center transition hover:border-brand/30 hover:bg-brand-50/40 disabled:opacity-60"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-brand shadow-sm">
              <Icon className="h-5 w-5" />
            </span>
            <span className="text-xs font-semibold text-slate-700">{label}</span>
          </button>
        ))}
      </div>
    </ModalDialog>
  )
}
