import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import MobileBottomNav from './MobileBottomNav'
import TitleBar from './TitleBar'
import { useAppStore, IS_WEB, IS_MOBILE, api } from '../../store/appStore'
import BackendBanner from './BackendBanner'
import QuotaExceededModal from '../UI/QuotaExceededModal'
import AnnouncementModal from '../UI/AnnouncementModal'
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

  return (
    <div className="flex flex-col h-screen h-dvh overflow-hidden">
      <TitleBar />
      {!backendReady && <BackendBanner />}
      <div className="flex flex-1 overflow-hidden">
        {!isMobileWeb && <Sidebar />}
        <main className="flex-1 overflow-auto bg-slate-900">
          <Outlet />
        </main>
      </div>
      {isMobileWeb && <MobileBottomNav />}
      <QuotaExceededModal />
      <AnnouncementModal />
    </div>
  )
}
