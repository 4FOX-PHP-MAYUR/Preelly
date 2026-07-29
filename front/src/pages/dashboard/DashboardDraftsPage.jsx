import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  Car,
  FileText,
  Home,
  Laptop,
  MoreVertical,
  Shirt,
  Sofa,
  Trash2,
  Pencil,
  Eye,
  Send,
} from 'lucide-react'
import SettingsPageShell from '../../components/Dashboard/SettingsPageShell'
import { loadPostAdDraft, clearPostAdDraft } from '@shared/utils/postAdDraftStore'
import { loadServerPostAdDraft, discardServerPostAdDraft } from '@shared/utils/persistPostAdDraft'
import { formatPrice } from '@shared/utils/helpers'
import ModalDialog from '../../components/ui/ModalDialog'

const CONTINUE_CATEGORIES = [
  { key: 'motors', label: 'Motors', icon: Car, bg: 'bg-[#FFF6DF]', iconColor: 'text-[#C9A227]', match: /motor|vehicle|auto|car/i },
  { key: 'property', label: 'Property', icon: Home, bg: 'bg-[#EAF3FF]', iconColor: 'text-[#5B8DEF]', match: /property|real.?estate|home/i },
  { key: 'fashion', label: 'Fashion & Accessories', icon: Shirt, bg: 'bg-[#FFE8F0]', iconColor: 'text-[#D45B8C]', match: /fashion|accessories|clothing/i },
  { key: 'furniture', label: 'Furniture & Garden', icon: Sofa, bg: 'bg-[#EAF8EA]', iconColor: 'text-[#5C9E5C]', match: /furniture|garden|home.?living/i },
  { key: 'classifieds', label: 'Classifieds', icon: FileText, bg: 'bg-[#FFEEDD]', iconColor: 'text-[#D9833C]', match: /classified|anything|everything|general/i },
  { key: 'electronics', label: 'Electronics', icon: Laptop, bg: 'bg-[#ECEBFF]', iconColor: 'text-[#5B57D1]', match: /electronic|gadget|appliance|tech/i },
]

function draftTitle(draft) {
  return (
    draft?.formValues?.title ||
    draft?.dynamicFormValues?.title ||
    draft?.selectedCategory?.name ||
    'Untitled draft'
  )
}

function draftCategory(draft) {
  const path = draft?.selectedPathNames || []
  if (path.length) return path[path.length - 1]
  if (Array.isArray(draft?.selectedPath) && draft.selectedPath.length) {
    const last = draft.selectedPath[draft.selectedPath.length - 1]
    if (last && typeof last === 'object' && last.name) return last.name
  }
  return (
    draft?.selectedCategory?.name ||
    draft?.formValues?.categoryName ||
    'Category not set'
  )
}

function draftPrice(draft) {
  const price = Number(draft?.formValues?.price || draft?.dynamicFormValues?.price || 0)
  const currency = (draft?.formValues?.currency || 'AED').toUpperCase()
  if (!price) return 'Price not set'
  return formatPrice(price, currency)
}

function draftThumb(draft) {
  const img = draft?.imageFiles?.[0]
  if (img instanceof Blob) return URL.createObjectURL(img)
  if (typeof img === 'string') return img
  return null
}

function mergeDraftViews(localDraft, serverDraft) {
  if (!localDraft && !serverDraft) return null
  if (localDraft && !(localDraft.currentStep > 1) && !serverDraft) return null

  const base = {
    ...(serverDraft || {}),
    ...(localDraft || {}),
    draftId: localDraft?.draftId || serverDraft?._id || null,
    formValues: {
      ...(serverDraft?.formValues || {}),
      ...(localDraft?.formValues || {}),
    },
    dynamicFormValues: {
      ...(serverDraft?.dynamicFormValues || {}),
      ...(localDraft?.dynamicFormValues || {}),
    },
    selectedPath: localDraft?.selectedPath?.length
      ? localDraft.selectedPath
      : serverDraft?.selectedPath || [],
    selectedCategory: localDraft?.selectedCategory || serverDraft?.selectedCategory || '',
    currentStep: localDraft?.currentStep || serverDraft?.currentStep || 1,
    imageFiles: localDraft?.imageFiles || [],
    videoFile: localDraft?.videoFile || null,
    savedAt: localDraft?.savedAt || (serverDraft?.lastSavedAt ? new Date(serverDraft.lastSavedAt).getTime() : null),
  }

  if (!(base.currentStep > 1)) return null
  return base
}

function DraftCard({ draft, onContinue, onPreview, onPublish, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const thumb = useMemo(() => draftThumb(draft), [draft])

  useEffect(() => {
    if (!menuOpen) return undefined
    const onDown = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  useEffect(() => () => {
    if (thumb?.startsWith?.('blob:')) URL.revokeObjectURL(thumb)
  }, [thumb])

  return (
    <div className="flex items-center gap-3 rounded-[16px] border border-[#E5E7EB] bg-white p-3 shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition duration-200 hover:border-brand/20 sm:gap-4 sm:p-4">
      <div className="h-20 w-24 shrink-0 overflow-hidden rounded-[12px] bg-slate-100 sm:h-24 sm:w-32">
        {thumb ? (
          <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <FileText className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-bold text-slate-900 sm:text-base">{draftTitle(draft)}</h3>
        <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{draftCategory(draft)}</p>
        <p className="mt-1 text-sm font-bold text-slate-900">{draftPrice(draft)}</p>
        {draft?.savedAt ? (
          <p className="mt-0.5 text-[11px] text-slate-400">
            Last updated {new Date(draft.savedAt).toLocaleString()}
          </p>
        ) : null}
      </div>
      <div className="relative shrink-0" ref={menuRef}>
        <button
          type="button"
          aria-label="Draft options"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition duration-200 hover:bg-slate-100"
        >
          <MoreVertical className="h-5 w-5" />
        </button>
        {menuOpen ? (
          <div className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white py-1 shadow-lg">
            {[
              { label: 'Continue Editing', icon: Pencil, onClick: onContinue },
              { label: 'Preview', icon: Eye, onClick: onPreview },
              { label: 'Publish', icon: Send, onClick: onPublish },
              { label: 'Delete Draft', icon: Trash2, onClick: onDelete, danger: true },
            ].map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    item.onClick?.()
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition duration-150 hover:bg-slate-50 ${
                    item.danger ? 'text-red-500' : 'text-slate-700'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function DashboardDraftsPage() {
  const navigate = useNavigate()
  const user = useSelector((s) => s.auth.user)
  const rootCategories = useSelector((s) => s.categories.rootCategories || [])
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [previewOpen, setPreviewOpen] = useState(false)

  const refresh = async () => {
    setLoading(true)
    try {
      const [local, server] = await Promise.all([
        loadPostAdDraft(user?._id),
        user?._id ? loadServerPostAdDraft() : Promise.resolve(null),
      ])
      setDraft(mergeDraftViews(local, server))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [user?._id])

  const goPostAd = () => navigate('/post-ad')

  const handleDelete = async () => {
    if (!window.confirm('Delete this draft? This cannot be undone.')) return
    const draftId = draft?.draftId || draft?._id
    await clearPostAdDraft(user?._id)
    await discardServerPostAdDraft(draftId)
    setDraft(null)
    toast.success('Draft deleted')
  }

  const categoryCards = CONTINUE_CATEGORIES.map((item) => {
    const matched = rootCategories.find((c) => item.match.test(String(c.name || '')))
    return { ...item, categoryId: matched?._id || null }
  })

  return (
    <SettingsPageShell>
      <div className="mx-auto max-w-3xl pb-10">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3 sm:mb-8">
          <div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">My Drafts</h1>
            <p className="mt-1 text-sm text-slate-500">Resume your ads journey from here</p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand transition duration-200 hover:text-brand-700 sm:text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>

        <div className="space-y-3">
          {loading ? (
            [1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-[16px] bg-slate-100" />
            ))
          ) : draft ? (
            <DraftCard
              draft={draft}
              onContinue={goPostAd}
              onPreview={() => setPreviewOpen(true)}
              onPublish={goPostAd}
              onDelete={handleDelete}
            />
          ) : (
            <div className="rounded-[16px] border border-dashed border-[#E5E7EB] px-4 py-12 text-center">
              <FileText className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">No drafts yet</p>
              <p className="mt-1 text-xs text-slate-400">Start a new ad below to create a draft automatically.</p>
            </div>
          )}
        </div>

        <div className="mt-10">
          <p className="mb-4 text-sm font-medium text-slate-500">Continuing posting new add</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {categoryCards.map((cat) => {
              const Icon = cat.icon
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => navigate('/post-ad')}
                  className={`flex aspect-square flex-col items-center justify-center gap-3 rounded-[18px] ${cat.bg} p-4 text-center transition duration-200 hover:scale-[1.02] hover:shadow-md`}
                >
                  <Icon className={`h-10 w-10 ${cat.iconColor}`} strokeWidth={1.5} />
                  <span className="text-sm font-semibold text-slate-800">{cat.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <ModalDialog open={previewOpen} onClose={() => setPreviewOpen(false)} title="Draft Preview">
        {draft ? (
          <div className="space-y-3 pb-2">
            <p className="text-base font-bold text-slate-900">{draftTitle(draft)}</p>
            <p className="text-sm text-slate-500">{draftCategory(draft)}</p>
            <p className="text-sm font-semibold text-slate-900">{draftPrice(draft)}</p>
            <p className="text-xs text-slate-400">
              Step {draft.currentStep || 1} of your post-ad flow is saved
              {draft.draftId || draft._id ? ' and synced to your account' : ' locally on this device'}.
            </p>
            <button
              type="button"
              onClick={() => {
                setPreviewOpen(false)
                goPostAd()
              }}
              className="mt-2 w-full rounded-full bg-brand py-3 text-sm font-bold text-white transition hover:bg-brand-700"
            >
              Continue Editing
            </button>
          </div>
        ) : null}
      </ModalDialog>
    </SettingsPageShell>
  )
}
