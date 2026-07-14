import { Smartphone } from 'lucide-react'

function MobileAppPromoCard({
  enabled = true,
  title = 'Get the Mobile App',
  description = 'Buy and sell on the go with our mobile app. Available on iOS and Android.',
  appStoreUrl = null,
  playStoreUrl = null,
  className = 'mt-8',
}) {
  if (!enabled) return null

  const appStoreHref = appStoreUrl || '#'
  const playStoreHref = playStoreUrl || '#'

  return (
    <div className={`overflow-hidden rounded-xl border border-[#E8EBF2] bg-white p-4 shadow-[0_1px_4px_rgba(15,23,42,0.05)] ${className}`}>
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-50 text-brand">
          <Smartphone className="h-5 w-5" />
        </div>
        <p className="text-base font-semibold text-slate-900">{title}</p>
      </div>
      <p className="mb-4 text-sm text-slate-500">{description}</p>
      <div className="flex gap-2">
        {appStoreUrl !== false && (
          <a
            href={appStoreHref}
            className={`flex-1 rounded-xl bg-slate-900 px-3 py-2.5 text-center text-xs font-semibold text-white transition hover:bg-slate-800 ${!appStoreUrl ? 'pointer-events-none opacity-60' : ''}`}
            aria-disabled={!appStoreUrl}
          >
            App Store
          </a>
        )}
        {playStoreUrl !== false && (
          <a
            href={playStoreHref}
            className={`flex-1 rounded-xl bg-slate-900 px-3 py-2.5 text-center text-xs font-semibold text-white transition hover:bg-slate-800 ${!playStoreUrl ? 'pointer-events-none opacity-60' : ''}`}
            aria-disabled={!playStoreUrl}
          >
            Play Store
          </a>
        )}
      </div>
    </div>
  )
}

export default MobileAppPromoCard
