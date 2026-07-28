import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  Plus, Bookmark, FileText, Search, CalendarCheck, ShoppingCart, Files, Archive,
  User, MapPin, Landmark, Ban, ShieldCheck, LifeBuoy, HelpCircle, Phone, LogOut, ChevronRight,
  Menu, X, Settings,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { fetchRootCategories } from '@shared/store/slices/categorySlice'
import { logout } from '@shared/store/slices/authSlice'
import SidebarCategoryList from '../Layout/SidebarCategoryList'
import MarketplaceTopBar from '../Layout/MarketplaceTopBar'
import MarketplaceLogoBlock from '../Layout/MarketplaceLogoBlock'

function HomeCategorySidebar() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { rootCategories = [] } = useSelector((state) => state.categories)

  useEffect(() => {
    if (rootCategories.length === 0) dispatch(fetchRootCategories())
  }, [dispatch, rootCategories.length])

  return (
    <aside className="hidden min-h-0 flex-col overflow-y-auto border-r border-[#E5E7EB] bg-white p-5 xl:flex">
      <Link
        to="/post-ad"
        className="flex items-center justify-center gap-2 rounded-[12px] bg-brand px-4 py-3 text-sm font-semibold text-white transition duration-200 hover:bg-brand-700"
      >
        <Plus className="h-4 w-4" />
        Post Your Ad
      </Link>

      <div className="mt-6">
        <Link
          to="/categories"
          className="inline-block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 transition duration-200 hover:text-brand"
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
            className="flex items-center gap-3 rounded-[12px] px-3 py-3 text-sm font-medium text-slate-700 transition duration-200 hover:bg-slate-100"
          >
            <Bookmark className="h-4 w-4 text-slate-500" />
            <span>My Bookmark</span>
          </Link>
          <Link
            to="/dashboard/settings"
            className="flex items-center gap-3 rounded-[12px] px-3 py-3 text-sm font-medium text-slate-700 transition duration-200 hover:bg-slate-100"
          >
            <Settings className="h-4 w-4 text-slate-500" />
            <span>Settings</span>
          </Link>
        </div>
      </div>
    </aside>
  )
}

const QUICK_TILES = [
  { label: 'My Ads', icon: FileText, to: '/dashboard/listings' },
  { label: 'My Search', icon: Search, to: '/dashboard/my-search' },
  { label: 'My Bookings', icon: CalendarCheck, to: '/dashboard/orders' },
  { label: 'My Cart', icon: ShoppingCart, to: '/cart' },
  { label: 'My Drafts', icon: Files, to: '/dashboard/drafts' },
  { label: 'My Archives', icon: Archive, to: '/dashboard/listings?status=inactive' },
]

const MENU_GROUPS = [
  [
    { label: 'Profile', icon: User, to: '/dashboard/profile' },
    { label: 'My Address', icon: MapPin, to: '/dashboard/profile#address' },
    { label: 'My Bank Details', icon: Landmark, to: '/dashboard/profile#bank-details' },
    { label: 'Blocked Users', icon: Ban, to: '/dashboard/blocked-users' },
    { label: 'Privacy & Security', icon: ShieldCheck, to: '/dashboard/settings' },
  ],
  [
    { label: 'Support', icon: LifeBuoy, to: '/dashboard/support' },
    { label: 'FAQ', icon: HelpCircle, to: '/dashboard/faq' },
    { label: 'Contact Us', icon: Phone, to: '/dashboard/contact' },
  ],
]

function isMenuActive(item, pathname, hash) {
  if (!item.to) return false
  const [path, itemHash] = item.to.split('#')
  if (path !== pathname) return false
  if (itemHash) return hash === `#${itemHash}`
  // Exact path items (e.g. Privacy & Security) — active when hashes are empty
  if (path === '/dashboard/profile') {
    return !hash || hash === '#'
  }
  return true
}

function SettingsSideMenu({ onNavigate }) {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()

  const go = (item) => {
    if (item.to) {
      navigate(item.to)
      onNavigate?.()
    } else {
      toast('Coming soon')
    }
  }

  const handleLogout = async () => {
    try {
      await dispatch(logout('user-click')).unwrap?.()
    } catch { /* ignore */ }
    navigate('/')
  }

  return (
    <div className="min-h-0 overflow-y-auto border-r border-[#E5E7EB] bg-white p-4 sm:p-5">
      <div className="grid grid-cols-2 gap-3">
        {QUICK_TILES.map(({ label, icon: Icon, to }) => {
          const active =
            to &&
            (location.pathname === to.split('?')[0] ||
              (to.startsWith('/dashboard/drafts') && location.pathname === '/dashboard/drafts') ||
              (to.startsWith('/dashboard/my-search') && location.pathname === '/dashboard/my-search') ||
              (label === 'My Ads' && location.pathname === '/dashboard/listings' && !location.search.includes('status=inactive')) ||
              (label === 'My Archives' && location.pathname === '/dashboard/listings' && location.search.includes('status=inactive')))
          return (
            <button
              key={label}
              type="button"
              onClick={() => go({ to })}
              className={`flex flex-col items-center justify-center gap-2 rounded-[12px] border px-3 py-5 text-center transition duration-200 ${
                active
                  ? 'border-brand bg-brand-50/50 text-brand'
                  : 'border-[#E5E7EB] hover:border-brand hover:bg-brand-50/40'
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? 'text-brand' : 'text-slate-500'}`} />
              <span className={`text-sm font-semibold ${active ? 'text-brand' : 'text-slate-800'}`}>{label}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-5">
        {MENU_GROUPS.map((group, gi) => (
          <div
            key={gi}
            className={gi > 0 ? 'mt-2 border-t border-slate-100 pt-2' : ''}
          >
            {group.map((item) => {
              const showActive = isMenuActive(item, location.pathname, location.hash)
              const Icon = item.icon
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => go(item)}
                  className={`flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-left text-sm font-medium transition duration-200 ${
                    showActive ? 'bg-brand-50 text-brand' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${showActive ? 'text-brand' : 'text-slate-500'}`} />
                  <span className="flex-1">{item.label}</span>
                  <ChevronRight className={`h-4 w-4 ${showActive ? 'text-brand/60' : 'text-slate-300'}`} />
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <div className="mt-2 border-t border-slate-100 pt-2">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-left text-sm font-semibold text-red-500 transition duration-200 hover:bg-red-50"
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
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-white">
      <div className="grid shrink-0 grid-cols-1 border-b border-[#E5E7EB] xl:grid-cols-[270px_minmax(0,1fr)]">
        <div className="hidden items-center border-r border-[#E5E7EB] px-5 xl:flex">
          <MarketplaceLogoBlock />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="ml-3 inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#E5E7EB] text-slate-600 transition duration-200 hover:border-brand hover:text-brand lg:hidden"
            aria-label="Open profile menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <MarketplaceTopBar topBarColSpan="" />
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[270px_320px_minmax(0,1fr)]">
        <HomeCategorySidebar />
        <div className="hidden min-h-0 lg:block">
          <SettingsSideMenu />
        </div>
        <div className="min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</div>
      </div>

      {/* Mobile / tablet slide-over menu */}
      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 transition duration-200"
            aria-label="Close menu overlay"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[min(100%,360px)] flex-col bg-white shadow-2xl transition duration-300">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
              <MarketplaceLogoBlock />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#E5E7EB] text-slate-600"
                aria-label="Close profile menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <SettingsSideMenu onNavigate={() => setMenuOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
