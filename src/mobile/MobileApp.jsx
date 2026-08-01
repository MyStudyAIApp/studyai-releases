import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { App as CapacitorApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { useAuth } from '../contexts/AuthContext'
import { completeGoogleOAuthFromUrl } from '../lib/googleAuth'
import MobileLoginPage from './MobileLoginPage'
import MobileHomePage from './MobileHomePage'
import MobileScannerPage from './MobileScannerPage'
import MobileRecordPage from './MobileRecordPage'
import MobileExerciseSolverPage from './MobileExerciseSolverPage'
import MobilePodcastsPage from './MobilePodcastsPage'
import MobileLibraryPage from './MobileLibraryPage'
import MobileDocumentPage from './MobileDocumentPage'
import MobileExamsPage from './MobileExamsPage'
import MobileSettingsPage from './MobileSettingsPage'
import QuotaExceededModal from '../components/UI/QuotaExceededModal'

function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-slate-400 text-lg animate-pulse">Cargando...</div>
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function MobileApp() {
  // Deep link de vuelta tras iniciar sesión con Google (mystudyai://auth-callback)
  useEffect(() => {
    const listenerPromise = CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
      try {
        const ok = await completeGoogleOAuthFromUrl(url)
        if (ok) { try { await Browser.close() } catch {} }
      } catch (e) {
        console.error('Login con Google (deep link) falló:', e)
      }
    })
    return () => { listenerPromise.then(l => l.remove()) }
  }, [])

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <Routes>
        <Route path="/login"    element={<MobileLoginPage />} />
        <Route path="/"         element={<Protected><MobileHomePage /></Protected>} />
        <Route path="/library"  element={<Protected><MobileLibraryPage /></Protected>} />
        <Route path="/document/:id" element={<Protected><MobileDocumentPage /></Protected>} />
        <Route path="/exams"    element={<Protected><MobileExamsPage /></Protected>} />
        <Route path="/settings" element={<Protected><MobileSettingsPage /></Protected>} />
        <Route path="/scanner"  element={<Protected><MobileScannerPage /></Protected>} />
        <Route path="/record"   element={<Protected><MobileRecordPage /></Protected>} />
        <Route path="/solve"    element={<Protected><MobileExerciseSolverPage /></Protected>} />
        <Route path="/podcasts" element={<Protected><MobilePodcastsPage /></Protected>} />
        <Route path="*"         element={<Navigate to="/" replace />} />
      </Routes>
      <QuotaExceededModal />
    </div>
  )
}
