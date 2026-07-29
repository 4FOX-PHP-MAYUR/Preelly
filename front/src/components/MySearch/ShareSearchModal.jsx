import { useState } from 'react'
import { Copy, Facebook, Mail, MessageCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import ModalDialog from '../ui/ModalDialog'
import { buildShareUrl, getSearchDisplayName } from './savedSearchUtils'

function XIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  )
}

export default function ShareSearchModal({ open, item, onClose }) {
  const [copying, setCopying] = useState(false)
  if (!item) return null

  const url = buildShareUrl(item)
  const name = getSearchDisplayName(item)
  const shareText = `Check out my saved search “${name}” on Preelly`

  const openWindow = (href) => {
    window.open(href, '_blank', 'noopener,noreferrer,width=640,height=560')
  }

  const handleCopy = async () => {
    setCopying(true)
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy link')
    } finally {
      setCopying(false)
    }
  }

  const actions = [
    {
      key: 'copy',
      label: 'Copy Link',
      Icon: Copy,
      onClick: handleCopy,
    },
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      Icon: MessageCircle,
      onClick: () =>
        openWindow(`https://wa.me/?text=${encodeURIComponent(`${shareText}\n${url}`)}`),
    },
    {
      key: 'facebook',
      label: 'Facebook',
      Icon: Facebook,
      onClick: () =>
        openWindow(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(shareText)}`
        ),
    },
    {
      key: 'x',
      label: 'Twitter / X',
      Icon: XIcon,
      onClick: () =>
        openWindow(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`
        ),
    },
    {
      key: 'email',
      label: 'Email',
      Icon: Mail,
      onClick: () => {
        window.location.href = `mailto:?subject=${encodeURIComponent(`Saved search: ${name}`)}&body=${encodeURIComponent(`${shareText}\n\n${url}`)}`
      },
    },
  ]

  return (
    <ModalDialog open={open} onClose={onClose} title="Share Search" maxWidthClass="sm:max-w-sm">
      <p className="mb-4 text-sm text-slate-500">
        Share <span className="font-semibold text-slate-800">{name}</span> with others.
      </p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {actions.map(({ key, label, Icon, onClick }) => (
          <button
            key={key}
            type="button"
            disabled={key === 'copy' && copying}
            onClick={onClick}
            className="flex flex-col items-center gap-2 rounded-[14px] border border-[#E8EAED] bg-[#F8F9FB] px-3 py-4 text-center transition hover:border-brand/30 hover:bg-brand-50/40 disabled:opacity-60"
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
