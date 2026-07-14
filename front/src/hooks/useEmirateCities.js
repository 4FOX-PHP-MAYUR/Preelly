import { useEffect, useState } from 'react'
import { emirateService } from '@shared/services/api'

export function useEmirateCities() {
  const [emirates, setEmirates] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    emirateService
      .listActiveEmirates()
      .then((res) => {
        if (cancelled) return
        const body = res?.data
        const list = Array.isArray(body)
          ? body
          : Array.isArray(body?.data)
            ? body.data
            : Array.isArray(body?.emirates)
              ? body.emirates
              : []
        setEmirates(list)
        setError('')
      })
      .catch((err) => {
        if (cancelled) return
        setEmirates([])
        setError(err?.response?.data?.message || 'Failed to load cities')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { emirates, loading, error }
}
