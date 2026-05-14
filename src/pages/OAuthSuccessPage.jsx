import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { initializeAuth } from '../store/slices/authSlice'

function parseHashParams(hash) {
  const raw = String(hash || '').replace(/^#/, '')
  const params = new URLSearchParams(raw)
  return {
    token: params.get('token') || '',
    target: params.get('target') === 'seller' ? 'seller' : 'buyer',
  }
}

function OAuthSuccessPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()

  useEffect(() => {
    const { token, target } = parseHashParams(window.location.hash)
    if (token) {
      localStorage.setItem('token', token)
    }
    localStorage.setItem('authTarget', target)

    dispatch(initializeAuth())
      .unwrap()
      .catch(() => {})
      .finally(() => {
        toast.success('Signed in successfully')
        navigate(target === 'seller' ? '/post-ad' : '/', { replace: true })
      })
  }, [dispatch, navigate])

  return null
}

export default OAuthSuccessPage

