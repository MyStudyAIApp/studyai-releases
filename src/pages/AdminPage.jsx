import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getAuthHeader, handleUnauthorized } from '../store/appStore'
import { WEB_API } from '../lib/supabase'
import Spinner from '../components/UI/Spinner'

function bytesToMB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1)
}

function gaugeColor(pct) {
  if (pct >= 85) return 'text-red-500'
  if (pct >= 60) return 'text-amber-400'
  return 'text-emerald-400'
}

function RingGauge({ pct, title, top, bottom }) {
  const clamped = Math.min(100, Math.max(0, pct))
  const r = 42
  const c = 2 * Math.PI * r
  const offset = c * (1 - clamped / 100)
  const color = gaugeColor(clamped)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-28 h-28 shrink-0">
        <svg viewBox="0 0 100 100" className="w-28 h-28 -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" className="text-slate-800" strokeWidth="9" />
          <circle
            cx="50" cy="50" r={r} fill="none" stroke="currentColor" className={color}
            strokeWidth="9" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-xl font-bold ${color}`}>{Math.round(clamped)}%</span>
          <span className="text-[10px] text-slate-500">{top}</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-medium text-slate-300">{title}</p>
        <p className="text-[11px] text-slate-500">{bottom}</p>
      </div>
    </div>
  )
}

function StatusDot({ status }) {
  const ok = status === 'up'
  return (
    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${ok ? 'bg-emerald-400' : 'bg-red-500'}`} />
  )
}

function UsageRow({ provider, data }) {
  const isAudio = provider.includes('whisper')
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
      <span className="text-sm font-medium text-slate-300 capitalize">{provider}</span>
      <div className="text-right text-xs text-slate-400">
        <div>{data.requests} peticiones · {(data.tokens_in + data.tokens_out).toLocaleString()} {isAudio ? 'seg de audio' : 'tokens'}</div>
        <div className="text-emerald-400 font-semibold">{data.est_cost_eur.toFixed(4)} €</div>
      </div>
    </div>
  )
}

function DailyTrendChart({ data }) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-slate-500">Todavía no hay suficiente historial.</p>
  }
  const max = Math.max(...data.map(d => d.cost_eur), 0.0001)
  return (
    <div className="flex items-end gap-1 h-24">
      {data.map(d => (
        <div key={d.day} className="flex-1 flex flex-col items-center justify-end h-full group relative">
          <div
            className="w-full bg-emerald-500/70 rounded-t hover:bg-emerald-400 transition-colors"
            style={{ height: `${Math.max(2, (d.cost_eur / max) * 100)}%` }}
            title={`${d.day}: ${d.cost_eur.toFixed(4)} €`}
          />
        </div>
      ))}
    </div>
  )
}

const FEATURE_LABELS = {
  summary: '📝 Resumen',
  extended_summary: '📝 Resumen extendido',
  flashcards: '🃏 Fichas (generación)',
  cloze: '✏️ Huecos',
  test: '☑️ Test',
  development: '📖 Desarrollo',
  problems: '🧮 Problemas resueltos',
  problems_new: '🧮 Problemas nuevos',
  adaptive: '🎯 Adaptativo',
  timed: '⏱️ Examen cronometrado',
  studyplan: '📅 Plan de estudio',
  formulas: '∑ Fórmulas',
  timeline: '📈 Cronología',
  glossary: '📚 Glosario',
  mindmap: '🧠 Mapa mental',
  connections: '🔗 Conexiones',
  flashcards_reviewed: '🧠 Fichas repasadas',
  flashcard_decks_saved: '💾 Mazos guardados',
  exams_completed: '✅ Exámenes completados',
  tutor_sessions: '🦉 Sesiones de tutor',
  podcasts_generated: '🎧 Podcasts generados',
  annotations_created: '🖍️ Anotaciones',
  study_sessions: '⏳ Sesiones de estudio',
  exam_reminders_created: '📌 Recordatorios de examen',
}

function featureLabel(key) {
  return FEATURE_LABELS[key] || key
}

function FeatureUsageChart({ items }) {
  const filtered = (items || []).filter(i => i.count > 0)
  if (filtered.length === 0) {
    return <p className="text-sm text-slate-500">Todavía no hay datos de uso.</p>
  }
  const max = Math.max(...filtered.map(i => i.count))
  return (
    <div className="space-y-2">
      {filtered.map(i => (
        <div key={i.feature} className="flex items-center gap-3">
          <span className="text-xs text-slate-400 w-40 shrink-0 truncate">{featureLabel(i.feature)}</span>
          <div className="flex-1 h-4 bg-slate-800/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500/70 rounded-full transition-all"
              style={{ width: `${Math.max(2, (i.count / max) * 100)}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-slate-300 w-10 text-right shrink-0">{i.count}</span>
        </div>
      ))}
    </div>
  )
}

function RangeButton({ value, current, onClick, children }) {
  const active = value === current
  return (
    <button
      onClick={() => onClick(value)}
      className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${active ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-500 hover:text-slate-300'}`}
    >{children}</button>
  )
}

export default function AdminPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [trendRange, setTrendRange] = useState(30)
  const [renderDeploys, setRenderDeploys] = useState([])
  const [featureUsage, setFeatureUsage] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [annTitle, setAnnTitle] = useState('')
  const [annMessage, setAnnMessage] = useState('')
  const [annLink, setAnnLink] = useState('')
  const [creatingAnn, setCreatingAnn] = useState(false)
  const [inviteCodes, setInviteCodes] = useState([])
  const [inviteNote, setInviteNote] = useState('')
  const [inviteMaxUses, setInviteMaxUses] = useState(1)
  const [inviteExpiresDays, setInviteExpiresDays] = useState('')
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [lastCreatedCode, setLastCreatedCode] = useState('')
  const [orphanedSelected, setOrphanedSelected] = useState([])
  const [deletingOrphaned, setDeletingOrphaned] = useState(false)
  const [searchEmail, setSearchEmail] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [renderActionBusy, setRenderActionBusy] = useState(false)

  // ── 2FA del panel admin ──────────────────────────────────────────────────
  const [twoFAEnabled, setTwoFAEnabled] = useState(null)   // null = comprobando todavía
  const [twoFAToken, setTwoFAToken] = useState(() => localStorage.getItem('admin_2fa_token'))
  const [twoFACode, setTwoFACode] = useState('')
  const [twoFAError, setTwoFAError] = useState('')
  const [verifying2FA, setVerifying2FA] = useState(false)
  const [setupStep, setSetupStep] = useState(null)   // null | 'qr' | 'backup-codes'
  const [setupQr, setSetupQr] = useState('')
  const [setupSecret, setSetupSecret] = useState('')
  const [backupCodes, setBackupCodes] = useState(null)
  const [disableCode, setDisableCode] = useState('')
  const [disabling2FA, setDisabling2FA] = useState(false)

  function twoFAHeader() {
    return twoFAToken ? { 'X-Admin-2FA': twoFAToken } : {}
  }

  useEffect(() => {
    checkTwoFAStatus()
  }, [])

  // Dispara load() cuando el token de 2FA cambia (login o setup) -- usar un
  // efecto en vez de llamar a load() justo después de setTwoFAToken evita la
  // condición de carrera de React (el estado no se actualiza al instante,
  // así que la llamada saldría sin el token nuevo y el backend la rechazaría
  // con 401, disparando un cierre de sesión de golpe).
  useEffect(() => {
    if (twoFAToken) load()
  }, [twoFAToken])

  async function checkTwoFAStatus() {
    const authHeader = await getAuthHeader()
    const res = await fetch(`${WEB_API}/admin/2fa/status`, { headers: { ...authHeader } })
    if (!res.ok) return
    const data = await res.json()
    setTwoFAEnabled(data.enabled)
    if (!data.enabled) load()
  }

  async function verifyTwoFA() {
    if (!twoFACode.trim()) return
    setVerifying2FA(true)
    setTwoFAError('')
    try {
      const authHeader = await getAuthHeader()
      const res = await fetch(`${WEB_API}/admin/2fa/verify`, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: twoFACode.trim() }),
      })
      if (!res.ok) { setTwoFAError('Código incorrecto.'); return }
      const data = await res.json()
      setTwoFAToken(data.admin_2fa_token)
      localStorage.setItem('admin_2fa_token', data.admin_2fa_token)
      setTwoFACode('')
    } finally {
      setVerifying2FA(false)
    }
  }

  async function startTwoFASetup() {
    const authHeader = await getAuthHeader()
    const res = await fetch(`${WEB_API}/admin/2fa/setup`, { method: 'POST', headers: { ...authHeader } })
    if (!res.ok) return
    const data = await res.json()
    setSetupQr(data.qr_code_png_base64)
    setSetupSecret(data.secret)
    setSetupStep('qr')
  }

  async function confirmTwoFASetup() {
    if (!twoFACode.trim()) return
    setVerifying2FA(true)
    setTwoFAError('')
    try {
      const authHeader = await getAuthHeader()
      const res = await fetch(`${WEB_API}/admin/2fa/confirm-setup`, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: twoFACode.trim() }),
      })
      if (!res.ok) { setTwoFAError('Código incorrecto. Comprueba la hora del móvil y vuelve a intentarlo.'); return }
      const data = await res.json()
      setTwoFAToken(data.admin_2fa_token)
      localStorage.setItem('admin_2fa_token', data.admin_2fa_token)
      setBackupCodes(data.backup_codes)
      setSetupStep('backup-codes')
      setTwoFAEnabled(true)
      setTwoFACode('')
    } finally {
      setVerifying2FA(false)
    }
  }

  async function disableTwoFA() {
    if (!disableCode.trim()) return
    setDisabling2FA(true)
    try {
      const authHeader = await getAuthHeader()
      const res = await fetch(`${WEB_API}/admin/2fa/disable`, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: disableCode.trim() }),
      })
      if (res.ok) {
        setTwoFAEnabled(false)
        setTwoFAToken(null)
        localStorage.removeItem('admin_2fa_token')
        setDisableCode('')
      }
    } finally {
      setDisabling2FA(false)
    }
  }

  async function load() {
    setLoading(true)
    setError('')
    try {
      let authHeader = await getAuthHeader()
      let res = await fetch(`${WEB_API}/admin/stats`, { headers: { ...authHeader, ...twoFAHeader() } })
      if (res.status === 401) {
        // Puede ser un bache puntual con el token a punto de caducar (mismo
        // patrón ya usado en Tutor/Idiomas) -- forzamos un refresco y
        // reintentamos una vez antes de rendirnos y cerrar la sesión.
        authHeader = await getAuthHeader(true)
        res = await fetch(`${WEB_API}/admin/stats`, { headers: { ...authHeader, ...twoFAHeader() } })
      }
      if (!res.ok) {
        if (res.status === 401) { handleUnauthorized(); throw new Error('Sesión caducada, vuelve a iniciar sesión.') }
        if (res.status === 403) throw new Error('No autorizado')
        throw new Error(`HTTP ${res.status}`)
      }
      setStats(await res.json())
      try {
        const rDeploys = await fetch(`${WEB_API}/admin/render/deploys`, { headers: { ...authHeader, ...twoFAHeader() } })
        if (rDeploys.ok) setRenderDeploys((await rDeploys.json()).deploys || [])
      } catch { /* opcional, no bloquea el resto del panel */ }
      try {
        const rUsage = await fetch(`${WEB_API}/admin/feature-usage`, { headers: { ...authHeader, ...twoFAHeader() } })
        if (rUsage.ok) setFeatureUsage((await rUsage.json()).items || [])
      } catch { /* opcional, no bloquea el resto del panel */ }
      try {
        const rInvites = await fetch(`${WEB_API}/admin/invite-codes`, { headers: { ...authHeader, ...twoFAHeader() } })
        if (rInvites.ok) setInviteCodes((await rInvites.json()).items || [])
      } catch { /* opcional, no bloquea el resto del panel */ }
      try {
        const rAnn = await fetch(`${WEB_API}/admin/announcements`, { headers: { ...authHeader, ...twoFAHeader() } })
        if (rAnn.ok) setAnnouncements((await rAnn.json()).items || [])
      } catch { /* opcional, no bloquea el resto del panel */ }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function createInviteCode() {
    setCreatingInvite(true)
    setLastCreatedCode('')
    try {
      const authHeader = await getAuthHeader()
      const res = await fetch(`${WEB_API}/admin/invite-codes`, {
        method: 'POST',
        headers: { ...authHeader, ...twoFAHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: inviteNote.trim() || null,
          max_uses: Math.max(1, Number(inviteMaxUses) || 1),
          expires_in_days: inviteExpiresDays ? Number(inviteExpiresDays) : null,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setLastCreatedCode(data.code)
        setInviteNote('')
        setInviteMaxUses(1)
        setInviteExpiresDays('')
        const rInvites = await fetch(`${WEB_API}/admin/invite-codes`, { headers: { ...authHeader, ...twoFAHeader() } })
        if (rInvites.ok) setInviteCodes((await rInvites.json()).items || [])
      }
    } finally {
      setCreatingInvite(false)
    }
  }

  async function deactivateInviteCode(code) {
    const authHeader = await getAuthHeader()
    await fetch(`${WEB_API}/admin/invite-codes/${encodeURIComponent(code)}`, {
      method: 'DELETE', headers: { ...authHeader, ...twoFAHeader() },
    })
    setInviteCodes(prev => prev.map(c => c.code === code ? { ...c, active: false } : c))
  }

  async function createAnnouncement() {
    if (!annTitle.trim() || !annMessage.trim()) return
    setCreatingAnn(true)
    try {
      const authHeader = await getAuthHeader()
      const res = await fetch(`${WEB_API}/admin/announcements`, {
        method: 'POST',
        headers: { ...authHeader, ...twoFAHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: annTitle.trim(),
          message: annMessage.trim(),
          link_url: annLink.trim() || null,
        }),
      })
      if (res.ok) {
        setAnnTitle('')
        setAnnMessage('')
        setAnnLink('')
        const rAnn = await fetch(`${WEB_API}/admin/announcements`, { headers: { ...authHeader, ...twoFAHeader() } })
        if (rAnn.ok) setAnnouncements((await rAnn.json()).items || [])
      }
    } finally {
      setCreatingAnn(false)
    }
  }

  async function deactivateAnnouncement(id) {
    const authHeader = await getAuthHeader()
    await fetch(`${WEB_API}/admin/announcements/${id}`, { method: 'DELETE', headers: { ...authHeader, ...twoFAHeader() } })
    setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, active: false } : a))
  }

  async function deleteOrphaned() {
    if (orphanedSelected.length === 0) return
    setDeletingOrphaned(true)
    try {
      const authHeader = await getAuthHeader()
      await fetch(`${WEB_API}/admin/storage/delete-orphaned`, {
        method: 'POST',
        headers: { ...authHeader, ...twoFAHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: orphanedSelected }),
      })
      setOrphanedSelected([])
      await load()
    } finally {
      setDeletingOrphaned(false)
    }
  }

  async function searchDocumentsByUser() {
    if (!searchEmail.trim()) return
    setSearching(true)
    setSearchResults(null)
    try {
      const authHeader = await getAuthHeader()
      const res = await fetch(`${WEB_API}/admin/documents-by-user?email=${encodeURIComponent(searchEmail.trim())}`, { headers: { ...authHeader, ...twoFAHeader() } })
      setSearchResults(res.ok ? await res.json() : { email: searchEmail, documents: [], error: true })
    } finally {
      setSearching(false)
    }
  }

  async function suspendRenderService() {
    if (!confirm('¿Seguro que quieres suspender el backend en Render? La app dejará de funcionar para todos hasta que lo reanudes desde el propio panel de Render (este panel no podrá reanudarlo porque se apaga con él).')) return
    setRenderActionBusy(true)
    try {
      const authHeader = await getAuthHeader()
      await fetch(`${WEB_API}/admin/render/suspend`, { method: 'POST', headers: { ...authHeader, ...twoFAHeader() } })
    } finally {
      setRenderActionBusy(false)
    }
  }

  // Puerta de verificación: 2FA activo pero sin token de sesión todavía --
  // no se carga ningún dato del panel hasta pasar el código.
  if (twoFAEnabled && !twoFAToken) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="card max-w-sm w-full space-y-4 text-center">
          <p className="text-4xl">🔐</p>
          <h1 className="text-lg font-semibold text-slate-100">Verificación en dos pasos</h1>
          <p className="text-sm text-slate-400">Introduce el código de tu app de autenticación (o un código de respaldo).</p>
          <input
            type="text" inputMode="numeric" autoFocus value={twoFACode}
            onChange={e => setTwoFACode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && verifyTwoFA()}
            placeholder="123456" className="input w-full text-center text-lg tracking-widest"
          />
          {twoFAError && <p className="text-red-400 text-sm">{twoFAError}</p>}
          <button onClick={verifyTwoFA} disabled={verifying2FA || !twoFACode.trim()} className="btn-primary w-full disabled:opacity-50">
            {verifying2FA ? 'Verificando…' : 'Verificar'}
          </button>
        </div>
      </div>
    )
  }

  if (twoFAEnabled === null) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="card max-w-sm text-center">
          <p className="text-4xl mb-3">🔒</p>
          <p className="text-slate-300 font-semibold">{error}</p>
          <p className="text-slate-500 text-sm mt-1">{user?.email}</p>
        </div>
      </div>
    )
  }

  const { db, limits, ai_usage, top_ai_users, ai_daily_trend, render_hours_used, sentry_summary, orphaned_storage_objects, recent_feedback } = stats
  const trendData = (ai_daily_trend || []).filter(d => {
    const days = (Date.now() - new Date(d.day).getTime()) / 86400000
    return days <= trendRange
  })
  const dbPct      = (db.db_bytes / limits.db_bytes) * 100
  const storagePct = (db.storage_bytes / limits.storage_bytes) * 100
  const aiPct      = (ai_usage.month_cost_eur / limits.ai_budget_eur) * 100
  const renderPct  = (render_hours_used / limits.render_hours) * 100

  const alerts = []
  if (dbPct >= 80) alerts.push(`Base de datos al ${Math.round(dbPct)}% del límite gratuito`)
  if (storagePct >= 80) alerts.push(`Storage al ${Math.round(storagePct)}% del límite gratuito`)
  if (aiPct >= 80) alerts.push(`Presupuesto de IA al ${Math.round(aiPct)}% del mes`)
  if (renderPct >= 80) alerts.push(`Horas de Render al ${Math.round(renderPct)}% del límite gratuito`)
  if (db.documents_suspicious > 0) alerts.push(`${db.documents_suspicious} documento(s) sospechoso(s) detectado(s)`)
  if (db.storage_orphaned_objects > 0) alerts.push(`${db.storage_orphaned_objects} archivo(s) huérfano(s) en Storage (de cuentas ya borradas)`)

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Panel de control</h1>
        <button onClick={load} className="btn-secondary btn-sm">🔄 Actualizar</button>
      </div>

      {alerts.length > 0 && (
        <div className="card border border-amber-500/40 bg-amber-500/5 space-y-1.5">
          {alerts.map((a, i) => (
            <p key={i} className="text-sm text-amber-300">⚠️ {a}</p>
          ))}
        </div>
      )}

      {/* Seguridad — verificación en dos pasos del panel admin */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Seguridad</h2>

        {!twoFAEnabled && setupStep === null && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-400">La verificación en dos pasos no está activada.</p>
            <button onClick={startTwoFASetup} className="btn-secondary btn-sm shrink-0">Activar 2FA</button>
          </div>
        )}

        {setupStep === 'qr' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">Escanea este código con Google Authenticator, Authy o similar:</p>
            {setupQr && <img src={`data:image/png;base64,${setupQr}`} alt="Código QR del 2FA" className="mx-auto rounded-lg bg-white p-2 w-48 h-48" />}
            <p className="text-[11px] text-slate-500 text-center">¿No puedes escanear? Clave manual: <span className="font-mono">{setupSecret}</span></p>
            <input
              type="text" inputMode="numeric" value={twoFACode}
              onChange={e => setTwoFACode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmTwoFASetup()}
              placeholder="Código de 6 dígitos" className="input w-full text-center"
            />
            {twoFAError && <p className="text-red-400 text-sm">{twoFAError}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setSetupStep(null); setTwoFACode(''); setTwoFAError('') }} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={confirmTwoFASetup} disabled={verifying2FA || !twoFACode.trim()} className="btn-primary flex-1 disabled:opacity-50">
                {verifying2FA ? 'Confirmando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        )}

        {setupStep === 'backup-codes' && backupCodes && (
          <div className="space-y-3">
            <p className="text-sm text-emerald-400 font-semibold">✓ 2FA activado</p>
            <p className="text-sm text-slate-300">Guarda estos códigos de respaldo en un sitio seguro — cada uno solo sirve una vez, y son la única forma de entrar si pierdes el móvil.</p>
            <div className="bg-slate-900 rounded-lg p-3 grid grid-cols-2 gap-1.5 font-mono text-sm text-slate-200">
              {backupCodes.map(c => <span key={c}>{c}</span>)}
            </div>
            <button onClick={() => { setSetupStep(null); setBackupCodes(null) }} className="btn-primary w-full">Ya los he guardado</button>
          </div>
        )}

        {twoFAEnabled && setupStep === null && (
          <div className="space-y-2">
            <p className="text-sm text-emerald-400">✓ Verificación en dos pasos activada.</p>
            <div className="flex items-end gap-2">
              <input
                type="text" inputMode="numeric" value={disableCode}
                onChange={e => setDisableCode(e.target.value)}
                placeholder="Código para desactivar" className="input flex-1 text-sm"
              />
              <button onClick={disableTwoFA} disabled={disabling2FA || !disableCode.trim()} className="btn-secondary btn-sm shrink-0 disabled:opacity-50">
                {disabling2FA ? 'Desactivando…' : 'Desactivar'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Estado de servicios */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Estado de servicios</h2>
        {Object.entries(stats.services).map(([name, s]) => (
          <div key={name} className="flex items-center gap-3">
            <StatusDot status={s.status} />
            <span className="text-sm text-slate-300 capitalize flex-1">{name}</span>
            <span className={`text-xs font-medium ${s.status === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
              {s.status === 'up' ? 'Activo' : 'Caído'}
            </span>
          </div>
        ))}

        {stats.uptime_monitor && (
          <div className="pt-2 mt-1 border-t border-slate-800">
            <div className="flex items-center gap-3">
              <StatusDot status={stats.uptime_monitor.status} />
              <span className="text-sm text-slate-300 flex-1">UptimeRobot (backend nunca duerme)</span>
              <span className={`text-xs font-medium ${stats.uptime_monitor.status === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
                {stats.uptime_monitor.status === 'up' ? 'Activo' : 'Caído'}
              </span>
            </div>
            <div className="flex gap-4 mt-2 pl-5 text-xs text-slate-500">
              <span>24h: <span className="text-slate-300">{stats.uptime_monitor.uptime_1d.toFixed(2)}%</span></span>
              <span>7d: <span className="text-slate-300">{stats.uptime_monitor.uptime_7d.toFixed(2)}%</span></span>
              <span>30d: <span className="text-slate-300">{stats.uptime_monitor.uptime_30d.toFixed(2)}%</span></span>
            </div>
            {stats.uptime_monitor.last_event && (
              <p className="text-[11px] text-slate-600 pl-5 mt-1">
                Último evento: {stats.uptime_monitor.last_event.type === 'down' ? '🔴 caída' : '🟢 recuperado'} — {stats.uptime_monitor.last_event.reason || 'sin detalle'} ({new Date(stats.uptime_monitor.last_event.datetime * 1000).toLocaleString('es-ES')})
              </p>
            )}
          </div>
        )}
      </div>

      {/* Círculos de ocupación */}
      <div className="card">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Uso frente al máximo</h2>
        <div className="flex flex-wrap justify-around gap-4">
          <RingGauge
            pct={dbPct}
            title="Base de datos"
            top="usado"
            bottom={`${bytesToMB(db.db_bytes)} / ${bytesToMB(limits.db_bytes)} MB`}
          />
          <RingGauge
            pct={storagePct}
            title="Storage"
            top="usado"
            bottom={`${bytesToMB(db.storage_bytes)} / ${bytesToMB(limits.storage_bytes)} MB`}
          />
          <RingGauge
            pct={aiPct}
            title="Presupuesto IA (mes)"
            top="gastado"
            bottom={`${ai_usage.month_cost_eur.toFixed(2)} € / ${limits.ai_budget_eur.toFixed(0)} €`}
          />
          <RingGauge
            pct={renderPct}
            title="Horas Render (mes)"
            top="usado (estimado)"
            bottom={`${render_hours_used.toFixed(0)} / ${limits.render_hours} h`}
          />
        </div>
      </div>

      {/* Supabase: detalle numérico */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Usuarios y documentos</h2>
        <p className="text-[11px] text-slate-600 -mt-1">Suma de todas las cuentas, no solo la tuya.</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800/50 rounded-xl p-3">
            <p className="text-2xl font-bold text-slate-100">{db.users_total}</p>
            <p className="text-xs text-slate-500">Usuarios totales</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-3">
            <p className="text-2xl font-bold text-emerald-400">+{db.users_new_7d}</p>
            <p className="text-xs text-slate-500">Nuevos (7 días)</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-3">
            <p className="text-2xl font-bold text-slate-100">{db.documents_active}</p>
            <p className="text-xs text-slate-500">Documentos activos</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-3">
            <p className="text-2xl font-bold text-slate-600">{db.documents_deleted}</p>
            <p className="text-xs text-slate-500">Borrados (histórico)</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-3">
            <p className="text-2xl font-bold text-slate-100">{db.storage_objects}</p>
            <p className="text-xs text-slate-500">Archivos en Storage</p>
          </div>
          <div className={`rounded-xl p-3 ${db.documents_suspicious > 0 ? 'bg-amber-500/10' : 'bg-slate-800/50'}`}>
            <p className={`text-2xl font-bold ${db.documents_suspicious > 0 ? 'text-amber-400' : 'text-slate-100'}`}>{db.documents_suspicious}</p>
            <p className="text-xs text-slate-500">Sospechosos (sin título)</p>
          </div>
          <div className={`rounded-xl p-3 col-span-2 ${db.storage_orphaned_objects > 0 ? 'bg-amber-500/10' : 'bg-slate-800/50'}`}>
            <p className={`text-2xl font-bold ${db.storage_orphaned_objects > 0 ? 'text-amber-400' : 'text-slate-100'}`}>{db.storage_orphaned_objects}</p>
            <p className="text-xs text-slate-500">Archivos huérfanos en Storage ({bytesToMB(db.storage_orphaned_bytes)} MB)</p>
          </div>
        </div>
      </div>

      {/* Uso por función — para saber en qué centrarse */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Uso por función</h2>
        <p className="text-[11px] text-slate-600 -mt-1">Histórico completo, todas las cuentas.</p>
        <FeatureUsageChart items={featureUsage} />
      </div>

      {/* Códigos de invitación — el registro público está siempre abierto; estos códigos son opcionales, para campañas puntuales */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Códigos de invitación</h2>
        <p className="text-[11px] text-slate-600 -mt-1">Opcionales — el registro normal no los pide. Se validan en la base de datos si se usan.</p>

        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[11px] text-slate-500 mb-1">Nota (opcional)</label>
            <input type="text" value={inviteNote} onChange={e => setInviteNote(e.target.value)}
              placeholder="ej. familia, amigos" className="input w-full text-sm" />
          </div>
          <div className="w-24">
            <label className="block text-[11px] text-slate-500 mb-1">Usos</label>
            <input type="number" min={1} value={inviteMaxUses} onChange={e => setInviteMaxUses(e.target.value)}
              className="input w-full text-sm" />
          </div>
          <div className="w-28">
            <label className="block text-[11px] text-slate-500 mb-1">Caduca (días)</label>
            <input type="number" min={1} value={inviteExpiresDays} onChange={e => setInviteExpiresDays(e.target.value)}
              placeholder="nunca" className="input w-full text-sm" />
          </div>
          <button onClick={createInviteCode} disabled={creatingInvite} className="btn-secondary btn-sm shrink-0 disabled:opacity-50">
            {creatingInvite ? 'Creando…' : '+ Crear código'}
          </button>
        </div>

        {lastCreatedCode && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-2 text-emerald-400 text-sm font-mono">
            ✓ {lastCreatedCode}
          </div>
        )}

        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {inviteCodes.length === 0 ? (
            <p className="text-xs text-slate-600 italic">Sin códigos todavía.</p>
          ) : inviteCodes.map(c => (
            <div key={c.code} className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-800 last:border-0">
              <div className="min-w-0">
                <span className="font-mono text-sm text-slate-200">{c.code}</span>
                {c.note && <span className="text-xs text-slate-500 ml-2">({c.note})</span>}
                <p className="text-[11px] text-slate-600">
                  {c.uses_count}/{c.max_uses} usos{c.expires_at ? ` · caduca ${new Date(c.expires_at).toLocaleDateString()}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${c.active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}>
                  {c.active ? 'activo' : 'inactivo'}
                </span>
                {c.active && (
                  <button onClick={() => deactivateInviteCode(c.code)} className="text-xs text-slate-500 hover:text-red-400 transition-colors">
                    desactivar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Anuncios — mensaje que ven todos los usuarios al entrar (web/escritorio/móvil) */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Anuncios</h2>
        <p className="text-[11px] text-slate-600 -mt-1">Solo se muestra el más reciente activo. Cada usuario lo ve una vez, hasta que lo cierre.</p>

        <div className="space-y-2">
          <input type="text" value={annTitle} onChange={e => setAnnTitle(e.target.value)}
            placeholder="Título (ej. ¡Gracias por confiar en nosotros!)" className="input w-full text-sm" />
          <textarea value={annMessage} onChange={e => setAnnMessage(e.target.value)} rows={3}
            placeholder="Mensaje..." className="input w-full text-sm resize-none" />
          <input type="text" value={annLink} onChange={e => setAnnLink(e.target.value)}
            placeholder="Enlace opcional (ej. https://mystudyai.eu/novedades)" className="input w-full text-sm" />
          <button onClick={createAnnouncement} disabled={creatingAnn || !annTitle.trim() || !annMessage.trim()}
            className="btn-secondary btn-sm disabled:opacity-50">
            {creatingAnn ? 'Publicando…' : '+ Publicar anuncio'}
          </button>
        </div>

        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {announcements.length === 0 ? (
            <p className="text-xs text-slate-600 italic">Sin anuncios todavía.</p>
          ) : announcements.map(a => (
            <div key={a.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-800 last:border-0">
              <div className="min-w-0">
                <span className="text-sm text-slate-200">{a.title}</span>
                <p className="text-[11px] text-slate-600 truncate">{a.message}</p>
                <p className="text-[10px] text-slate-700">{new Date(a.created_at).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${a.active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}>
                  {a.active ? 'activo' : 'inactivo'}
                </span>
                {a.active && (
                  <button onClick={() => deactivateAnnouncement(a.id)} className="text-xs text-slate-500 hover:text-red-400 transition-colors">
                    desactivar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Archivos huerfanos de Storage — con opcion de borrarlos */}
      {orphaned_storage_objects && orphaned_storage_objects.length > 0 && (
        <div className="card space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">Archivos huérfanos en Storage</h2>
            <button
              onClick={deleteOrphaned}
              disabled={orphanedSelected.length === 0 || deletingOrphaned}
              className="btn-secondary btn-sm disabled:opacity-40"
            >{deletingOrphaned ? 'Borrando…' : `Borrar seleccionados (${orphanedSelected.length})`}</button>
          </div>
          <p className="text-[11px] text-slate-600">De cuentas que ya no existen — seguro borrarlos, no pertenecen a nadie.</p>
          {orphaned_storage_objects.map(o => (
            <label key={o.name} className="flex items-center gap-3 py-1.5 border-b border-slate-800 last:border-0 cursor-pointer">
              <input
                type="checkbox"
                checked={orphanedSelected.includes(o.name)}
                onChange={(e) => setOrphanedSelected(prev => e.target.checked ? [...prev, o.name] : prev.filter(p => p !== o.name))}
              />
              <span className="flex-1 text-sm text-slate-300 truncate">{o.name}</span>
              <span className="text-xs text-slate-500">{(o.size_bytes / 1024).toFixed(1)} KB</span>
            </label>
          ))}
        </div>
      )}

      {/* Buscar documentos por usuario (moderacion) */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Buscar documentos por usuario</h2>
        <div className="flex gap-2">
          <input
            type="email"
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchDocumentsByUser()}
            placeholder="email@ejemplo.com"
            className="input flex-1 text-sm"
          />
          <button onClick={searchDocumentsByUser} disabled={searching} className="btn-secondary btn-sm">
            {searching ? '…' : 'Buscar'}
          </button>
        </div>
        {searchResults && (
          searchResults.documents.length === 0 ? (
            <p className="text-sm text-slate-500">Sin documentos para {searchResults.email}.</p>
          ) : (
            <div className="space-y-1.5">
              {searchResults.documents.map(d => (
                <div key={d.id} className="flex items-center justify-between py-1.5 border-b border-slate-800 last:border-0">
                  <span className={`text-sm truncate ${d.deleted_at ? 'text-slate-600 line-through' : 'text-slate-300'}`}>{d.title || '(sin título)'}</span>
                  <span className="text-xs text-slate-500 shrink-0 ml-2">{new Date(d.created_at).toLocaleDateString('es-ES')} · {d.pages}p</span>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Top usuarios por consumo de IA (desplegable) */}
      <details className="card group">
        <summary className="text-sm font-semibold text-slate-400 uppercase tracking-wider cursor-pointer list-none flex items-center justify-between">
          <span>Top usuarios — IA este mes ({top_ai_users?.length || 0})</span>
          <span className="text-slate-500 transition-transform group-open:rotate-180">▾</span>
        </summary>
        <div className="mt-3 space-y-2">
          {(!top_ai_users || top_ai_users.length === 0) ? (
            <p className="text-sm text-slate-500">Todavía no hay uso de IA registrado este mes.</p>
          ) : (
            top_ai_users.map((u, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-800 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-300">{u.email_masked}</span>
                  {u.plan_tier && (
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      u.plan_tier === 'pro' ? 'bg-amber-900/40 text-amber-300'
                      : u.plan_tier === 'trial' ? 'bg-purple-900/40 text-purple-300'
                      : 'bg-slate-700/60 text-slate-400'
                    }`}>{u.plan_tier}</span>
                  )}
                  {u.cap_hit && (
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-900/40 text-red-400">
                      🚫 bloqueado por tope
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${u.cap_hit ? 'text-red-400' : 'text-amber-400'}`}>{u.cost_eur.toFixed(3)} €</p>
                  <p className="text-xs text-slate-500">{u.requests} peticiones · {(u.tokens_in + u.tokens_out).toLocaleString()} tokens</p>
                </div>
              </div>
            ))
          )}
        </div>
      </details>

      {/* Tendencia diaria de gasto de IA */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Tendencia de gasto de IA</h2>
          <div className="flex gap-1">
            <RangeButton value={7} current={trendRange} onClick={setTrendRange}>7d</RangeButton>
            <RangeButton value={30} current={trendRange} onClick={setTrendRange}>30d</RangeButton>
            <RangeButton value={90} current={trendRange} onClick={setTrendRange}>90d</RangeButton>
          </div>
        </div>
        <DailyTrendChart data={trendData} />
      </div>

      {/* Feedback reciente de usuarios (desplegable) */}
      <details className="card group">
        <summary className="text-sm font-semibold text-slate-400 uppercase tracking-wider cursor-pointer list-none flex items-center justify-between">
          <span>Feedback de usuarios ({recent_feedback?.length || 0})</span>
          <span className="text-slate-500 transition-transform group-open:rotate-180">▾</span>
        </summary>
        <div className="mt-3 space-y-2">
          {(!recent_feedback || recent_feedback.length === 0) ? (
            <p className="text-sm text-slate-500">Sin feedback todavía.</p>
          ) : (
            recent_feedback.map(f => (
              <div key={f.id} className="py-2 border-b border-slate-800 last:border-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{f.type} · {f.platform} · {f.user_email}</span>
                  <span className="text-[11px] text-slate-600">{new Date(f.created_at).toLocaleDateString('es-ES')}</span>
                </div>
                <p className="text-sm text-slate-300 mt-0.5">{f.message}</p>
              </div>
            ))
          )}
        </div>
      </details>

      {/* Render: historial de despliegues + suspender */}
      <div className="card space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Render — despliegues</h2>
          <button
            onClick={suspendRenderService}
            disabled={renderActionBusy}
            className="text-xs bg-red-900/40 text-red-300 border border-red-700/50 rounded px-2.5 py-1 hover:bg-red-800/50 transition-colors disabled:opacity-40"
          >{renderActionBusy ? '…' : '⏸ Suspender backend'}</button>
        </div>
        {renderDeploys.length === 0 ? (
          <p className="text-sm text-slate-500">Sin datos de despliegues (¿RENDER_API_KEY configurado?).</p>
        ) : (
          renderDeploys.map(d => (
            <div key={d.id} className="flex items-center justify-between py-1.5 border-b border-slate-800 last:border-0">
              <span className="text-sm text-slate-300 truncate">{d.commit_message || d.id}</span>
              <span className={`text-xs shrink-0 ml-2 ${d.status === 'live' ? 'text-emerald-400' : d.status.includes('fail') ? 'text-red-400' : 'text-slate-500'}`}>
                {d.status} · {d.created_at ? new Date(d.created_at).toLocaleDateString('es-ES') : ''}
              </span>
            </div>
          ))
        )}
        <p className="text-[11px] text-slate-600 pt-1">
          Suspender apaga el backend para todos. Solo se puede reanudar desde el propio panel de Render (dashboard.render.com), no desde aquí — este panel deja de responder si el backend está suspendido.
        </p>
      </div>

      {/* Sentry — resumen de errores */}
      {sentry_summary && (
        <div className="card space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Errores (Sentry, 24h)</h2>
            <span className={`text-lg font-bold ${sentry_summary.unresolved_count > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {sentry_summary.unresolved_count}{sentry_summary.capped ? '+' : ''}
            </span>
          </div>
          {sentry_summary.top_issues.length === 0 ? (
            <p className="text-sm text-slate-500">Sin errores nuevos sin resolver.</p>
          ) : (
            sentry_summary.top_issues.map((i, idx) => (
              <div key={idx} className="py-1.5 border-b border-slate-800 last:border-0">
                <p className="text-sm text-slate-300 truncate">{i.title}</p>
                <p className="text-xs text-slate-500">{i.culprit} · {i.count} eventos</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Gasto de IA — detalle por proveedor */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Gasto estimado — este mes</h2>
          <span className="text-lg font-bold text-emerald-400">{ai_usage.month_cost_eur.toFixed(3)} €</span>
        </div>
        {Object.keys(ai_usage.month).length === 0 ? (
          <p className="text-sm text-slate-500">Todavía no hay uso registrado este mes.</p>
        ) : (
          Object.entries(ai_usage.month).map(([provider, data]) => (
            <UsageRow key={provider} provider={provider} data={data} />
          ))
        )}

        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider pt-2">Hoy</h2>
        {Object.keys(ai_usage.today).length === 0 ? (
          <p className="text-sm text-slate-500">Sin uso hoy todavía.</p>
        ) : (
          Object.entries(ai_usage.today).map(([provider, data]) => (
            <UsageRow key={provider} provider={provider} data={data} />
          ))
        )}
        <p className="text-[11px] text-slate-600 pt-1">
          Coste estimado a partir del número de caracteres enviados/recibidos — orientativo, no exacto. El presupuesto de {limits.ai_budget_eur.toFixed(0)}€/mes es una referencia propia, no un límite real de ningún proveedor.
        </p>

        {ai_usage.pricing && (
          <div className="pt-3 border-t border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Precios usados en el cálculo ($/1M)</h3>
              {ai_usage.pricing_last_updated && (
                <span className="text-[11px] text-slate-600">Revisado: {ai_usage.pricing_last_updated}</span>
              )}
            </div>
            {Object.entries(ai_usage.pricing).map(([provider, [priceIn, priceOut]]) => (
              <div key={provider} className="flex items-center justify-between text-xs text-slate-500">
                <span className="capitalize">{provider}</span>
                <span>${priceIn} / ${priceOut}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
