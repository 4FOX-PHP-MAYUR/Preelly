import { useEffect, useState, useRef, useCallback } from 'react'
import { Loader2, CheckCircle2, AlertCircle, Upload } from 'lucide-react'
import { productService } from '../../services/api'

const STAGE_ORDER = ['pending', 'processing', 'generating_thumbnail', 'generating_streams', 'completed']

const STAGE_CONFIG = {
  uploading: { label: 'Uploading Video...', icon: Upload },
  uploaded: { label: 'Video Uploaded', icon: CheckCircle2 },
  pending: { label: 'Processing Video...', icon: Loader2, spin: true },
  processing: { label: 'Processing Video...', icon: Loader2, spin: true },
  generating_thumbnail: { label: 'Generating Thumbnail...', icon: Loader2, spin: true },
  generating_streams: { label: 'Generating Streaming Files...', icon: Loader2, spin: true },
  completed: { label: 'Video Ready', icon: CheckCircle2 },
  failed: { label: 'Processing Failed', icon: AlertCircle },
}

function normalizeStatus(status) {
  if (status === 'ready') return 'completed'
  return status
}

/**
 * Poll product HLS processing status and show step-by-step progress.
 */
export function useVideoProcessingStatus(productId, { enabled = true, pollIntervalMs = 3000 } = {}) {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const intervalRef = useRef(null)

  const fetchStatus = useCallback(async () => {
    if (!productId || !enabled) return null
    try {
      setLoading(true)
      const res = await productService.getVideoProcessingStatus(productId)
      const data = res.data
      setStatus(data)
      return data
    } catch {
      return null
    } finally {
      setLoading(false)
    }
  }, [productId, enabled])

  useEffect(() => {
    if (!productId || !enabled) return undefined

    fetchStatus()

    intervalRef.current = setInterval(async () => {
      const data = await fetchStatus()
      const s = normalizeStatus(data?.status)
      if (s === 'completed' || s === 'failed') {
        clearInterval(intervalRef.current)
      }
    }, pollIntervalMs)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [productId, enabled, pollIntervalMs, fetchStatus])

  return { status, loading, refetch: fetchStatus }
}

export default function VideoProcessingStatus({ productId, enabled = true, className = '' }) {
  const { status } = useVideoProcessingStatus(productId, { enabled })

  if (!enabled || !productId || !status) return null

  const normalized = normalizeStatus(status.status)
  if (normalized === 'completed' && !status.processingStage) return null

  const currentStage = status.processingStage || normalized
  const currentIndex = STAGE_ORDER.indexOf(currentStage)

  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-4 ${className}`}>
      <p className="text-sm font-medium text-blue-900 mb-3">Video streaming preparation</p>
      <div className="space-y-2">
        {STAGE_ORDER.filter((s) => s !== 'pending').map((stage, idx) => {
          const config = STAGE_CONFIG[stage]
          if (!config) return null
          const stageIdx = STAGE_ORDER.indexOf(stage)
          const isActive = stage === currentStage || (normalized === 'completed' && stage === 'completed')
          const isDone = normalized === 'completed' ? stageIdx <= STAGE_ORDER.indexOf('completed') : stageIdx < currentIndex
          const isFailed = normalized === 'failed' && stage === currentStage
          const Icon = isFailed ? AlertCircle : config.icon

          return (
            <div
              key={stage}
              className={`flex items-center gap-2 text-sm ${
                isFailed ? 'text-red-700' : isActive ? 'text-blue-800 font-medium' : isDone ? 'text-green-700' : 'text-gray-400'
              }`}
            >
              <Icon className={`h-4 w-4 flex-shrink-0 ${isActive && config.spin ? 'animate-spin' : ''}`} />
              <span>{isFailed ? status.message || config.label : config.label}</span>
            </div>
          )
        })}
      </div>
      {status.error && normalized === 'failed' && (
        <p className="mt-2 text-xs text-red-600">{status.error}</p>
      )}
    </div>
  )
}

export { STAGE_CONFIG, normalizeStatus }
