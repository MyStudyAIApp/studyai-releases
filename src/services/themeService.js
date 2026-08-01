const STORAGE_KEY = 'studyai-theme'

export const THEMES = [
  { id: 'actual', label: 'Actual', accent: '#2563eb', bg: '#0f172a' },
  { id: 'esmeralda', label: 'Esmeralda', accent: '#059669', bg: '#0a0f0d' },
  { id: 'clara', label: 'Clara cálida', accent: '#ea580c', bg: '#fdf6ec' },
  { id: 'rosa', label: 'Rosa', accent: '#db2777', bg: '#1c0a13' },
]

export function getTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return THEMES.some(t => t.id === stored) ? stored : 'actual'
  } catch {
    return 'actual'
  }
}

export function applyTheme(id) {
  const theme = THEMES.some(t => t.id === id) ? id : 'actual'
  document.documentElement.setAttribute('data-theme', theme)
  try { localStorage.setItem(STORAGE_KEY, theme) } catch { /* almacenamiento no disponible */ }
}
