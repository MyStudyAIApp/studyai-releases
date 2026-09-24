import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TitleBar from './TitleBar'
import { useAppStore, IS_WEB, IS_MOBILE, api } from '../../store/appStore'
import BackendBanner from './BackendBanner'
import QuotaExceededModal from '../UI/QuotaExceededModal'
import AnnouncementModal from '../UI/AnnouncementModal'
import OwlWelcome from '../UI/OwlWelcome'
import { useAuth } from '../../contexts/AuthContext'

export default function Layout() {
  const { backendReady, setPlanTier } = useAppStore()
  const { loading: authLoading } = useAuth()
  // Este layout "de escritorio" (Sidebar) lo comparten web, escritorio Y la
  // app completa Capacitor de móvil (MyStudy App) — solo la versión reducida
  // Scan tiene su propio árbol de rutas aparte y nunca llega aquí. Necesita
  // el menú inferior estrecho en dos casos: web vista en pantalla de móvil
  // (IS_WEB + ancho estrecho), o la app Capacitor completa (IS_MOBILE, que ya
  // ES un móvil siempre, sin importar el ancho de ventana).
  const [isMobileWeb, setIsMobileWeb] = useState(() => IS_MOBILE || (IS_WEB && window.innerWidth < 768))
  useEffect(() => {
    if (!IS_WEB) return
    const onResize = () => setIsMobileWeb(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // El tier real (incluye plan_override='pro' manual) vive aquí y no en
  // Sidebar.jsx, porque Sidebar no se monta en móvil (isMobileWeb) — sin esto,
  // el PlanBadge se queda sin dato del backend ahí y cae al cálculo local
  // (que no conoce plan_override), mostrando "Free" aunque la cuenta sea Pro.
  useEffect(() => {
    if (!backendReady || authLoading) return
    api('GET', '/usage/summary').then(data => setPlanTier(data.tier)).catch(() => {})
  }, [backendReady, authLoading])

  // En móvil el menú es un cajón lateral que se esconde (sustituye a la barra
  // inferior): se abre con ☰ o deslizando el dedo desde el borde izquierdo, y
  // se cierra tocando fuera, deslizando hacia la izquierda o al elegir sección.
  const [menu, setMenu] = useState(false)
  useEffect(() => {
    if (!isMobileWeb) return
    let x0 = null
    const inicio = (e) => { const x = e.touches[0].clientX; x0 = x < 24 ? x : null }
    const mover = (e) => { if (x0 !== null && e.touches[0].clientX - x0 > 60) { setMenu(true); x0 = null } }
    window.addEventListener('touchstart', inicio, { passive: true })
    window.addEventListener('touchmove', mover, { passive: true })
    // "Ver tutoriales" (cartel de bienvenida, Ajustes) abre el cajón con el desplegable
    const abrir = () => setMenu(true)
    window.addEventListener('studyai:open-tutorials', abrir)
    return () => {
      window.removeEventListener('touchstart', inicio); window.removeEventListener('touchmove', mover)
      window.removeEventListener('studyai:open-tutorials', abrir)
    }
  }, [isMobileWeb])
  const cerrarDeslizando = (() => {
    let x0 = null
    return {
      onTouchStart: (e) => { x0 = e.touches[0].clientX },
      onTouchMove: (e) => { if (x0 !== null && x0 - e.touches[0].clientX > 60) { setMenu(false); x0 = null } },
    }
  })()

  // Con viewport-fit=cover la página llega hasta abajo del todo en el móvil:
  // el paddingBottom deja libre la barra de gestos de Android (en web vale 0).
  return (
    <div className="flex flex-col h-screen h-dvh overflow-hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <TitleBar onMenu={isMobileWeb ? () => setMenu(true) : null} />
      {!backendReady && <BackendBanner />}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {!isMobileWeb && <Sidebar />}
        <main className="flex-1 min-h-0 overflow-auto bg-slate-900">
          <Outlet />
        </main>
      </div>
      {isMobileWeb && (
        <div className={`fixed inset-0 z-[60] ${menu ? '' : 'pointer-events-none'}`} {...cerrarDeslizando}>
          <div onClick={() => setMenu(false)}
               className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${menu ? 'opacity-100' : 'opacity-0'}`} />
          <div className={`absolute inset-y-0 left-0 shadow-2xl transition-transform duration-300 ease-out ${menu ? 'translate-x-0' : '-translate-x-full'}`}
               style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <Sidebar cajon alNavegar={() => setMenu(false)} />
          </div>
        </div>
      )}
      <QuotaExceededModal />
      <AnnouncementModal />
      <OwlWelcome />
    </div>
  )
}
