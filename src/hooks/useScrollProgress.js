import { useEffect, useState } from 'react'

// Progreso de scroll (0..1) dentro de un contenedor alto, para animar
// contenido "pegado" (position: sticky) según cuánto se ha bajado.
export function useScrollProgress(ref) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    function onScroll() {
      if (!ref.current) return
      const rect = ref.current.getBoundingClientRect()
      const total = rect.height - window.innerHeight
      const scrolled = Math.min(Math.max(-rect.top, 0), total)
      setProgress(total > 0 ? scrolled / total : 0)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [ref])

  return progress
}
