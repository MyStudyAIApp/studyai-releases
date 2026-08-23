import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  getNotifSettings,
  saveNotifSettings,
  scheduleExamNotifications,
  cancelAllExamNotifications,
} from './notificationService'
import { api, useAppStore, detectIsFullMobileApp } from '../store/appStore'
import Billing from '../lib/billingPlugin'
import MobileTabBar from './MobileTabBar'
import FeedbackModal from '../components/UI/FeedbackModal'
import { IconSettings, IconLoader2, IconCircleCheck, IconDeviceFloppy, IconMessageCircle, IconLogout, IconCrown } from '@tabler/icons-react'

const DAY_OPTIONS = [1, 2, 3, 5, 7, 14]
const HOUR_OPTIONS = [
  { value: 7,  label: '7:00 — Primera hora' },
  { value: 9,  label: '9:00 — Mañana' },
  { value: 12, label: '12:00 — Mediodía' },
  { value: 17, label: '17:00 — Tarde' },
  { value: 20, label: '20:00 — Noche' },
]

export default function MobileSettingsPage() {
  const { user, signOut } = useAuth()
  const [settings,     setSettings]     = useState(null)
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [isFullApp,    setIsFullApp]    = useState(false)

  const planTier = useAppStore(s => s.planTier)
  const setPlanTier = useAppStore(s => s.setPlanTier)

  const [productPrice,   setProductPrice]   = useState('')
  const [purchasing,     setPurchasing]     = useState(false)
  const [purchaseError,  setPurchaseError]  = useState(null)

  const [bonoPrices,    setBonoPrices]    = useState({})
  const [buyingBono,    setBuyingBono]    = useState(null)
  const [bonoMessage,   setBonoMessage]   = useState(null)

  useEffect(() => {
    getNotifSettings().then(setSettings)
    detectIsFullMobileApp().then(setIsFullApp)
  }, [])

  useEffect(() => {
    if (!isFullApp || planTier === 'pro') return
    Billing.queryProducts().then(p => setProductPrice(p.formattedPrice)).catch(() => {})
  }, [isFullApp, planTier])

  useEffect(() => {
    if (!isFullApp || planTier !== 'pro') return
    Billing.queryBonoProducts().then(setBonoPrices).catch(() => {})
  }, [isFullApp, planTier])

  async function handleBuyBono(category) {
    setBuyingBono(category)
    setBonoMessage(null)
    try {
      await Billing.purchaseBono({ category, accountId: user.id })
      // El backend concede el bono via el webhook de RevenueCat (asíncrono,
      // normalmente segundos) -- no hay nada que verificar de forma síncrona
      // aquí, la compra ya quedó confirmada por Google/RevenueCat.
      setBonoMessage({ type: 'ok', text: 'Compra completada — el bono se añadirá en unos segundos.' })
    } catch (e) {
      setBonoMessage({ type: 'error', text: e?.message || 'No se pudo completar la compra' })
    } finally {
      setBuyingBono(null)
    }
  }

  async function handleGoPro() {
    setPurchasing(true)
    setPurchaseError(null)
    try {
      // purchase() ya liga la compra a user.id (Purchases.logIn en el plugin
      // nativo) y RevenueCat valida contra Google en su propio servidor --
      // "active" aquí es solo para la UI optimista, la fuente de verdad real
      // es lo que responda /billing/verify-purchase preguntando a RevenueCat.
      const result = await Billing.purchase({ accountId: user.id })
      if (!result.active) throw new Error('No se recibió confirmación de la compra')
      await api('POST', '/billing/verify-purchase')
      setPlanTier('pro')
    } catch (e) {
      setPurchaseError(e?.message || 'No se pudo completar la compra')
    } finally {
      setPurchasing(false)
    }
  }

  function toggleDay(day) {
    setSettings(s => {
      const list = s.daysBeforeList.includes(day)
        ? s.daysBeforeList.filter(d => d !== day)
        : [...s.daysBeforeList, day].sort((a, b) => a - b)
      return { ...s, daysBeforeList: list }
    })
    setSaved(false)
  }

  async function handleSave() {
    if (!settings) return
    setSaving(true)
    try {
      await saveNotifSettings(settings)
      if (settings.enabled) {
        const res = await api('GET', '/exams/reminders').catch(() => ({ items: [] }))
        await scheduleExamNotifications(res.items || [])
      } else {
        await cancelAllExamNotifications()
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col pb-20">
      {/* Cabecera */}
      <div className="px-5 pt-14 pb-4 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2"><IconSettings size={22} /> Ajustes</h1>
        <p className="text-slate-400 text-sm mt-0.5 truncate">{user?.email}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-7">

        {/* ── Notificaciones ── */}
        <section>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">
            Notificaciones de exámenes
          </p>

          {settings ? (
            <div className="bg-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-700/60">

              {/* Toggle activar/desactivar */}
              <div className="px-4 py-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-200">Activar recordatorios</p>
                  <p className="text-xs text-slate-500 mt-0.5">Avisos automáticos en tu móvil</p>
                </div>
                <button
                  onClick={() => { setSettings(s => ({ ...s, enabled: !s.enabled })); setSaved(false) }}
                  className={`shrink-0 w-12 h-7 rounded-full transition-colors duration-200 relative
                    ${settings.enabled ? 'bg-primary-600' : 'bg-slate-600'}`}
                >
                  <span
                    className="absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all duration-200"
                    style={{ left: settings.enabled ? 'calc(100% - 26px)' : '2px' }}
                  />
                </button>
              </div>

              {settings.enabled && (
                <>
                  {/* Antelación */}
                  <div className="px-4 py-4">
                    <p className="text-sm font-semibold text-slate-200 mb-0.5">Avisar con antelación</p>
                    <p className="text-xs text-slate-500 mb-3">Puedes seleccionar varios plazos</p>
                    <div className="flex flex-wrap gap-2">
                      {DAY_OPTIONS.map(d => {
                        const active = settings.daysBeforeList.includes(d)
                        return (
                          <button
                            key={d}
                            onClick={() => toggleDay(d)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors
                              ${active
                                ? 'bg-primary-600 text-white'
                                : 'bg-slate-700 text-slate-400 active:bg-slate-600'}`}
                          >
                            {d === 1 ? '1 día' : `${d} días`}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Hora del aviso */}
                  <div className="px-4 py-4">
                    <p className="text-sm font-semibold text-slate-200 mb-3">Hora del aviso</p>
                    <div className="space-y-2">
                      {HOUR_OPTIONS.map(h => {
                        const active = settings.notifHour === h.value
                        return (
                          <button
                            key={h.value}
                            onClick={() => { setSettings(s => ({ ...s, notifHour: h.value })); setSaved(false) }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors
                              ${active
                                ? 'bg-primary-600/20 border border-primary-500/60 text-primary-300'
                                : 'bg-slate-700/50 text-slate-400 active:bg-slate-700'}`}
                          >
                            <span className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors
                              ${active ? 'bg-primary-500 border-primary-500' : 'border-slate-500'}`}
                            />
                            {h.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="bg-slate-800 rounded-2xl h-24 animate-pulse" />
          )}

          {/* Botón guardar */}
          <button
            onClick={handleSave}
            disabled={saving || !settings}
            className={`mt-4 w-full py-4 rounded-2xl font-semibold transition-colors disabled:opacity-50
              ${saved
                ? 'bg-emerald-600 text-white'
                : 'bg-primary-600 active:bg-primary-700 text-white'}`}
          >
            {saving
              ? <span className="flex items-center justify-center gap-2"><IconLoader2 size={16} className="animate-spin" /> Guardando...</span>
              : saved
              ? <span className="flex items-center justify-center gap-2"><IconCircleCheck size={16} /> ¡Ajustes guardados!</span>
              : <span className="flex items-center justify-center gap-2"><IconDeviceFloppy size={16} /> Guardar ajustes</span>}
          </button>

          {settings?.enabled && (
            <p className="text-center text-xs text-slate-600 mt-2 px-2">
              Los recordatorios se programan automáticamente al añadir o eliminar exámenes
            </p>
          )}
        </section>

        {/* ── Suscripción Pro (solo MyStudy App, no Scan) ── */}
        {isFullApp && planTier && planTier !== 'pro' && (
          <section>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">
              Suscripción
            </p>
            <div className="bg-gradient-to-br from-amber-500/10 to-yellow-600/10 border border-amber-500/30 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <IconCrown size={18} className="text-amber-400" />
                <p className="text-sm font-semibold text-amber-300">Hazte Pro</p>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Más generaciones, más podcasts y sin límites de {planTier === 'trial' ? 'la prueba' : 'plan Free'}.
              </p>
              <button
                onClick={handleGoPro}
                disabled={purchasing}
                className="w-full py-3 rounded-xl font-semibold text-sm bg-amber-500 active:bg-amber-600 text-slate-900 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {purchasing
                  ? <><IconLoader2 size={16} className="animate-spin" /> Procesando...</>
                  : `Suscribirme${productPrice ? ` — ${productPrice}` : ''}`}
              </button>
              {purchaseError && (
                <p className="text-xs text-red-400 mt-2 text-center">{purchaseError}</p>
              )}
            </div>
          </section>
        )}

        {/* ── Bonos extra de voz (solo Pro) ── */}
        {isFullApp && planTier === 'pro' && (
          <section>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">
              Ampliar cupo de voz
            </p>
            <div className="bg-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-700/60">
              {[
                { category: 'transcription', emoji: '🎙️', label: '10h de transcripción extra' },
                { category: 'podcast',       emoji: '🎧', label: '10 podcasts extra' },
              ].map(({ category, emoji, label }) => (
                <div key={category} className="px-4 py-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-200">{emoji} {label}</p>
                  </div>
                  <button
                    onClick={() => handleBuyBono(category)}
                    disabled={buyingBono === category}
                    className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold bg-primary-600 active:bg-primary-700 text-white disabled:opacity-50 flex items-center gap-2"
                  >
                    {buyingBono === category
                      ? <IconLoader2 size={14} className="animate-spin" />
                      : bonoPrices[category === 'transcription' ? 'bono_transcripcion_10h' : 'bono_podcast_10']?.formattedPrice || 'Comprar'}
                  </button>
                </div>
              ))}
            </div>
            {bonoMessage && (
              <p className={`text-xs mt-2 text-center ${bonoMessage.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
                {bonoMessage.text}
              </p>
            )}
          </section>
        )}

        {/* ── Feedback ── */}
        <section>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">
            Ayúdanos a mejorar
          </p>
          <div className="bg-slate-800 rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowFeedback(true)}
              className="w-full px-4 py-4 flex items-center gap-3 text-slate-300 active:bg-slate-700 transition-colors"
            >
              <IconMessageCircle size={20} className="text-slate-400" />
              <div className="text-left">
                <p className="font-medium text-sm">Enviar feedback</p>
                <p className="text-xs text-slate-500">Errores, sugerencias o lo que quieras</p>
              </div>
            </button>
          </div>
        </section>
        <FeedbackModal open={showFeedback} onClose={() => setShowFeedback(false)} platform="mobile" />

        {/* ── Acerca de ── */}
        <section>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">
            Acerca de
          </p>
          <div className="bg-slate-800 rounded-2xl px-4 py-4 space-y-1">
            <p className="text-sm font-semibold text-slate-200">MyStudy AI</p>
            <p className="text-xs text-slate-400">
              Esta app es parte de MyStudy AI — tu asistente de estudio.
              Accede a la versión completa en la web.
            </p>
            <a
              href="https://mystudyai.eu"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-xs font-medium text-primary-400 active:text-primary-300"
            >
              mystudyai.eu →
            </a>
          </div>
        </section>

        {/* ── Cuenta ── */}
        <section>
          <div className="bg-slate-800 rounded-2xl overflow-hidden">
            <button
              onClick={signOut}
              className="w-full px-4 py-4 flex items-center gap-3 text-red-400 active:bg-slate-700 transition-colors"
            >
              <IconLogout size={20} />
              <span className="font-medium text-sm">Cerrar sesión</span>
            </button>
          </div>
        </section>

      </div>

      <MobileTabBar />
    </div>
  )
}
