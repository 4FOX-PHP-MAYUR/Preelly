import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  Plus, Bookmark, FileText, Search, CalendarCheck, ShoppingCart, Files, Archive,
  User, MapPin, Landmark, Ban, ShieldCheck, LifeBuoy, HelpCircle, Phone, LogOut, ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { fetchRootCategories } from '@shared/store/slices/categorySlice'
import { logout } from '@shared/store/slices/authSlice'
import SidebarCategoryList from '../Layout/SidebarCategoryList'
import MarketplaceTopBar from '../Layout/MarketplaceTopBar'
import MarketplaceLogoBlock from '../Layout/MarketplaceLogoBlock'

// ── Left column: the home-page category sidebar ──────────────────────────────
function HomeCategorySidebar() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { rootCategories = [] } = useSelector((state) => state.categories)

  useEffect(() => {
    if (rootCategories.length === 0) dispatch(fetchRootCategories())
  }, [dispatch, rootCategories.length])

  return (
    <aside className="hidden min-h-0 flex-col overflow-y-auto border-r border-slate-200 bg-white p-5 lg:flex">
      <Link
        to="/post-ad"
        className="flex items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
      >
        <Plus className="h-4 w-4" />
        Post Your Ad
      </Link>

      <div className="mt-6">
        <Link
          to="/categories"
          className="inline-block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 transition hover:text-brand"
        >
          Categories
        </Link>
        <div className="mt-3">
          <SidebarCategoryList
            categories={rootCategories}
            onSelect={(category) => category?._id && navigate(`/categories/${category._id}`)}
          />
        </div>
      </div>

      <div className="mt-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Quick Links</p>
        <div className="mt-3 space-y-2">
          <Link
            to="/bookmarks"
            className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            <Bookmark className="h-4 w-4 text-slate-500" />
            <span>My Bookmark</span>
          </Link>
        </div>
      </div>
    </aside>
  )
}

// ── Middle column: the settings menu ─────────────────────────────────────────
// `to` navigates; items without a real destination are inert ("coming soon").
const QUICK_TILES = [
  { label: 'My Ads', icon: FileText, to: '/dashboard/listings' },
  { label: 'My Search', icon: Search, to: '/search' },
  { label: 'My Bookings', icon: CalendarCheck, to: '/dashboard/orders' },
  { label: 'My Cart', icon: ShoppingCart },
  { label: 'My Drafts', icon: Files },
  { label: 'My Archives', icon: Archive },
]

const MENU_GROUPS = [
  [
    { label: 'Profile', icon: User, to: '/my-profile' },
    { label: 'My Address', icon: MapPin },
    { label: 'My Bank Details', icon: Landmark },
    { label: 'Blocked Users', icon: Ban },
    { label: 'Privacy & Security', icon: ShieldCheck, to: '/dashboard/settings' },
  ],
  [
    { label: 'Support', icon: LifeBuoy },
    { label: 'FAQ', icon: HelpCircle },
    { label: 'Contact Us', icon: Phone },
  ],
]

function SettingsSideMenu() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()

  const go = (item) => {
    if (item.to) navigate(item.to)
    else toast('Coming soon')
  }

  const handleLogout = async () => {
    try {
      await dispatch(logout('user-click')).unwrap?.()
    } catch { /* ignore */ }
    navigate('/')
  }

  return (
    <div className="min-h-0 overflow-y-auto border-r border-slate-200 bg-white p-4 sm:p-5">
      {/* Quick tiles */}
      <div className="grid grid-cols-2 gap-3">
        {QUICK_TILES.map(({ label, icon: Icon, to }) => (
          <button
            key={label}
            type="button"
            onClick={() => go({ to })}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 px-3 py-5 text-center transition hover:border-brand hover:bg-brand-50/40"
          >
            <Icon className="h-5 w-5 text-slate-500" />
            <span className="text-sm font-semibold text-slate-800">{label}</span>
          </button>
        ))}
      </div>

      {/* Menu groups */}
      <div className="mt-5">
        {MENU_GROUPS.map((group, gi) => (
          <div
            key={gi}
            className={gi > 0 ? 'mt-2 border-t border-slate-100 pt-2' : ''}
          >
            {group.map((item) => {
              const active = item.to && item.to === location.pathname
              const Icon = item.icon
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => go(item)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${
                    active ? 'text-brand' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? 'text-brand' : 'text-slate-500'}`} />
                  <span className="flex-1">{item.label}</span>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Log out */}
      <div className="mt-2 border-t border-slate-100 pt-2">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-red-500 transition hover:bg-red-50"
        >
          <LogOut className="h-4 w-4" />
          <span>Log out</span>
        </button>
      </div>
    </div>
  )
}

/**
 * Home-style shell for the dashboard settings/profile pages: the common top bar,
 * the home category sidebar, and the settings menu — with the page's own content
 * rendered in the right column via {children}.
 */
export default function SettingsPageShell({ children }) {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-white">
      {/* Common header (logo + marketplace top bar) */}
      <div className="grid shrink-0 grid-cols-1 border-b border-slate-200 lg:grid-cols-[270px_minmax(0,1fr)]">
        <div className="hidden items-center border-r border-slate-200 px-5 lg:flex">
          <MarketplaceLogoBlock />
        </div>
        <MarketplaceTopBar topBarColSpan="" />
      </div>

      {/* Body: category sidebar | settings menu | content */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[270px_360px_minmax(0,1fr)]">
        <HomeCategorySidebar />
        <SettingsSideMenu />
        <div className="min-h-0 overflow-y-auto p-4 sm:p-6">{children}</div>
      </div>
    </div>
  )
}
