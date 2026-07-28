import { useRef } from 'react'
import { BadgeCheck, Pencil, User } from 'lucide-react'

function formatOrdinalDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const day = d.getDate()
  const suffix =
    day % 10 === 1 && day !== 11
      ? 'st'
      : day % 10 === 2 && day !== 12
        ? 'nd'
        : day % 10 === 3 && day !== 13
          ? 'rd'
          : 'th'
  const month = d.toLocaleString('en-GB', { month: 'short' })
  return `${day}${suffix} ${month} ${d.getFullYear()}`
}

export default function ProfileHeaderCard({
  avatarSrc,
  displayName,
  joinedAt,
  updatedAt,
  isVerified,
  onGetVerified,
  onAvatarChange,
  avatarUploading = false,
}) {
  const fileRef = useRef(null)

  return (
    <div className="flex flex-col gap-4 rounded-[12px] border border-[#E5E7EB] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex min-w-0 items-center gap-4">
        <div className="relative shrink-0">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-slate-100 ring-2 ring-slate-100 sm:h-[72px] sm:w-[72px]">
            {avatarSrc ? (
              <img src={avatarSrc} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <User className="h-8 w-8 text-slate-400" />
            )}
          </div>
          {onAvatarChange ? (
            <>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={avatarUploading}
                aria-label="Change profile photo"
                className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-slate-600 shadow-sm transition duration-200 hover:border-brand hover:text-brand disabled:opacity-60"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) onAvatarChange(file)
                  e.target.value = ''
                }}
              />
            </>
          ) : null}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate text-base font-bold text-slate-900 sm:text-lg">{displayName}</h2>
            {isVerified ? <BadgeCheck className="h-5 w-5 shrink-0 text-brand" /> : null}
          </div>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Joined on {formatOrdinalDate(joinedAt)}
          </p>
          <p className="text-xs text-slate-500 sm:text-sm">
            Last updated on {formatOrdinalDate(updatedAt)}
          </p>
        </div>
      </div>

      {isVerified ? (
        <span className="inline-flex items-center justify-center gap-2 self-start rounded-[10px] border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 sm:self-center">
          <BadgeCheck className="h-4 w-4" />
          Verified
        </span>
      ) : (
        <button
          type="button"
          onClick={onGetVerified}
          className="inline-flex items-center justify-center gap-2 self-start rounded-[10px] border border-brand bg-white px-4 py-2.5 text-sm font-semibold text-brand transition duration-200 hover:bg-brand-50 sm:self-center"
        >
          <BadgeCheck className="h-4 w-4" />
          Get Verified
        </button>
      )}
    </div>
  )
}
