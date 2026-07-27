import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, FileText, Play, X } from 'lucide-react'
import { getMediaUrl } from '../../utils/helpers'

// ── Attachment helpers (shared by customer + admin chat) ─────────────────────
const VIDEO_EXT_RE = /\.(mp4|mov|webm|mkv|avi|m4v|ogg)(\?|$)/i

export const isVideoAttachment = (a) =>
  a?.mimeType?.startsWith('video/') || VIDEO_EXT_RE.test(a?.name || a?.url || '')

// Optimistic previews may carry either `_local` + object-URL `url` (inbox) or a
// `previewUrl` field (admin temp messages). Treat both as not-yet-uploaded.
const isLocalAttachment = (a) => Boolean(a?._local || a?.previewUrl)
const resolveUrl = (a) => a?.previewUrl || (a?._local ? a?.url : getMediaUrl(a?.url))

// Download a file "as if opened with an app" (blob download, browser fallback).
async function openWithApp(fileUrl, name) {
  try {
    const res = await fetch(fileUrl)
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const el = document.createElement('a')
    el.href = blobUrl
    el.download = name || 'file'
    document.body.appendChild(el)
    el.click()
    document.body.removeChild(el)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000)
  } catch {
    const el = document.createElement('a')
    el.href = fileUrl
    el.download = name || 'file'
    el.click()
  }
}

/**
 * WhatsApp-style chat attachments: photos + videos share one album grid with a
 * popup gallery viewer (arrows / counter / keyboard); audio and documents render
 * inline below. Handles both real and optimistic (local preview) attachments.
 */
function ChatAttachments({ attachments = [], isTemp = false }) {
  const imgs = attachments.filter(a => a.mimeType?.startsWith('image/') && !isVideoAttachment(a))
  const vids = attachments.filter(a => isVideoAttachment(a))
  const auds = attachments.filter(a => a.mimeType?.startsWith('audio/'))
  const docs = attachments.filter(a =>
    !a.mimeType?.startsWith('image/') &&
    !a.mimeType?.startsWith('audio/') &&
    !isVideoAttachment(a))

  // Photos and videos share one album grid (videos get a play badge).
  const media = [
    ...imgs.map(a => ({ a, kind: 'image' })),
    ...vids.map(a => ({ a, kind: 'video' })),
  ]
  const MAX = 4
  const extra = Math.max(0, media.length - MAX)
  const shown = media.slice(0, MAX)

  const [viewerIndex, setViewerIndex] = useState(null) // index into `media`, or null when closed
  const viewerItem = viewerIndex != null ? media[viewerIndex] : null

  const openAt = (i) => {
    if (isLocalAttachment(media[i]?.a)) return // temp preview — not yet uploaded
    setViewerIndex(i)
  }
  const closeViewer = () => setViewerIndex(null)
  const stepViewer = useCallback((dir) => {
    setViewerIndex((idx) => (idx == null ? idx : (idx + dir + media.length) % media.length))
  }, [media.length])

  // Keyboard: Escape closes, arrows browse the album
  useEffect(() => {
    if (viewerIndex == null) return
    const onKey = (e) => {
      if (e.key === 'Escape') closeViewer()
      else if (e.key === 'ArrowRight') stepViewer(1)
      else if (e.key === 'ArrowLeft') stepViewer(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewerIndex, stepViewer])

  const handleDoc = (a) => {
    if (isLocalAttachment(a)) return
    openWithApp(resolveUrl(a), a.name)
  }

  const single = shown.length === 1
  const gridStyle = {
    display: 'grid',
    gap: 2,
    width: 244,
    gridTemplateColumns: single ? '1fr' : '1fr 1fr',
  }
  const cellH = single ? 220 : 120

  if (media.length === 0 && auds.length === 0 && docs.length === 0) return null

  return (
    <div className={isTemp ? 'opacity-60' : ''}>
      {shown.length > 0 && (
        <div style={gridStyle} className="overflow-hidden rounded-2xl">
          {shown.map(({ a, kind }, i) => {
            const isLast = i === shown.length - 1 && extra > 0
            const spanRow = shown.length === 3 && i === 0
            const h = spanRow ? 242 : cellH
            const badge = single ? 52 : 40
            const local = isLocalAttachment(a)
            return (
              <div key={i} style={{ gridRow: spanRow ? 'span 2' : undefined, position: 'relative' }}>
                <button onClick={() => openAt(i)} className="block w-full focus:outline-none" style={{ cursor: local ? 'default' : 'pointer' }}>
                  {kind === 'video' ? (
                    <video src={resolveUrl(a)} muted playsInline preload="metadata"
                      style={{ width: '100%', height: h, objectFit: 'cover', display: 'block', background: '#000' }} />
                  ) : (
                    <img src={resolveUrl(a)} alt={a.name}
                      style={{ width: '100%', height: h, objectFit: 'cover', display: 'block' }} />
                  )}
                </button>
                {/* Play badge on video cells (hidden under the +N overlay) */}
                {kind === 'video' && !isLast && (
                  <div onClick={() => openAt(i)} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.22)', cursor: local ? 'default' : 'pointer' }}>
                    <span style={{ height: badge, width: badge, borderRadius: 9999, background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                      <Play className="text-gray-900" style={{ height: badge * 0.42, width: badge * 0.42, transform: 'translateX(2px)' }} fill="currentColor" />
                    </span>
                  </div>
                )}
                {isLast && (
                  <div onClick={() => openAt(i)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.52)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <span style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>+{extra}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {auds.map((a, i) => (
        <div key={i} className="px-3 py-2.5 bg-white">
          <audio controls src={resolveUrl(a)} className="max-w-[240px] h-10" style={{ colorScheme: 'light' }} />
        </div>
      ))}
      {docs.map((a, i) => (
        <button key={i} onClick={() => handleDoc(a)}
          className="flex w-full items-center gap-2 px-4 py-3 bg-white hover:bg-gray-50 transition-colors">
          <FileText className="h-5 w-5 text-purple-500 shrink-0" />
          <span className="text-sm text-gray-700 truncate max-w-[160px]">{a.name}</span>
        </button>
      ))}

      {viewerItem && (
        <div
          onClick={closeViewer}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(2px)' }}
        >
          <button
            onClick={closeViewer}
            aria-label="Close"
            style={{ position: 'absolute', top: 16, right: 16, height: 40, width: 40, borderRadius: 9999, background: 'rgba(255,255,255,0.15)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X className="h-6 w-6" />
          </button>

          {media.length > 1 && (
            <div style={{ position: 'absolute', top: 20, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 600 }}>
              {viewerIndex + 1} / {media.length}
            </div>
          )}

          {media.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); stepViewer(-1) }}
              aria-label="Previous"
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', height: 44, width: 44, borderRadius: 9999, background: 'rgba(255,255,255,0.15)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
          )}
          {media.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); stepViewer(1) }}
              aria-label="Next"
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', height: 44, width: 44, borderRadius: 9999, background: 'rgba(255,255,255,0.15)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', rotate: '180deg' }}
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
          )}

          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh' }}>
            {viewerItem.kind === 'video' ? (
              <video key={viewerIndex} src={resolveUrl(viewerItem.a)} controls autoPlay playsInline
                style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, background: '#000' }} />
            ) : (
              <img src={resolveUrl(viewerItem.a)} alt={viewerItem.a.name || 'attachment'}
                style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ChatAttachments
