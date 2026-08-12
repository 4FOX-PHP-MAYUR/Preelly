import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  ArrowLeft, Ban, Bookmark, Briefcase, Building2, Car, Check, CheckCheck,
  FileText, Flag, Image as ImageIcon, LayoutGrid, MessageCircle, Mic, MoreVertical, Paperclip, Phone, Play, Plus,
  Search, Send, Settings, Shirt, Smartphone, Sofa, Square, Video, X,
} from 'lucide-react'
import { selectUser, selectIsAuthenticated } from '@shared/store/slices/authSlice'
import { fetchRootCategories } from '@shared/store/slices/categorySlice'
import BrandLogo from '@shared/components/BrandLogo'
import MarketplaceTopBar from '../components/Layout/MarketplaceTopBar'
import MarketplaceLogoBlock from '../components/Layout/MarketplaceLogoBlock'
import { MARKETPLACE_LOGO_CELL } from '../components/Layout/marketplaceLayoutStyles'
import SidebarCategoryList from '../components/Layout/SidebarCategoryList'
import MoreOptionsModal, { buildChatMoreOptions } from '../components/Chat/MoreOptionsModal'
import BlockFlow from '../components/Block/BlockFlow'
import UnblockConfirmModal from '../components/Block/UnblockConfirmModal'
import { cartService, productService, checkoutServicePublicService, chatService, userService } from '@shared/services/api'
import { PreellyPayModal, derivePreellyConditions, PREELLY_PAY_CHARGE } from '@shared/components/PreellyPayModal'
import { useChat } from '@shared/components/Chat/ChatContext'
import { useCall } from '@shared/components/Call/CallContext'
import ChatAttachments, { isVideoAttachment } from '@shared/components/Chat/ChatAttachments'
import { getMediaUrl } from '@shared/utils/helpers'
import toast from 'react-hot-toast'

// ─────────────────────────────────────────────────────────────────────────────
const TABS = ['All', 'Cart', 'Buying', 'Selling', 'Unread']

// Order matters: "Make an offer" leads because it is the action, not a canned
// message — it opens the offer modal rather than sending text (see onQuickReply).
const QUICK_REPLIES = [
  'Make an offer',
  'Hello',
  'Is it available',
  'when can i call you?',
  'what is your location',
  'what is the final price?',
]

// ── helpers ───────────────────────────────────────────────────────────────────
function fmtTime(val) {
  if (!val) return ''
  const d   = new Date(val)
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diff === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diff === 1) return 'Yesterday'
  if (diff < 7)   return `${diff} Days Ago`
  return d.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtMsgTime(val) {
  if (!val) return ''
  return new Date(val).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function dayLabel(dateStr) {
  const d   = new Date(dateStr)
  const now = new Date()
  const yest = new Date(now); yest.setDate(now.getDate() - 1)
  if (d.toDateString() === now.toDateString())  return 'Today'
  if (d.toDateString() === yest.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function groupMsgs(messages) {
  const out = []; let lastDay = ''
  for (const m of messages) {
    const day = new Date(m.createdAt).toDateString()
    if (day !== lastDay) { lastDay = day; out.push({ label: dayLabel(m.createdAt), msgs: [] }) }
    out[out.length - 1].msgs.push(m)
  }
  return out
}

function safeUrl(src) {
  if (!src) return null
  return typeof src === 'string' && src.startsWith('http') ? src : getMediaUrl(src)
}

function fmtCompactCount(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return String(n)
}

const categoryIconMap = [
  { pattern: /\b(motor|vehicle|car|auto)\b/i,               icon: Car },
  { pattern: /\b(property|real estate|villa|apartment|home)\b/i, icon: Building2 },
  { pattern: /\b(job|career|work)\b/i,                      icon: Briefcase },
  { pattern: /\b(fashion|clothing|accessories)\b/i,          icon: Shirt },
  { pattern: /\b(furniture|garden|home decor)\b/i,           icon: Sofa },
  { pattern: /\b(electronics|mobile|phone|laptop|gaming)\b/i, icon: Smartphone },
]
function getCategoryIcon(name) {
  return categoryIconMap.find(({ pattern }) => pattern.test(name || ''))?.icon ?? LayoutGrid
}

// ── Call duration formatter ───────────────────────────────────────────────────
function fmtDuration(secs) {
  if (!secs || secs <= 0) return ''
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
}

// ── Call message bubble ───────────────────────────────────────────────────────
function CallBubble({ message, isSelf }) {
  const { callMeta } = message
  const isVideo  = callMeta?.callType === 'video'
  const status   = callMeta?.status
  const duration = callMeta?.duration || 0
  const missed   = status === 'missed' || status === 'rejected' || status === 'cancelled'

  const label = {
    completed: `${isVideo ? 'Video' : 'Voice'} call${fmtDuration(duration) ? ` · ${fmtDuration(duration)}` : ''}`,
    missed:    `Missed ${isVideo ? 'video' : 'voice'} call`,
    rejected:  `Declined ${isVideo ? 'video' : 'voice'} call`,
    cancelled: `Cancelled ${isVideo ? 'video' : 'voice'} call`,
  }[status] ?? (isVideo ? 'Video call' : 'Voice call')

  return (
    <div className={`inline-flex items-center gap-3 px-4 py-2.5 rounded-2xl border shadow-sm ${
      isSelf ? 'rounded-br-sm' : 'rounded-bl-sm'
    } bg-white border-gray-200`}>
      <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center ${
        missed ? 'bg-red-100' : 'bg-green-100'
      }`}>
        {isVideo
          ? <Video className={`h-4 w-4 ${missed ? 'text-red-500' : 'text-green-600'}`} />
          : <Phone className={`h-4 w-4 ${missed ? 'text-red-500' : 'text-green-600'}`} />
        }
      </div>
      <span className={`text-sm font-medium ${missed ? 'text-red-600' : 'text-gray-800'}`}>
        {label}
      </span>
    </div>
  )
}

// ── Offer message ─────────────────────────────────────────────────────────────
// Offers are sent as plain text `💰 Offer: AED 55,000` so they persist and sync
// like any message; here we detect that shape and render the negotiation card.
const OFFER_RE = /^💰\s*Offer:\s*AED\s*([\d,.]+)/
export function parseOfferAmount(text) {
  const m = OFFER_RE.exec(String(text || '').trim())
  return m ? m[1] : null
}

const ACCEPT_RE = /^✅\s*Offer accepted/
export function isAcceptMessage(text) {
  return ACCEPT_RE.test(String(text || '').trim())
}

const REJECT_RE = /^❌\s*Offer rejected/
export function isRejectMessage(text) {
  return REJECT_RE.test(String(text || '').trim())
}

// An offer is a "response action" if it accepts, rejects, or counters (a new offer).
function isOfferAction(text) {
  return Boolean(parseOfferAmount(text)) || isAcceptMessage(text) || isRejectMessage(text)
}

// ── Preelly Pay inspection-conditions handshake (encoded as chat messages) ──────
// A buyer sends their chosen inspection conditions to the seller for approval;
// the seller replies with approve/reject. All three are plain-text messages so
// they flow through the normal chat pipeline (no schema/socket changes needed).
const PREELLY_REQ_RE = /^🔍\s*Preelly Inspection Conditions/
const PREELLY_APPROVE_RE = /^✅\s*Preelly Inspection Approved/
const PREELLY_REJECT_RE = /^❌\s*Preelly Inspection Rejected/

function isPreellyRequest(text) {
  return PREELLY_REQ_RE.test(String(text || '').trim())
}
function isPreellyApprove(text) {
  return PREELLY_APPROVE_RE.test(String(text || '').trim())
}
function isPreellyReject(text) {
  return PREELLY_REJECT_RE.test(String(text || '').trim())
}
function isPreellyResponse(text) {
  return isPreellyApprove(text) || isPreellyReject(text)
}

const PREELLY_REQ_HEADER = '🔍 Preelly Inspection Conditions'
const PREELLY_APPROVE_MSG = '✅ Preelly Inspection Approved'
const PREELLY_REJECT_MSG = '❌ Preelly Inspection Rejected'

// Encode the buyer's selection into a message body (bullet list + optional note).
function buildPreellyRequestText(conditions, comment) {
  let text = PREELLY_REQ_HEADER
  for (const c of conditions) text += `\n• ${c}`
  if (comment && comment.trim()) text += `\nComment: ${comment.trim()}`
  return text
}

// Parse a request message body back into { conditions, comment }.
function parsePreellyRequest(text) {
  const lines = String(text || '').split('\n')
  const conditions = lines
    .filter((l) => l.trim().startsWith('•'))
    .map((l) => l.replace(/^\s*•\s*/, '').trim())
    .filter(Boolean)
  const commentLine = lines.find((l) => /^\s*comment:/i.test(l))
  const comment = commentLine ? commentLine.replace(/^\s*comment:\s*/i, '').trim() : ''
  return { conditions, comment }
}

// Card shown for a Preelly inspection-conditions request. The seller (not self)
// gets Approve/Reject buttons while pending; the buyer (self) sees the waiting
// notice, then the approved/rejected outcome (with a Proceed to cart CTA once
// approved and locked).
function PreellyRequestBubble({ conditions, comment, isSelf, status, onApprove, onReject, onProceed, onNewCondition, onProceedPlain }) {
  const chips = (
    <div className="flex flex-wrap gap-2">
      {conditions.map((c) => (
        <span
          key={c}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700"
        >
          {c}
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-white">
            <Check className="h-2.5 w-2.5" strokeWidth={3} />
          </span>
        </span>
      ))}
    </div>
  )

  return (
    <div className={`w-[320px] max-w-full rounded-2xl border border-indigo-100 bg-white shadow-sm overflow-hidden ${isSelf ? 'rounded-br-sm' : 'rounded-bl-sm'}`}>
      <div className="border-b border-slate-100 bg-indigo-50/60 px-4 py-3">
        <p className="text-sm font-bold text-slate-900">Preelly Inspection Conditions</p>
      </div>
      <div className="px-4 py-3">
        {chips}
        {comment && (
          <p className="mt-3 text-xs text-slate-500">
            <span className="font-semibold text-slate-600">Comment:</span> {comment}
          </p>
        )}

        {isSelf ? (
          status === 'approved' ? (
            <div className="mt-3">
              <p className="text-sm font-medium text-green-600">
                Approved — these conditions are locked for the Preelly inspection.
              </p>
              <button
                type="button"
                onClick={onProceed}
                className="mt-2.5 w-full rounded-lg bg-[#1414e6] py-2 text-sm font-semibold text-white hover:bg-[#1010c4]"
              >
                Proceed to cart
              </button>
            </div>
          ) : status === 'rejected' ? (
            <div className="mt-3">
              <p className="text-sm font-medium text-red-500">Seller rejected these conditions.</p>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onNewCondition}
                  className="flex-1 rounded-lg border border-[#1414e6] py-2 text-sm font-semibold text-[#1414e6] hover:bg-indigo-50"
                >
                  New Condition
                </button>
                <button
                  type="button"
                  onClick={onProceedPlain}
                  className="flex-1 rounded-lg bg-[#1414e6] py-2 text-sm font-semibold text-white hover:bg-[#1010c4]"
                >
                  Proceed to cart
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-amber-600">
              Your selected inspection conditions are awaiting seller approval. Once approved, they
              will be locked for the Preelly inspection.
            </p>
          )
        ) : status === 'approved' ? (
          <p className="mt-3 text-sm font-medium text-green-600">You approved these conditions</p>
        ) : status === 'rejected' ? (
          <p className="mt-3 text-sm font-medium text-red-500">You rejected these conditions</p>
        ) : (
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={onApprove}
              className="flex-1 rounded-full bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={onReject}
              className="flex-1 rounded-full bg-violet-100 py-2.5 text-sm font-medium text-violet-700 hover:bg-violet-200"
            >
              Reject
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function OfferBubble({ amount, isSelf, senderName, senderAvatar, locked = false, onAccept, onReject, onCounter }) {
  const [counter, setCounter] = useState('')
  const [done, setDone] = useState(null) // 'accepted' | 'rejected' | 'countered'

  // The person who made the offer sees a compact read-only summary.
  if (isSelf) {
    return (
      <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl rounded-br-sm border border-violet-200 bg-violet-50 shadow-sm">
        <span className="text-sm text-gray-700">You offered</span>
        <span className="text-sm font-bold text-violet-700">AED {amount}</span>
      </div>
    )
  }

  const submitCounter = () => {
    const val = Number(String(counter).replace(/[^0-9.]/g, ''))
    if (!val || val <= 0) { toast.error('Enter a valid counter offer'); return }
    onCounter(val)
    setDone('countered')
  }

  return (
    <div className={`w-[300px] max-w-full rounded-2xl rounded-bl-sm border border-gray-200 bg-white shadow-sm overflow-hidden ${locked ? 'opacity-60' : ''}`}>
      <div className="px-4 pt-4 pb-4 border-b border-gray-100 text-center">
        <p className="text-base font-bold text-gray-900">Offer For Your Ad</p>
        <div className="mt-4 flex flex-col items-center gap-2">
          <Ava src={senderAvatar} name={senderName} size={56} />
          <span className="text-sm font-semibold text-gray-900">{senderName || 'Buyer'}</span>
        </div>
        <p className="mt-4 text-sm text-gray-700">
          You have got an offer of{' '}
          <span className="text-blue-400 font-medium">AED</span>{' '}
          <span className="text-lg font-bold text-blue-600">{amount}</span>
        </p>
      </div>

      <div className="px-4 py-3">

        {done === 'accepted' ? (
          <p className="mt-3 text-sm font-medium text-green-600">You accepted this offer</p>
        ) : done === 'rejected' ? (
          <p className="mt-3 text-sm font-medium text-red-500">You rejected this offer</p>
        ) : done === 'countered' ? (
          <p className="mt-3 text-sm font-medium text-violet-600">Counter offer sent</p>
        ) : locked ? (
          <p className="mt-3 text-sm font-medium text-gray-500">This offer is closed</p>
        ) : (
          <>
            <input
              type="text"
              inputMode="numeric"
              value={counter}
              onChange={e => setCounter(e.target.value)}
              placeholder="Enter your counter offer"
              className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
            <button
              type="button"
              onClick={() => { onAccept(); setDone('accepted') }}
              className="mt-3 w-full rounded-full bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700"
            >
              Accept
            </button>
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => { onReject(); setDone('rejected') }}
                className="flex-[0.85] rounded-full bg-violet-100 py-2.5 text-sm font-medium text-violet-700 hover:bg-violet-200"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={submitCounter}
                className="flex-[1.15] rounded-full bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Send Counter offer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Ava({ src, name = '?', size = 40, online = false }) {
  const s = size
  return (
    <div className="relative shrink-0" style={{ width: s, height: s }}>
      {src ? (
        <img src={safeUrl(src)} alt={name}
          className="rounded-full object-cover w-full h-full" />
      ) : (
        <div
          className="rounded-full flex items-center justify-center text-white font-bold select-none"
          style={{
            width: s, height: s, fontSize: Math.round(s * 0.38),
            background: 'linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%)',
          }}
        >
          {(name?.[0] ?? '?').toUpperCase()}
        </div>
      )}
      {online && (
        <span
          className="absolute rounded-full bg-green-500 border-2 border-white"
          style={{ width: Math.max(8, s * 0.24), height: Math.max(8, s * 0.24), bottom: 0, right: 0 }}
        />
      )}
    </div>
  )
}

// ── Chat-list row ─────────────────────────────────────────────────────────────
function ChatRow({ thread, userId, isActive, onClick }) {
  const isGroup = thread.isGroup
  const isBuyer = thread.buyer?.id && String(thread.buyer.id) === String(userId)
  const other   = isGroup
    ? { name: thread.groupName, avatar: thread.groupAvatar || null }
    : (isBuyer ? thread.seller : thread.buyer)
  const unread  = isGroup ? (thread.unreadForMe || 0) : (isBuyer ? (thread.unreadForBuyer || 0) : (thread.unreadForSeller || 0))
  const groupSubtitle = isGroup ? `${(thread.participants || []).length} members` : null

  const lastMsg = useMemo(() => {
    const real = (thread.messages || []).filter(m => m.id !== 'last-message')
    if (!real.length) return thread.lastMessage || ''
    const m = real[real.length - 1]
    if (m.type === 'call') {
      const isVideo = m.callMeta?.callType === 'video'
      const missed  = ['missed','rejected','cancelled'].includes(m.callMeta?.status)
      return missed
        ? `📵 Missed ${isVideo ? 'video' : 'voice'} call`
        : `${isVideo ? '📹' : '📞'} ${isVideo ? 'Video' : 'Voice'} call`
    }
    return m.senderId === userId ? `You: ${m.text}` : m.text
  }, [thread.messages, thread.lastMessage, userId])

  const title = thread.type === 'support'
    ? 'Support'
    : isGroup
      ? thread.groupName
      : thread.productTitle || other?.name || 'Chat'

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-purple-50/60 transition-colors text-left ${
        isActive ? 'bg-purple-50 border-l-4 border-purple-600' : 'border-l-4 border-transparent'
      }`}
    >
      <Ava src={other?.avatar || other?.image} name={other?.name} size={46} online={unread > 0} />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1">
          <span className={`text-sm font-bold leading-snug truncate ${isActive ? 'text-purple-700' : 'text-gray-900'}`}>
            {title}
          </span>
          <span className="text-[11px] text-gray-400 shrink-0 mt-0.5">{fmtTime(thread.updatedAt)}</span>
        </div>

        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs text-gray-500 truncate">{groupSubtitle || other?.name || 'User'}</span>
          {unread > 0 && <span className="h-1.5 w-1.5 rounded-full bg-purple-600 shrink-0" />}
        </div>

        {unread > 0 ? (
          <p className="text-xs font-semibold text-green-600 mt-0.5">
            {unread > 5 ? '5+ new messages' : `${unread} new message${unread > 1 ? 's' : ''}`}
          </p>
        ) : (
          <div className="flex items-center gap-1 mt-0.5">
            {thread.productImage && (
              <ImageIcon className="h-3 w-3 text-gray-400 shrink-0" />
            )}
            <p className="text-xs text-gray-400 truncate">{lastMsg}</p>
          </div>
        )}
      </div>
    </button>
  )
}

// ── Sidebar — matches HomePage sidebar design ────────────────────────────────
function ChatSidebar({ chatUnread }) {
  const dispatch        = useDispatch()
  const navigate        = useNavigate()
  const { pathname }    = useLocation()
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const { rootCategories } = useSelector((state) => state.categories)

  useEffect(() => {
    if (rootCategories.length === 0) dispatch(fetchRootCategories())
  }, [dispatch, rootCategories.length])

  const quickLinks = [
    { label: 'My Bookmarks', to: isAuthenticated ? '/my-profile?tab=saved' : '/login', icon: Bookmark },
    { label: 'Messages',     to: '/chat', icon: MessageCircle, badge: chatUnread > 0 ? chatUnread : null },
    { label: 'Settings',     to: isAuthenticated ? '/dashboard/settings' : '/login', icon: Settings },
  ]

  return (
    <aside className="h-full overflow-y-auto border-r border-slate-200 bg-white p-5">

      {/* Post Your Ad */}
      <Link
        to={isAuthenticated ? '/post-ad' : '/login'}
        className="mb-6 flex items-center justify-center gap-2 w-full rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Post Your Ad
      </Link>

      {/* Categories — same component as the search listing sidebar */}
      {rootCategories.length > 0 && (
        <div className="mb-8">
          <Link
            to="/categories"
            className="mb-3 inline-block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 transition hover:text-primary-700"
          >
            Categories
          </Link>
          <SidebarCategoryList
            categories={rootCategories}
            onSelect={(cat) => navigate(`/categories/${cat._id || cat.id}/products`)}
          />
        </div>
      )}

      {/* Quick Links */}
      <div className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2">
          Quick Links
        </p>
        <div className="space-y-0.5">
          {quickLinks.map(({ label, to, icon: Icon, badge }) => {
            const active = to === '/chat' ? pathname.startsWith('/chat') : pathname === to
            return (
              <Link
                key={label}
                to={to}
                className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition hover:bg-slate-100 ${
                  active ? 'bg-primary-50 text-primary-800' : 'text-slate-700'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-primary-600' : 'text-slate-500'}`} />
                <span className="flex-1 truncate">{label}</span>
                {badge != null && (
                  <span className="inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-purple-600 text-white text-[10px] font-bold">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Popular Categories */}
      {rootCategories.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2">
            Popular Categories
          </p>
          <div className="space-y-0.5">
            {rootCategories.slice(0, 4).map((cat) => (
              <Link
                key={cat._id || cat.id}
                to={`/search?q=${encodeURIComponent(cat.name)}`}
                className="block text-sm text-slate-600 rounded-2xl px-3 py-2 transition hover:text-primary-700 hover:bg-slate-50"
              >
                {cat.name}
              </Link>
            ))}
          </div>
        </div>
      )}

    </aside>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ChatInboxPage() {
  const navigate        = useNavigate()
  const { threadId: urlId } = useParams()
  const [urlSearchParams, setUrlSearchParams] = useSearchParams()
  // `?tab=Cart` deep-links straight into a tab (e.g. "My Cart" in the dashboard).
  const urlTab = TABS.find(
    (t) => t.toLowerCase() === String(urlSearchParams.get('tab') || '').toLowerCase(),
  )
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const currentUser     = useSelector(selectUser)
  const {
    threads, loading: threadsLoading,
    getThreadById, sendMessage, markThreadRead, refreshChats,
  } = useChat()
  const { startCall } = useCall()

  // Force-load threads when the chat page mounts (ChatContext's auto-load
  // may have already run with a different pathname before navigation settled)
  useEffect(() => {
    refreshChats()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [activeId,     setActiveId]     = useState(urlId || null)
  const [activeThread, setActiveThread] = useState(null)
  const [loadingThread, setLoadingThread] = useState(false)
  const [cartCount, setCartCount] = useState(0)
  // Preelly Pay inspection-conditions popup (buyer gates "Proceed to cart" behind
  // choosing conditions + seller approval). Conditions/charge come from the DB.
  const [preellyModalOpen, setPreellyModalOpen] = useState(false)
  const [preellyConditionsList, setPreellyConditionsList] = useState([])
  const [preellyCharge, setPreellyCharge] = useState(PREELLY_PAY_CHARGE)
  const [search,  setSearch]  = useState('')
  const [tab,     setTab]     = useState(urlTab || 'All')
  // Product ids in the buyer's completed (PURCHASED) carts — drives the Cart tab.
  const [purchasedProductIds, setPurchasedProductIds] = useState(() => new Set())

  /** Switch tab and mirror it in the URL so refreshing keeps the same view. */
  const selectTab = useCallback((next) => {
    setTab(next)
    setUrlSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (next === 'All') params.delete('tab')
        else params.set('tab', next)
        return params
      },
      { replace: true },
    )
  }, [setUrlSearchParams])
  const [text,    setText]    = useState('')
  const [sending, setSending] = useState(false)
  const [mobileTh, setMobileTh] = useState(!!urlId)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const [attachFiles, setAttachFiles] = useState([])
  const [offerOpen, setOfferOpen] = useState(false)
  const [offerAmount, setOfferAmount] = useState('')
  const [soldModalOpen, setSoldModalOpen] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)

  const bottomRef        = useRef(null)
  const messagesContainerRef = useRef(null)
  const scrolledThreadRef = useRef(null)
  const inputRef         = useRef(null)
  const fileRef          = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef   = useRef([])
  const recordingTimerRef = useRef(null)

  const fmtRecTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const startRecording = async () => {
    if (isRecording) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = ['audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported(t)) || ''
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {})
      audioChunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = () => {
        // Stop tracks and exit recording state first so React 18 batches both updates together
        stream.getTracks().forEach((t) => t.stop())
        const chunks = audioChunksRef.current.slice()
        const type = mr.mimeType || mimeType || 'audio/webm'
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : type.includes('aac') ? 'aac' : 'webm'
        const blob = new Blob(chunks, { type })
        if (blob.size > 0) {
          setAttachFiles([new File([blob], `voice-${Date.now()}.${ext}`, { type })])
        } else {
          toast.error('Recording was empty, please try again')
        }
        setIsRecording(false)
      }
      mediaRecorderRef.current = mr
      mr.start(250)
      setIsRecording(true)
      setRecordingTime(0)
      recordingTimerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000)
    } catch (err) {
      const msg = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
        ? 'Microphone access denied'
        : 'Could not start recording'
      toast.error(msg)
    }
  }

  const stopRecording = () => {
    clearInterval(recordingTimerRef.current)
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
        // onstop handler will call setIsRecording(false) + setAttachFiles in one batch
      } else {
        setIsRecording(false)
      }
    } catch {
      setIsRecording(false)
    }
  }

  useEffect(() => () => {
    clearInterval(recordingTimerRef.current)
    try { if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop() } catch { /* ignore */ }
  }, [])

  // total unread for sidebar badge
  const chatUnread = useMemo(() => threads.reduce((sum, t) => {
    if (t.isGroup) return sum + (t.unreadForMe || 0)
    const isBuyer = t.buyer?.id && String(t.buyer.id) === String(currentUser?._id)
    return sum + (isBuyer ? (t.unreadForBuyer || 0) : (t.unreadForSeller || 0))
  }, 0), [threads, currentUser?._id])

  // sync URL → state
  useEffect(() => {
    if (urlId && urlId !== activeId) { setActiveId(urlId); setMobileTh(true) }
  }, [urlId]) // eslint-disable-line

  useEffect(() => {
    if (urlTab && urlTab !== tab) setTab(urlTab)
  }, [urlTab]) // eslint-disable-line

  // load thread
  useEffect(() => {
    if (!activeId) return
    let dead = false
    setLoadingThread(true)
    getThreadById(activeId)
      .then(t => {
        if (dead || !t) return
        setActiveThread(t)
        if (t.isGroup) {
          markThreadRead(t.id, 'group')
        } else {
          const isBuyer = t.buyer?.id && String(t.buyer.id) === String(currentUser?._id)
          markThreadRead(t.id, isBuyer ? 'buyer' : 'seller')
        }
      })
      .finally(() => { if (!dead) setLoadingThread(false) })
    return () => { dead = true }
  }, [activeId]) // eslint-disable-line

  // sync socket updates
  const realCount = (msgs) =>
    (msgs || []).filter(m => m.id !== 'last-message' && !String(m.id).startsWith('temp-')).length
  useEffect(() => {
    if (!activeId) return
    const ctx = threads.find(t => t.id === activeId)
    if (!ctx) return
    setActiveThread(prev => {
      // No active thread yet, or a different thread is selected → adopt the list row
      // (the full thread with messages lands right after via getThreadById).
      if (!prev || prev.id !== activeId) return ctx
      // Never downgrade a fully-loaded thread to the lightweight inbox row, which
      // carries no messages. Only adopt ctx when it actually has new messages.
      const prevIds = new Set((prev.messages || []).map(m => m.id).filter(id => !id.startsWith('temp-')))
      const hasNew  = (ctx.messages || []).some(m => m.id !== 'last-message' && !prevIds.has(m.id))
      if (!hasNew) return prev
      if (realCount(ctx.messages) < realCount(prev.messages)) return prev
      return ctx
    })
  }, [threads, activeId])

  // Self-heal: if the open thread resolved with no messages but its inbox row shows
  // there IS a conversation (a last message exists), refetch it once. Guards against
  // any race where the lightweight inbox row replaced the fully-loaded thread.
  const healedThreadRef = useRef(null)
  useEffect(() => {
    if (!activeThread || loadingThread) return
    if (realCount(activeThread.messages) > 0) { healedThreadRef.current = null; return }
    const row = threads.find(t => t.id === activeThread.id)
    const rowHasConversation = Boolean(
      (row?.lastMessage && String(row.lastMessage).trim()) ||
      (row?.messages || []).some(m => m.id !== 'last-message')
    )
    if (rowHasConversation && healedThreadRef.current !== activeThread.id) {
      healedThreadRef.current = activeThread.id
      getThreadById(activeThread.id).then(t => { if (t && realCount(t.messages) > 0) setActiveThread(t) })
    }
  }, [activeThread, threads, loadingThread]) // eslint-disable-line

  // Auto scroll — move only the messages container, never the window.
  // scrollIntoView bubbles to every scrollable ancestor (including the page),
  // which is what made the whole page jump on send.
  // On first open of a thread, jump instantly to the last message; for new
  // messages that arrive while the thread is open, glide smoothly.
  useEffect(() => {
    const el = messagesContainerRef.current
    // Skip while the thread is still loading — the container shows a skeleton then,
    // so scrolling now would target the skeleton, not the real messages. Re-runs
    // once loadingThread flips to false and the messages are actually rendered.
    if (!el || !activeThread?.id || loadingThread) return
    const isNewThread = scrolledThreadRef.current !== activeThread.id
    // A thread opened from the left list arrives before its messages load — wait
    // until real messages are present so the first jump lands on the last message.
    if (isNewThread && realCount(activeThread.messages) === 0) return
    if (isNewThread) scrolledThreadRef.current = activeThread.id
    // Two frames so the freshly rendered message list (and its media) is laid out
    // and scrollHeight is final before we jump.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.scrollTo({ top: el.scrollHeight, behavior: isNewThread ? 'auto' : 'smooth' })
      })
    })
  }, [activeThread?.id, activeThread?.messages?.length, loadingThread])

  const openThread = useCallback(id => {
    setActiveId(id); setMobileTh(true)
    navigate(`/chat/${id}`, { replace: true })
  }, [navigate])

  const doSend = async (msg = text.trim(), files = attachFiles) => {
    if (!msg && files.length === 0) return
    if (!activeId || !activeThread || sending) return
    // Blocked threads are read-only (either direction).
    if (activeThread.blockedByMe || activeThread.blockedMe) {
      toast.error(activeThread.blockedByMe
        ? "You've blocked this account. Unblock them to send messages."
        : "You can't send messages in this chat.")
      return
    }
    // A sold product can no longer be chatted about or offered on (1:1 threads only).
    if (!activeThread.isGroup && activeThread.productSold) { setSoldModalOpen(true); return }
    setText('')
    setAttachFiles([])
    setSending(true)
    const isBuyer = activeThread.buyer?.id && String(activeThread.buyer.id) === String(currentUser?._id)
    const senderRole = activeThread.isGroup ? null : (isBuyer ? 'buyer' : 'seller')
    try {
      await sendMessage(activeId, { senderId: currentUser._id, senderRole, text: msg, files: files.length > 0 ? files : null })
    } catch (err) {
      setText(msg)
      if (files.length > 0) setAttachFiles(files)
      toast.error(err?.response?.data?.message || 'Failed to send message')
    } finally { setSending(false); inputRef.current?.focus({ preventScroll: true }) }
  }

  const handleKey = e => { if (e.key === 'Enter' && !e.shiftKey && !attachFiles.length) { e.preventDefault(); doSend() } }

  // A quick-reply chip either sends its text, or — for "Make an offer" — opens the offer modal.
  const handleQuickReply = qr => {
    if (!activeThread?.isGroup && activeThread?.productSold) { setSoldModalOpen(true); return }
    if (qr === 'Make an offer') { setOfferAmount(''); setOfferOpen(true) }
    else doSend(qr)
  }

  const sendOffer = () => {
    const amount = Number(String(offerAmount).replace(/[^0-9.]/g, ''))
    if (!amount || amount <= 0) { toast.error('Enter a valid offer amount'); return }
    doSend(`💰 Offer: AED ${amount.toLocaleString()}`)
    setOfferOpen(false)
    setOfferAmount('')
  }

  // Accept an offer: notify the chat AND add the product to the buyer's cart.
  // Either party can accept; the backend always files it under the buyer's id.
  const acceptOffer = async (amountStr) => {
    const amount = Number(String(amountStr).replace(/[^0-9.]/g, ''))
    doSend(`✅ Offer accepted for AED ${amountStr}`)
    try {
      await cartService.addFromOffer(activeId, amount)
      toast.success('Product added to cart')
      refreshCartCount()
    } catch {
      toast.error('Could not add product to cart')
    }
  }

  // filtered list
  const filtered = useMemo(() => threads.filter(t => {
    const isGroup = t.isGroup
    const isBuyer = t.buyer?.id && String(t.buyer.id) === String(currentUser?._id)
    const other   = isGroup ? { name: t.groupName } : (isBuyer ? t.seller : t.buyer)
    const unread  = isGroup ? (t.unreadForMe || 0) : (isBuyer ? (t.unreadForBuyer || 0) : (t.unreadForSeller || 0))
    if (search) {
      const q = search.toLowerCase()
      const last = (t.messages || []).filter(m => m.id !== 'last-message').slice(-1)[0]?.text || ''
      const memberNames = isGroup ? (t.participants || []).map(p => p.name).join(' ') : ''
      if (!(other?.name || '').toLowerCase().includes(q) &&
          !(t.productTitle || '').toLowerCase().includes(q) &&
          !memberNames.toLowerCase().includes(q) &&
          !last.toLowerCase().includes(q)) return false
    }
    // Groups aren't buying/selling threads — only show under All/Unread.
    if (tab === 'Buying'  && (isGroup || !isBuyer)) return false
    if (tab === 'Selling' && (isGroup || isBuyer))  return false
    if (tab === 'Unread'  && unread === 0) return false
    // Cart: product threads the user has bought (cart row reached PURCHASED).
    if (tab === 'Cart' && (isGroup || !t.productId || !purchasedProductIds.has(String(t.productId)))) {
      return false
    }
    return true
  }), [threads, search, tab, currentUser?._id, purchasedProductIds])

  const otherParty = useMemo(() => {
    if (!activeThread || !currentUser) return null
    if (activeThread.type === 'support') return { name: 'Support', avatar: null }
    if (activeThread.isGroup) {
      return {
        name: activeThread.groupName,
        avatar: activeThread.groupAvatar || null,
        isGroup: true,
        memberCount: (activeThread.participants || []).length,
      }
    }
    const isBuyer = activeThread.buyer?.id && String(activeThread.buyer.id) === String(currentUser._id)
    return isBuyer ? activeThread.seller : activeThread.buyer
  }, [activeThread, currentUser])

  // Is the current user the BUYER of this thread? The cart icon/count is a
  // buyer-only affordance (carts are always filed under the buyer).
  const isBuyer = useMemo(() => {
    if (!activeThread || !currentUser || activeThread.type === 'support') return false
    return activeThread.buyer?.id && String(activeThread.buyer.id) === String(currentUser._id)
  }, [activeThread, currentUser])

  // ── Thread actions: block / report / mute ──────────────────────────────────
  const [menuOpen, setMenuOpen] = useState(false)
  const [muting, setMuting] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportDetails, setReportDetails] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)

  // Block/report target only exists for 1:1 product chats (not support/groups).
  const is1to1 = Boolean(activeThread && !activeThread.isGroup && activeThread.type !== 'support')
  const otherPartyId = is1to1 ? (otherParty?.id || null) : null
  const isMuted = Boolean(activeThread?.muted)
  const [blocking, setBlocking] = useState(false)
  const [showBlockFlow, setShowBlockFlow] = useState(false)
  const [showUnblockConfirm, setShowUnblockConfirm] = useState(false)

  // A blocked thread is read-only for both sides; the copy differs by who blocked whom.
  const blockedByMe = Boolean(is1to1 && activeThread?.blockedByMe)
  const blockedMe = Boolean(is1to1 && activeThread?.blockedMe)
  const isBlocked = blockedByMe || blockedMe
  const blockNotice = blockedByMe
    ? {
        title: "You've blocked this account",
        subtitle: `You can't message ${otherParty?.name || 'this user'} until you unblock them.`,
      }
    : {
        title: `${otherParty?.name || 'This account'} has blocked you`,
        subtitle: "You can't send messages in this chat.",
      }

  const blockTargetUser = useMemo(() => {
    if (!otherPartyId) return null
    return {
      _id: otherPartyId,
      name: otherParty?.name,
      displayName: otherParty?.name,
      avatar: otherParty?.avatar,
      role: otherParty?.role,
    }
  }, [otherPartyId, otherParty])

  const handleToggleMute = async () => {
    if (!activeId || muting) return
    setMuting(true)
    try {
      const res = await chatService.toggleMute(activeId)
      const muted = Boolean(res?.data?.muted)
      setActiveThread((prev) => (prev && prev.id === activeId ? { ...prev, muted } : prev))
      toast.success(muted ? 'Notifications muted' : 'Notifications unmuted')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update notifications')
    } finally {
      setMuting(false)
    }
  }

  const openBlockOrUnblock = () => {
    if (!otherPartyId || blocking) return false
    if (blockedByMe) {
      setShowUnblockConfirm(true)
      return true
    }
    setShowBlockFlow(true)
    return true
  }

  const applyBlockedState = (blocked) => {
    setActiveThread((prev) => (prev && prev.id === activeId ? { ...prev, blockedByMe: blocked } : prev))
    refreshChats()
  }

  const openReport = () => {
    setReportReason('')
    setReportDetails('')
    setReportOpen(true)
  }

  const moreOptions = useMemo(
    () =>
      buildChatMoreOptions({
        is1to1,
        blockedByMe,
        blocking,
        muting,
        isMuted,
        onBlock: openBlockOrUnblock,
        onReport: openReport,
        onMute: handleToggleMute,
      }),
    // Handlers close over latest thread/user state; rebuild when those change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [is1to1, blockedByMe, blocking, muting, isMuted, activeId, otherPartyId, otherParty?.name]
  )

  const submitReport = async () => {
    if (!activeId || !reportReason || reportSubmitting) return
    setReportSubmitting(true)
    try {
      await chatService.reportUser(activeId, {
        reason: reportReason,
        details: reportDetails,
        reportedUserId: otherPartyId || undefined,
      })
      toast.success('Report submitted. Our team will review it.')
      setReportOpen(false)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to submit report')
    } finally {
      setReportSubmitting(false)
    }
  }

  // Count this thread's product in the buyer's active cart.
  const refreshCartCount = useCallback(async () => {
    const productId = activeThread?.productId
    if (!isBuyer || !productId) { setCartCount(0); return }
    try {
      const res = await cartService.getCart()
      const items = res?.data?.data || []
      const count = items
        .filter(it => String(it.productId?._id || it.productId) === String(productId))
        .reduce((n, it) => n + (it.quantity || 1), 0)
      setCartCount(count)
    } catch {
      setCartCount(0)
    }
  }, [isBuyer, activeThread?.productId])

  useEffect(() => { refreshCartCount() }, [refreshCartCount])

  // The Cart tab lists threads whose product the user has bought — i.e. a cart
  // row that reached cartStatus PURCHASED. Loaded once per visit (and whenever
  // the tab is opened) rather than per-thread, since it filters the whole list.
  useEffect(() => {
    if (tab !== 'Cart') return undefined
    let cancelled = false
    cartService
      .getCart({ cartStatus: 'PURCHASED' })
      .then((res) => {
        if (cancelled) return
        const items = res?.data?.data || []
        setPurchasedProductIds(
          new Set(items.map((it) => String(it.productId?._id || it.productId)).filter(Boolean)),
        )
      })
      .catch(() => {
        if (!cancelled) setPurchasedProductIds(new Set())
      })
    return () => {
      cancelled = true
    }
  }, [tab])

  // An offer card is locked (grayed, no further action) only once a RESPONSE
  // action — accept, reject, or a counter offer — follows it in the thread. The
  // latest, still-unanswered offer stays actionable, and this survives refresh
  // because it's derived purely from message order.
  const lockedOfferIds = useMemo(() => {
    const msgs = (activeThread?.messages || []).filter(m => m.id !== 'last-message')
    const set = new Set()
    msgs.forEach((m, i) => {
      if (!parseOfferAmount(m.text)) return
      if (msgs.slice(i + 1).some(mm => isOfferAction(mm.text))) set.add(m.id)
    })
    return set
  }, [activeThread])

  const goToCart = useCallback(() => {
    navigate(`/cart${activeThread?.productId ? `?productId=${activeThread.productId}` : ''}`)
  }, [navigate, activeThread?.productId])

  // Proceed to cart carrying the seller-approved Preelly conditions, so the cart
  // page pre-selects "Pay Through Preelly" and shows the locked conditions.
  const goToCartWithPreelly = useCallback((conditions, comment) => {
    navigate(`/cart${activeThread?.productId ? `?productId=${activeThread.productId}` : ''}`, {
      state: { preellyApproved: true, preellyConditions: conditions, preellyComment: comment },
    })
  }, [navigate, activeThread?.productId])

  // Load this product's inspection conditions + the Preelly Pay charge so the
  // popup mirrors the cart page exactly. The cart endpoint already resolves the
  // product's multi-select features to labels, so we read from there first (the
  // product is in the buyer's cart after the offer is accepted); if it isn't in
  // the cart yet we fall back to the product detail API. Buyer-only.
  useEffect(() => {
    const pid = activeThread?.productId
    if (!isBuyer || !pid) {
      setPreellyConditionsList([])
      setPreellyCharge(PREELLY_PAY_CHARGE)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const [cartRes, sRes] = await Promise.all([
          cartService.getCart().catch(() => null),
          checkoutServicePublicService.listActiveCheckoutServices().catch(() => null),
        ])
        if (cancelled) return

        const items = cartRes?.data?.data || []
        const match = items.find(
          (it) => String(it.productId?._id || it.productId) === String(pid),
        )
        let product = match?.productId
        if (!product || typeof product !== 'object') {
          const pRes = await productService.getProductById(pid).catch(() => null)
          if (cancelled) return
          product = pRes?.data || null
        }
        setPreellyConditionsList(derivePreellyConditions(product))

        const svcs = sRes?.data?.data || []
        const svc = svcs.find((s) => s.serviceName?.toLowerCase().includes('preelly'))
        setPreellyCharge(Number(svc?.price ?? PREELLY_PAY_CHARGE))
      } catch {
        if (!cancelled) setPreellyConditionsList([])
      }
    })()
    return () => { cancelled = true }
  }, [isBuyer, activeThread?.productId])

  // Approve/reject status for each Preelly request message, derived from the
  // first response that follows it — so it survives refresh like offer locking.
  const preellyStatusById = useMemo(() => {
    const msgs = (activeThread?.messages || []).filter(m => m.id !== 'last-message')
    const map = new Map()
    msgs.forEach((m, i) => {
      if (!isPreellyRequest(m.text)) return
      const resp = msgs.slice(i + 1).find(mm => isPreellyResponse(mm.text))
      if (resp) map.set(m.id, isPreellyApprove(resp.text) ? 'approved' : 'rejected')
    })
    return map
  }, [activeThread])

  // "Proceed to cart" → always gate on the Preelly Pay popup first. Conditions
  // load asynchronously and stream into the open modal as they arrive.
  const handleProceedClick = () => {
    setPreellyModalOpen(true)
  }

  // Seller approved the conditions → notify the chat AND persist them onto the
  // buyer's cart row so the cart/checkout page shows them regardless of nav.
  const handleApprovePreelly = async (conditions, comment) => {
    doSend(PREELLY_APPROVE_MSG)
    try {
      await cartService.savePreellyConditions(activeId, conditions, comment)
    } catch {
      /* non-fatal: the approval message is already in the thread */
    }
  }

  // Buyer declined Preelly Pay → record the opt-out in the DB and go to cart.
  const handleNotInterestedPreelly = async () => {
    setPreellyModalOpen(false)
    try {
      await cartService.setPreellyNotInterested(activeId)
    } catch {
      /* non-fatal: still take the buyer to the cart */
    }
    navigate(`/cart${activeThread?.productId ? `?productId=${activeThread.productId}` : ''}`)
  }

  // Buyer confirmed the popup → send the conditions to the seller for approval.
  const handleConfirmPreellyChat = (selected, comment) => {
    if (!selected || selected.length === 0) {
      toast.error('Select at least one condition')
      return
    }
    setPreellyModalOpen(false)
    doSend(buildPreellyRequestText(selected, comment))
  }

  const grouped = useMemo(() => {
    if (!activeThread) return []
    return groupMsgs((activeThread.messages || []).filter(m => m.id !== 'last-message'))
  }, [activeThread])

  if (!isAuthenticated) {
    return (
      <div className="h-[100dvh] overflow-hidden bg-[#f7f8fa]">
        <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
          <MarketplaceTopBar topBarColSpan="" onToggleMobileMenu={() => navigate('/login')} />
          <div className="flex items-center justify-center px-4">
            <div className="text-center">
              <p className="mb-4 text-gray-500">Please log in to view your messages.</p>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white"
              >
                Login
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#f7f8fa]">
      {mobileMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-[60] bg-black/40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-[70] w-[min(320px,88vw)] overflow-y-auto bg-white p-5 shadow-2xl lg:hidden">
            <div className="mb-5 flex items-center justify-between">
              <Link to="/" onClick={() => setMobileMenuOpen(false)}>
                <BrandLogo variant="light" className="h-8 w-auto" />
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl p-2 text-slate-600 hover:bg-slate-100"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ChatSidebar chatUnread={chatUnread} />
          </aside>
        </>
      )}

      <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] grid-cols-1 lg:grid-cols-[270px_minmax(0,1fr)]">
        <div className={MARKETPLACE_LOGO_CELL}>
          <MarketplaceLogoBlock />
        </div>

        <MarketplaceTopBar topBarColSpan="" onToggleMobileMenu={() => setMobileMenuOpen(true)} />

        <aside className="hidden min-h-0 overflow-y-auto border-r border-slate-200 bg-white lg:block">
          <ChatSidebar chatUnread={chatUnread} />
        </aside>

        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden p-3 sm:p-4 lg:p-5">

        {/* ── Two-panel ───────────────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 border border-gray-200 rounded-2xl overflow-hidden flex bg-white shadow-sm">

          {/* ═══ LEFT: conversation list ═══ */}
          <div className={`flex flex-col shrink-0 border-r border-gray-200 ${mobileTh ? 'hidden md:flex' : 'flex'} w-full md:w-[280px] lg:w-[300px]`}>

            {/* search */}
            <div className="px-3 py-3 border-b border-gray-100">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search messages..."
                  className="w-full h-9 pl-9 pr-8 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 transition" />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* tabs */}
            <div className="flex border-b border-gray-100 px-1">
              {TABS.map(t => (
                <button key={t} onClick={() => selectTab(t)}
                  className={`flex-1 py-2.5 text-xs font-semibold transition-colors relative ${
                    tab === t ? 'text-purple-600' : 'text-gray-500 hover:text-gray-700'
                  }`}>
                  {t}
                  {tab === t && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 rounded-full" />
                  )}
                </button>
              ))}
            </div>

            {/* list */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {threadsLoading ? (
                [...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-4 animate-pulse">
                    <div className="h-11 w-11 rounded-full bg-gray-200 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-3/4" />
                      <div className="h-2.5 bg-gray-200 rounded w-1/2" />
                      <div className="h-2.5 bg-gray-200 rounded w-2/3" />
                    </div>
                  </div>
                ))
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-2">
                  <div className="h-12 w-12 rounded-full bg-purple-50 flex items-center justify-center">
                    <BubbleIcon className="h-6 w-6 text-purple-300" />
                  </div>
                  <p className="text-sm font-semibold text-gray-600 mt-1">
                    {search ? 'No results found' : 'No conversations yet'}
                  </p>
                  {!search && <p className="text-xs text-gray-400">Start chatting from any product page.</p>}
                </div>
              ) : (
                filtered.map(t => (
                  <ChatRow key={t.id} thread={t} userId={currentUser?._id}
                    isActive={t.id === activeId} onClick={() => openThread(t.id)} />
                ))
              )}
            </div>
          </div>

          {/* ═══ RIGHT: thread ═══ */}
          <div className={`flex-1 flex flex-col min-w-0 ${!mobileTh ? 'hidden md:flex' : 'flex'}`}>

            {activeId ? (<>
              {/* header */}
              <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 bg-white shrink-0">
                <button className="md:hidden p-1 -ml-1 text-gray-500"
                  onClick={() => { setMobileTh(false); navigate('/chat', { replace: true }) }}>
                  <ArrowLeft className="h-5 w-5" />
                </button>

                <Ava src={otherParty?.avatar || otherParty?.image} name={otherParty?.name} size={46} online />

                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-gray-900 leading-tight truncate">
                    {otherParty?.name || 'User'}
                  </p>
                  {otherParty?.isGroup ? (
                    <p className="text-xs font-medium text-gray-500 mt-0.5 truncate">
                      {(activeThread?.participants || []).map(p => p.name).join(', ')}
                    </p>
                  ) : (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-green-500 mt-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                      Active Now
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {isBuyer && (
                    <button
                      title="View cart"
                      onClick={handleProceedClick}
                      className="relative text-gray-400 hover:opacity-80 transition-opacity"
                    >
                      <img src="/images/shopping_cart.png" alt="Cart" className="h-5 w-5 object-contain" />
                      {cartCount > 0 && (
                        <span className="absolute -top-2 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                          {cartCount}
                        </span>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setMenuOpen(true)}
                    aria-haspopup="dialog"
                    aria-expanded={menuOpen}
                    aria-label="Chat options"
                    className={`h-9 w-9 rounded-full flex items-center justify-center transition-colors duration-200 ${menuOpen ? 'bg-brand-50 text-brand' : 'text-gray-500 hover:bg-gray-100'}`}
                  >
                    <MoreVertical className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* messages */}
              <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 bg-gray-50/60">
                {loadingThread ? (
                  <div className="space-y-4 pt-2">
                    {[38, 55, 42, 60, 35].map((w, i) => (
                      <div key={i} className={`flex items-end gap-2 animate-pulse ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                        {i % 2 === 0 && <div className="h-8 w-8 rounded-full bg-gray-200 shrink-0" />}
                        <div className="h-10 bg-gray-200 rounded-2xl" style={{ width: `${w}%`, maxWidth: 260 }} />
                        {i % 2 !== 0 && <div className="h-8 w-8 rounded-full bg-gray-200 shrink-0" />}
                      </div>
                    ))}
                  </div>
                ) : grouped.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                    <BubbleIcon className="h-12 w-12 text-gray-200" />
                    <p className="text-sm text-gray-400">No messages yet — say hello!</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {grouped.map(group => (
                      <div key={group.label}>
                        {/* date divider */}
                        <div className="flex items-center gap-3 my-5">
                          <div className="flex-1 h-px bg-gray-200" />
                          <span className="text-xs text-gray-400">{group.label}</span>
                          <div className="flex-1 h-px bg-gray-200" />
                        </div>

                        <div className="space-y-3">
                          {group.msgs.map(m => {
                            const isSelf = m.senderId === currentUser?._id
                            const isTemp = m.id?.startsWith('temp-')
                            const offerAmount = parseOfferAmount(m.text)
                            return (
                              <div key={m.id}
                                className={`flex items-end gap-2 ${isSelf ? 'justify-end' : 'justify-start'}`}>

                                {!isSelf && (
                                  <Ava src={activeThread?.isGroup ? m.senderAvatar : (otherParty?.avatar || otherParty?.image)}
                                    name={activeThread?.isGroup ? m.senderName : otherParty?.name} size={32} />
                                )}

                                <div className={`flex flex-col max-w-[85%] sm:max-w-[75%] md:max-w-[65%] lg:max-w-[60%] ${isSelf ? 'items-end' : 'items-start'}`}>
                                  {!isSelf && activeThread?.isGroup && m.senderName && (
                                    <span className="mb-0.5 ml-1 text-[11px] font-semibold text-purple-600">{m.senderName}</span>
                                  )}
                                  {m.type === 'call' ? (
                                    <CallBubble message={m} isSelf={isSelf} />
                                  ) : offerAmount ? (
                                    <OfferBubble
                                      amount={offerAmount}
                                      isSelf={isSelf}
                                      senderName={otherParty?.name}
                                      senderAvatar={otherParty?.avatar || otherParty?.image}
                                      locked={lockedOfferIds.has(m.id) || isBlocked}
                                      onAccept={() => acceptOffer(offerAmount)}
                                      onReject={() => doSend('❌ Offer rejected')}
                                      onCounter={amt => doSend(`💰 Offer: AED ${amt.toLocaleString()}`)}
                                    />
                                  ) : isAcceptMessage(m.text) ? (
                                    <div className={`rounded-2xl px-4 py-3 border border-green-200 bg-green-50 shadow-sm ${isSelf ? 'rounded-br-sm' : 'rounded-bl-sm'}`}>
                                      <p className="text-sm font-medium text-green-700 whitespace-pre-wrap break-words">{m.text}</p>
                                      {isBuyer && (
                                        <button
                                          type="button"
                                          onClick={handleProceedClick}
                                          className="mt-2.5 w-full rounded-lg bg-[#1414e6] py-2 text-sm font-semibold text-white hover:bg-[#1010c4]"
                                        >
                                          Proceed to cart
                                        </button>
                                      )}
                                    </div>
                                  ) : isPreellyRequest(m.text) ? (() => {
                                    const { conditions, comment } = parsePreellyRequest(m.text)
                                    return (
                                      <PreellyRequestBubble
                                        conditions={conditions}
                                        comment={comment}
                                        isSelf={isSelf}
                                        status={preellyStatusById.get(m.id) || null}
                                        onApprove={() => handleApprovePreelly(conditions, comment)}
                                        onReject={() => doSend(PREELLY_REJECT_MSG)}
                                        onProceed={() => goToCartWithPreelly(conditions, comment)}
                                        onNewCondition={() => setPreellyModalOpen(true)}
                                        onProceedPlain={goToCart}
                                      />
                                    )
                                  })() : isPreellyResponse(m.text) ? (
                                    <div className={`rounded-2xl px-4 py-2.5 border shadow-sm ${isPreellyApprove(m.text) ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'} ${isSelf ? 'rounded-br-sm' : 'rounded-bl-sm'}`}>
                                      <p className={`text-sm font-medium whitespace-pre-wrap break-words ${isPreellyApprove(m.text) ? 'text-green-700' : 'text-red-600'}`}>{m.text}</p>
                                    </div>
                                  ) : (() => {
                                    // Only real attachments (with a url) — a text message can carry an empty {} subdoc.
                                    const atts = (m.attachments?.length > 0 ? m.attachments : (m.attachment ? [m.attachment] : [])).filter((a) => a && a.url)
                                    return atts.length > 0
                                  })() ? (() => {
                                    const atts = (m.attachments?.length > 0 ? m.attachments : (m.attachment ? [m.attachment] : [])).filter((a) => a && a.url)
                                    return (
                                      <div className={`rounded-2xl overflow-hidden border border-gray-200 shadow-sm ${isSelf ? 'rounded-br-sm' : 'rounded-bl-sm'}`}>
                                        <ChatAttachments attachments={atts} isTemp={isTemp} />
                                        {m.text ? <p className="px-4 py-2 text-sm text-gray-800 whitespace-pre-wrap break-words border-t border-gray-100 bg-white">{m.text}</p> : null}
                                      </div>
                                    )
                                  })() : (
                                  <div className={`px-4 py-2.5 rounded-2xl text-sm text-gray-800 leading-relaxed bg-white border border-gray-200 shadow-sm ${
                                    isSelf ? 'rounded-br-sm' : 'rounded-bl-sm'
                                  } ${isTemp ? 'opacity-60' : ''}`}>
                                    <p className="whitespace-pre-wrap break-words">{m.text}</p>
                                  </div>
                                  )}
                                  <div className={`flex items-center gap-1 mt-1 ${isSelf ? 'flex-row-reverse' : ''}`}>
                                    <span className="text-[10px] text-gray-400">{fmtMsgTime(m.createdAt)}</span>
                                    {m.type !== 'call' && isSelf && !isTemp && (
                                      m.readAt
                                        ? <CheckCheck className="h-3 w-3 text-purple-500" />
                                        : <Check className="h-3 w-3 text-gray-400" />
                                    )}
                                  </div>
                                </div>

                                {isSelf && (
                                  <Ava src={currentUser?.avatar} name={currentUser?.name} size={32} />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>

              {/* quick replies — hidden on a blocked (read-only) thread */}
              <div className={`gap-2 px-5 py-2.5 bg-white border-t border-gray-100 overflow-x-auto shrink-0 ${isBlocked ? 'hidden' : 'flex'}`}>
                {QUICK_REPLIES.map(qr => (
                  <button key={qr} onClick={() => handleQuickReply(qr)}
                    className="whitespace-nowrap px-4 py-1.5 rounded-full border border-gray-200 bg-white text-xs text-gray-600 hover:border-purple-300 hover:text-purple-700 hover:bg-purple-50 transition-colors shrink-0">
                    {qr}
                  </button>
                ))}
              </div>

              {/* Make an offer modal */}
              {offerOpen && (
                <div
                  className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
                  onClick={() => setOfferOpen(false)}
                >
                  <div
                    className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="flex items-start justify-between">
                      <h2 className="text-xl font-bold text-gray-900">Make an Offer</h2>
                      <button
                        type="button"
                        onClick={() => setOfferOpen(false)}
                        className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                        aria-label="Close"
                      >
                        <X className="h-6 w-6" />
                      </button>
                    </div>

                    <label className="mt-6 block text-sm font-medium text-gray-700">Your offer amount</label>
                    <div className="mt-2 flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 focus-within:border-[#1414e6]">
                      <span className="text-sm font-semibold text-gray-500">AED</span>
                      <input
                        type="number"
                        min="0"
                        autoFocus
                        value={offerAmount}
                        onChange={e => setOfferAmount(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') sendOffer() }}
                        placeholder="Enter amount"
                        className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                      />
                    </div>

                    <div className="mt-6 flex gap-3">
                      <button
                        type="button"
                        onClick={() => setOfferOpen(false)}
                        className="flex-1 rounded-full border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={sendOffer}
                        className="flex-1 rounded-full bg-[#1414e6] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1010c4]"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Product-sold modal — blocks chat/offer on a sold product */}
              {soldModalOpen && (
                <div
                  className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
                  onClick={() => setSoldModalOpen(false)}
                >
                  <div
                    className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl text-center"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
                      <X className="h-6 w-6 text-red-500" />
                    </div>
                    <h2 className="mt-4 text-lg font-bold text-gray-900">Product no longer available</h2>
                    <p className="mt-2 text-sm text-gray-600">
                      The product "<span className="font-semibold">{activeThread?.productTitle || 'you are looking for'}</span>" you looking is no more available.
                    </p>
                    <button
                      type="button"
                      onClick={() => setSoldModalOpen(false)}
                      className="mt-6 w-full rounded-full bg-[#1414e6] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1010c4]"
                    >
                      Okay
                    </button>
                  </div>
                </div>
              )}

              <MoreOptionsModal
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                options={moreOptions}
              />

              <BlockFlow
                open={showBlockFlow}
                user={blockTargetUser}
                onClose={() => setShowBlockFlow(false)}
                onBlocked={() => applyBlockedState(true)}
              />

              <UnblockConfirmModal
                open={showUnblockConfirm}
                user={blockTargetUser}
                onClose={() => setShowUnblockConfirm(false)}
                onUnblocked={() => applyBlockedState(false)}
              />

              {/* Report user modal */}
              {reportOpen && (
                <div
                  className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
                  onClick={() => !reportSubmitting && setReportOpen(false)}
                >
                  <div
                    className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
                        <Flag className="h-5 w-5 text-red-500" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-gray-900">Report {otherParty?.name || 'user'}</h2>
                        <p className="text-xs text-gray-500">Your report is confidential and reviewed by our team.</p>
                      </div>
                    </div>

                    <div className="mt-5 space-y-2">
                      {['Spam or scam', 'Harassment or abuse', 'Inappropriate content', 'Fraudulent listing', 'Other'].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setReportReason(r)}
                          className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
                            reportReason === r
                              ? 'border-purple-500 bg-purple-50 text-purple-700'
                              : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <span className={`h-4 w-4 rounded-full border-2 ${reportReason === r ? 'border-purple-500 bg-purple-500' : 'border-gray-300'}`} />
                          {r}
                        </button>
                      ))}
                    </div>

                    <textarea
                      value={reportDetails}
                      onChange={(e) => setReportDetails(e.target.value)}
                      placeholder="Add more details (optional)"
                      rows={3}
                      className="mt-4 w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none"
                    />

                    <div className="mt-5 flex gap-3">
                      <button
                        type="button"
                        onClick={() => setReportOpen(false)}
                        disabled={reportSubmitting}
                        className="flex-1 rounded-full border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={submitReport}
                        disabled={!reportReason || reportSubmitting}
                        className="flex-1 rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                      >
                        {reportSubmitting ? 'Submitting…' : 'Submit report'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Preelly Pay conditions popup — gates "Proceed to cart" for the buyer */}
              <PreellyPayModal
                open={preellyModalOpen}
                conditions={preellyConditionsList}
                charge={preellyCharge}
                onClose={() => setPreellyModalOpen(false)}
                onConfirm={handleConfirmPreellyChat}
                onNotInterested={handleNotInterestedPreelly}
              />

              {/* blocked thread — read-only, copy depends on who blocked whom */}
              {isBlocked ? (
                <div className="shrink-0 border-t border-gray-200 bg-white px-6 py-8">
                  <div className="mx-auto flex max-w-xs flex-col items-center text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-200">
                      <Ban className="h-7 w-7 text-white" strokeWidth={2} />
                    </div>
                    <p className="mt-4 text-base font-bold leading-snug text-[#25246E]">
                      {blockNotice.title}
                    </p>
                    <p className="mt-1.5 text-xs text-gray-500">{blockNotice.subtitle}</p>
                    {blockedByMe && (
                      <button
                        type="button"
                        onClick={() => setShowUnblockConfirm(true)}
                        disabled={blocking}
                        className="mt-4 rounded-full border border-gray-200 px-5 py-2 text-sm font-semibold text-[#25246E] transition-colors hover:bg-gray-50 disabled:opacity-60"
                      >
                        Unblock
                      </button>
                    )}
                  </div>
                </div>
              ) : (
              <>
              {/* input */}
              <div className="px-5 py-3 bg-white border-t border-gray-200 shrink-0">
                <input ref={fileRef} type="file" multiple className="hidden"
                  onChange={e => { const fs = Array.from(e.target.files || []); if (fs.length) setAttachFiles(prev => [...prev, ...fs]); e.target.value = '' }} />

                {attachFiles.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2 p-2 bg-gray-50 rounded-xl border border-gray-100">
                    {attachFiles.map((f, idx) => (
                      <div key={idx} className="relative group shrink-0">
                        {f.type.startsWith('image/') ? (
                          <img src={URL.createObjectURL(f)} alt="" className="h-16 w-16 rounded-xl object-cover" />
                        ) : isVideoAttachment({ mimeType: f.type, name: f.name }) ? (
                          <div className="relative h-16 w-16 overflow-hidden rounded-xl bg-black">
                            <video src={URL.createObjectURL(f)} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                            <span className="absolute inset-0 flex items-center justify-center">
                              <Play className="h-6 w-6 text-white drop-shadow" fill="currentColor" />
                            </span>
                          </div>
                        ) : f.type.startsWith('audio/') ? (
                          <div className="h-16 w-16 rounded-xl bg-purple-50 border border-purple-200 flex flex-col items-center justify-center gap-1">
                            <Mic className="h-6 w-6 text-purple-500" />
                            <span className="text-[9px] text-purple-500 font-medium">Audio</span>
                          </div>
                        ) : (
                          <div className="h-16 w-16 rounded-xl bg-white border border-gray-200 flex flex-col items-center justify-center gap-1 px-1">
                            <FileText className="h-6 w-6 text-purple-500" />
                            <span className="text-[9px] text-gray-500 truncate w-full text-center">{f.name.split('.').pop().toUpperCase()}</span>
                          </div>
                        )}
                        <button
                          onClick={() => setAttachFiles(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-gray-700 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 bg-white focus-within:ring-2 focus-within:ring-purple-200 focus-within:border-purple-400 transition"
                  style={{ minHeight: 46 }}>
                  {isRecording ? (<>
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                    <span className="text-sm font-medium text-red-500 tabular-nums">{fmtRecTime(recordingTime)}</span>
                    <span className="flex-1 text-xs text-gray-400">Recording…</span>
                    <button onClick={stopRecording}
                      className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center bg-red-500 text-white transition-colors hover:bg-red-600">
                      <Square className="h-3.5 w-3.5 fill-white" />
                    </button>
                  </>) : (<>
                    <button onClick={() => fileRef.current?.click()} className="shrink-0 text-gray-400 hover:text-purple-600 transition-colors">
                      <Paperclip className="h-5 w-5" />
                    </button>
                    <input ref={inputRef} value={text}
                      onChange={e => setText(e.target.value)} onKeyDown={handleKey}
                      placeholder="Message"
                      className="flex-1 bg-transparent py-3 text-sm text-gray-800 outline-none placeholder:text-gray-400" />
                    {(text.trim() || attachFiles.length > 0) ? (
                      <button onClick={() => doSend()} disabled={sending}
                        className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-white transition-colors disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)' }}>
                        {sending
                          ? <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          : <Send className="h-3.5 w-3.5" />
                        }
                      </button>
                    ) : (
                      <button onClick={startRecording} className="shrink-0 text-gray-400 hover:text-purple-600 transition-colors">
                        <Mic className="h-5 w-5" />
                      </button>
                    )}
                  </>)}
                </div>
              </div>
              </>
              )}
            </>) : (
              /* placeholder */
              <div className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-gray-50/60">
                <div className="h-20 w-20 rounded-full flex items-center justify-center mb-5"
                  style={{ background: 'linear-gradient(135deg,#ede9fe,#ddd6fe)' }}>
                  <BubbleIcon className="h-10 w-10 text-purple-400" />
                </div>
                <p className="text-base font-bold text-gray-700">Your messages</p>
                <p className="text-sm text-gray-400 mt-1 max-w-xs">
                  {threads.length > 0
                    ? 'Select a conversation to start chatting'
                    : 'No conversations yet. Start from any product page.'}
                </p>
                {threads.length === 0 && (
                  <button onClick={() => navigate('/reels')}
                    className="mt-5 px-6 py-2.5 rounded-full text-white text-sm font-bold transition-colors"
                    style={{ background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)' }}>
                    Browse Products
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}

function BubbleIcon(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}
