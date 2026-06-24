import React, { useEffect } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { selectIsAuthenticated, selectUser } from '@shared/store/slices/authSlice'

const WelcomePage = () => {
  const navigate = useNavigate()
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const user = useSelector(selectUser)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true })
      return
    }
    if (!user?.isProfileComplete) {
      navigate('/profile-setup', { replace: true })
    }
  }, [isAuthenticated, user, navigate])

  const displayName = user?.displayName || user?.name || 'there'

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 bg-gray-50">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg px-8 py-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Welcome, {displayName}</h1>
        <p className="text-gray-600 mb-8">
          Your basic profile is all set. You can now explore listings, manage your account, or post your
          first ad.
        </p>

        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="w-full rounded-lg bg-primary-600 text-white font-semibold py-3 px-4 hover:bg-primary-700 transition-colors"
          >
            Go to dashboard
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full rounded-lg border border-gray-300 text-gray-800 font-semibold py-3 px-4 hover:bg-gray-50 transition-colors"
          >
            Browse listings
          </button>
          <button
            type="button"
            onClick={() => navigate('/post-ad')}
            className="w-full rounded-lg border border-primary-600 text-primary-700 font-semibold py-3 px-4 hover:bg-primary-50 transition-colors"
          >
            Post an ad
          </button>
        </div>

        <p className="text-sm text-gray-500">
          You can always update your details later from your dashboard settings.
        </p>
      </div>
    </div>
  )
}

export default WelcomePage

