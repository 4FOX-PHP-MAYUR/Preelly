import React, { createContext, useContext, useEffect, useState } from 'react'
import { applyTheme, getInitialTheme } from '@shared/utils/theme'

const AdminThemeContext = createContext({ theme: 'light', toggleTheme: () => {} })

export function AdminThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => getInitialTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  return (
    <AdminThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </AdminThemeContext.Provider>
  )
}

export function useAdminTheme() {
  return useContext(AdminThemeContext)
}
