import { useState } from 'react'
import { X, ZoomIn, ExternalLink } from 'lucide-react'
import { getMediaUrl } from '@shared/utils/helpers'

function IdImage({ src, label, size = 'md', onClick }) {
  const url = getMediaUrl(src)
  if (!url) return null

  const sizeClass =
    size === 'sm'
      ? 'h-16 w-24'
      : size === 'md'
      ? 'h-32 w-full max-w-[220px]'
      : 'h-48 w-full'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative rounded-xl border border-gray-200 bg-gray-50 overflow-hidden ${sizeClass} ${onClick ? 'cursor-zoom-in hover:border-blue-400' : ''}`}
    >
      <img src={url} alt={label} className="h-full w-full object-cover" />
      {onClick && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition">
          <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition" />
        </span>
      )}
    </button>
  )
}

export function EmiratesIdLightbox({ src, label, onClose }) {
  const url = getMediaUrl(src)
  if (!url) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
        aria-label="Close preview"
      >
        <X className="h-6 w-6" />
      </button>
      <div className="max-w-4xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
        <p className="text-white text-sm font-medium mb-2 text-center">{label}</p>
        <img
          src={url}
          alt={label}
          className="w-full max-h-[80vh] object-contain rounded-lg mx-auto"
        />
        <div className="flex justify-center mt-3">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 text-white text-sm hover:bg-white/20"
          >
            <ExternalLink className="h-4 w-4" />
            Open full size
          </a>
        </div>
      </div>
    </div>
  )
}

/** Compact front/back thumbnails for list rows */
export function EmiratesIdThumbnailPair({ front, back, onPreview }) {
  if (!front && !back) return null

  return (
    <div className="flex items-center gap-2 shrink-0">
      {front && (
        <div className="text-center">
          <IdImage
            src={front}
            label="Emirates ID front"
            size="sm"
            onClick={onPreview ? () => onPreview(front, 'Emirates ID — Front') : undefined}
          />
          <span className="text-[10px] text-gray-400 mt-0.5 block">Front</span>
        </div>
      )}
      {back && (
        <div className="text-center">
          <IdImage
            src={back}
            label="Emirates ID back"
            size="sm"
            onClick={onPreview ? () => onPreview(back, 'Emirates ID — Back') : undefined}
          />
          <span className="text-[10px] text-gray-400 mt-0.5 block">Back</span>
        </div>
      )}
    </div>
  )
}

/** Full preview panel for review modal / user detail */
export function EmiratesIdPreviewPanel({ front, back, className = '' }) {
  const [lightbox, setLightbox] = useState(null)

  if (!front && !back) {
    return <p className="text-sm text-gray-400">No Emirates ID images uploaded</p>
  }

  return (
    <>
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${className}`}>
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Emirates ID — Front</p>
          {front ? (
            <div className="space-y-2">
              <IdImage
                src={front}
                label="Emirates ID front"
                size="lg"
                onClick={() => setLightbox({ src: front, label: 'Emirates ID — Front' })}
              />
              <a
                href={getMediaUrl(front)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Open in new tab
              </a>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Not uploaded</p>
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Emirates ID — Back</p>
          {back ? (
            <div className="space-y-2">
              <IdImage
                src={back}
                label="Emirates ID back"
                size="lg"
                onClick={() => setLightbox({ src: back, label: 'Emirates ID — Back' })}
              />
              <a
                href={getMediaUrl(back)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Open in new tab
              </a>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Not uploaded</p>
          )}
        </div>
      </div>
      {lightbox && (
        <EmiratesIdLightbox
          src={lightbox.src}
          label={lightbox.label}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  )
}
