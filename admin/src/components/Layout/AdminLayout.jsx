import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { logoutAdmin } from '../../store/adminAuthSlice'
import Sidebar from '../AdminUI/Sidebar'
import TopNav from '../AdminUI/TopNav'
import { AdminThemeProvider } from '../AdminUI/AdminThemeContext'

function AdminLayout({ children }) {
  const location = useLocation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [mobileAdminOpen, setMobileAdminOpen] = useState(false)

  const isLoginRoute = location.pathname === '/login'

  const handleLogout = () => {
    dispatch(logoutAdmin())
    navigate('/login')
  }

  if (isLoginRoute) {
    return (
      <AdminThemeProvider>
        <div className="admin-shell">
          <main className="admin-content">{children}</main>
        </div>
      </AdminThemeProvider>
    )
  }

  return (
    <AdminThemeProvider>
      <div className="admin-shell flex">
        <div className="hidden md:block md:flex-shrink-0">
          <Sidebar mobileOpen={false} onMobileClose={() => {}} />
        </div>
        <div className="md:hidden">
          <Sidebar
            mobileOpen={mobileAdminOpen}
            onMobileClose={() => setMobileAdminOpen(false)}
          />
        </div>
        <div className="admin-main">
          <TopNav onMenuClick={() => setMobileAdminOpen((v) => !v)} />
          <main className="admin-content">{children}</main>
        </div>
      </div>
    </AdminThemeProvider>
  )
}

export default AdminLayout
