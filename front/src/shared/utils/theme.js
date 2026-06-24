export function getInitialTheme() {
  try {
    const saved = localStorage.getItem('theme')
    if (saved === 'dark' || saved === 'light') return saved
  } catch {
    // ignore
  }
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
  return 'light'
}

export function applyTheme(theme) {
  const t = theme === 'dark' ? 'dark' : 'light'
  document.documentElement.classList.toggle('dark', t === 'dark')
  try {
    localStorage.setItem('theme', t)
  } catch {
    // ignore
  }
  return t
}

