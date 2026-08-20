import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAppStore, api, apiUpload, IS_MOBILE, IS_WEB } from '../store/appStore'
import Spinner from '../components/UI/Spinner'
import Modal from '../components/UI/Modal'
import ProgressBar from '../components/UI/ProgressBar'
import Billing from '../lib/billingPlugin'
import { useAuth } from '../contexts/AuthContext'
import { useTranslation } from 'react-i18next'
import {
  IconFileText, IconCamera, IconBooks, IconFolder, IconBrain, IconFlame,
  IconChartBar, IconScale, IconAlertTriangle, IconCrown, IconLoader2,
} from '@tabler/icons-react'
import IconBadge from '../components/UI/IconBadge'

export default function Home() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { backendReady, addToast, planTier, setPlanTier } = useAppStore()
  // Uso del plan (solo app móvil completa -- en escritorio/web se ve en el
  // Sidebar, que aquí no se monta, ver Layout.jsx).
  const [usage, setUsage] = useState(null)

  // ── Suscripción Pro / bonos (solo app móvil completa) ──────────────────
  const [productPrice,  setProductPrice]  = useState('')
  const [purchasing,    setPurchasing]    = useState(false)
  const [purchaseError, setPurchaseError] = useState(null)
  const [bonoPrices,    setBonoPrices]    = useState({})
  const [buyingBono,    setBuyingBono]    = useState(null)
  const [bonoMessage,   setBonoMessage]   = useState(null)

  useEffect(() => {
    if (!IS_MOBILE || planTier === 'pro') return
    Billing.queryProducts().then(p => setProductPrice(p.formattedPrice)).catch(() => {})
  }, [planTier])

  useEffect(() => {
    if (!IS_MOBILE || planTier !== 'pro') return
    Billing.queryBonoProducts().then(setBonoPrices).catch(() => {})
  }, [planTier])

  async function handleGoPro() {
    setPurchasing(true)
    setPurchaseError(null)
    try {
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

  async function handleBuyBono(category) {
    setBuyingBono(category)
    setBonoMessage(null)
    try {
      await Billing.purchaseBono({ category, accountId: user.id })
      setBonoMessage({ type: 'ok', text: 'Compra completada — el bono se añadirá en unos segundos.' })
    } catch (e) {
      setBonoMessage({ type: 'error', text: e?.message || 'No se pudo completar la compra' })
    } finally {
      setBuyingBono(null)
    }
  }
  // ── Suscripción Pro / bonos (web, vía Stripe) ───────────────────────────
  const [billingBusy, setBillingBusy] = useState(null) // 'pro' | 'transcription' | 'podcast' | null
  const [canarias, setCanarias] = useState(() => localStorage.getItem('billing_canarias') === '1')
  function toggleCanarias(checked) {
    setCanarias(checked)
    localStorage.setItem('billing_canarias', checked ? '1' : '0')
  }
  const STRIPE_PRICES = {
    pro:           'price_1U6EFGBUwE5wbpTtmWFqx4Jk',
    transcription: 'price_1U6EFGBUwE5wbpTtPo2IKUr0',
    podcast:       'price_1U6EFHBUwE5wbpTt0fQuBaqD',
  }
  async function handleStripeCheckout(kind) {
    setBillingBusy(kind)
    try {
      const res = await api('POST', '/billing/create-checkout-session', { price_id: STRIPE_PRICES[kind], canarias })
      window.location.href = res.url
    } catch (e) {
      addToast(e.message || 'No se pudo iniciar el pago', 'error')
      setBillingBusy(null)
    }
  }

  const [recentDocs, setRecentDocs] = useState([])
  const [subjects, setSubjects] = useState([])
  const [mastery, setMastery] = useState([])
  const [dueCards, setDueCards] = useState(0)
  const [streakDays, setStreakDays] = useState(0)
  const [loading, setLoading] = useState(true)
  const [pendingFiles, setPendingFiles] = useState(null)
  const [pendingImages, setPendingImages] = useState(null)
  const [selectedSubject, setSelectedSubject] = useState('')
  const [subjectTopics, setSubjectTopics] = useState([])
  const [selectedTopic, setSelectedTopic] = useState('')
  const [uploading, setUploading] = useState(false)
  const [newSubjectName, setNewSubjectName] = useState('')
  const [newSubjectColor, setNewSubjectColor] = useState('#3b82f6')
  const [creatingSubject, setCreatingSubject] = useState(false)
  // Multi-PDF combine
  const [uploadedDocIds, setUploadedDocIds] = useState([])
  const [combineModal, setCombineModal] = useState(false)
  const [combineInfo, setCombineInfo] = useState(null)
  const [combineTitle, setCombineTitle] = useState('')
  const [combining, setCombining] = useState(false)
  // Exámenes próximos
  const [reminders, setReminders]       = useState([])
  const [showAddExam, setShowAddExam]   = useState(false)
  const [examTitle, setExamTitle]       = useState('')
  const [examDate, setExamDate]         = useState('')
  const [examSubjectId, setExamSubjectId] = useState('')
  const [examCustomColor, setExamCustomColor] = useState(false)
  const [examColor, setExamColor]       = useState('#8b5cf6')
  const fileInputRef = useRef()
  const imageInputRef = useRef()
  const navigate = useNavigate()

  useEffect(() => {
    if (!backendReady) return
    Promise.allSettled([
      api('GET', '/documents?limit=6&sort=recent'),
      api('GET', '/subjects'),
      api('GET', '/flashcards/due-count'),
      api('GET', '/exams/reminders'),
      api('GET', '/subjects/mastery'),
      api('GET', '/stats/overview'),
    ]).then(([docs, subs, due, rems, mast, stats]) => {
      const d = docs.status === 'fulfilled' ? docs.value : {}
      const s = subs.status === 'fulfilled' ? subs.value : {}
      const c = due.status === 'fulfilled' ? due.value : {}
      const r = rems.status === 'fulfilled' ? rems.value : {}
      const m = mast.status === 'fulfilled' ? mast.value : {}
      const st = stats.status === 'fulfilled' ? stats.value : {}
      setRecentDocs(d.items || (Array.isArray(d) ? d : []))
      setSubjects(s.items || (Array.isArray(s) ? s : []))
      setDueCards(c.count || 0)
      setReminders(r.items || (Array.isArray(r) ? r : []))
      setMastery(m.items || (Array.isArray(m) ? m : []))
      setStreakDays(st.streak_days || 0)
    }).finally(() => setLoading(false))
  }, [backendReady])

  useEffect(() => {
    if (!IS_MOBILE || !backendReady) return
    api('GET', '/usage/summary').then(setUsage).catch(() => {})
  }, [backendReady])

  useEffect(() => {
    setSelectedTopic('')
    if (!backendReady || !selectedSubject) { setSubjectTopics([]); return }
    api('GET', `/subjects/${selectedSubject}/topics`)
      .then(r => setSubjectTopics(r.items || []))
      .catch(() => setSubjectTopics([]))
  }, [selectedSubject, backendReady])

  function openFilePicker() { fileInputRef.current.click() }
  function openImagePicker() { imageInputRef.current.click() }

  function handleFilesSelected(files) {
    if (!files.length) return
    setPendingFiles(files)
    setSelectedSubject('')
  }

  function handleImagesSelected(files) {
    if (!files.length) return
    setPendingImages(files)
    setSelectedSubject('')
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const allFiles = Array.from(e.dataTransfer.files)
    const pdfs = allFiles.filter(f => f.type === 'application/pdf')
    const images = allFiles.filter(f => f.type.startsWith('image/'))
    if (pdfs.length) { handleFilesSelected(pdfs); return }
    if (images.length) { handleImagesSelected(images); return }
    addToast(t('home.dragPdfOrImage'), 'warning')
  }

  async function createSubjectInline() {
    if (!newSubjectName.trim()) return
    if (!backendReady) { addToast('El servidor aún está arrancando, espera un momento...', 'warning'); return }
    try {
      const s = await api('POST', '/subjects', { name: newSubjectName.trim(), color: newSubjectColor })
      setSubjects(prev => [...prev, s])
      setSelectedSubject(String(s.id))
      setNewSubjectName('')
      setCreatingSubject(false)
    } catch (e) { addToast(e.message, 'error') }
  }

  async function confirmUpload() {
    if (!pendingFiles?.length) return
    setUploading(true)
    const docIds = []
    let lastDocId = null
    for (const file of pendingFiles) {
      const fd = new FormData()
      fd.append('file', file)
      if (selectedTopic) fd.append('topic_id', selectedTopic)
      else if (selectedSubject) fd.append('subject_id', selectedSubject)
      fd.append('content_type', 'printed')  // un PDF subido tal cual es casi siempre texto impreso
      try {
        const doc = await apiUpload('/documents/upload', fd)
        docIds.push(doc.id)
        lastDocId = doc.id
        addToast(`"${doc.title}" importado`, 'success')
      } catch (e) {
        addToast(`Error: ${e.message}`, 'error')
      }
    }
    setUploading(false)
    setPendingFiles(null)

    if (docIds.length >= 2) {
      // Offer combined summary
      setUploadedDocIds(docIds)
      setCombineTitle('')
      setCombineInfo(null)
      setCombineModal(true)
      // Fetch info about size/strategy
      api('GET', `/documents/multi-summary/info?doc_ids=${docIds.join(',')}`)
        .then(info => setCombineInfo(info))
        .catch(() => {})
    } else if (lastDocId) {
      navigate(`/document/${lastDocId}`)
    }
  }

  async function confirmCombine() {
    if (!uploadedDocIds.length) return
    setCombining(true)
    try {
      const res = await api('POST', '/documents/multi-summary', {
        doc_ids: uploadedDocIds,
        title: combineTitle.trim() || undefined,
      })
      setCombineModal(false)
      addToast(`Resumen combinado generado (${combineInfo?.strategy === 'multi_pass' ? 'multi-paso' : 'paso único'})`, 'success')
      navigate(`/document/${res.doc_id}`, { state: { autoResult: res.result, autoAction: 'summary' } })
    } catch (e) {
      addToast(`Error: ${e.message}`, 'error')
    } finally {
      setCombining(false)
    }
  }

  async function confirmImageUpload() {
    if (!pendingImages?.length) return
    setUploading(true)
    let lastDocId = null
    for (const file of pendingImages) {
      const fd = new FormData()
      fd.append('file', file)
      if (selectedTopic) fd.append('topic_id', selectedTopic)
      else if (selectedSubject) fd.append('subject_id', selectedSubject)
      fd.append('content_type', 'handwritten')  // foto suelta: más probable que sea letra manuscrita
      try {
        const doc = await apiUpload('/documents/upload-image', fd)
        lastDocId = doc.id
        const chars = doc.char_count || 0
        addToast(`"${doc.title}" — ${chars} ${t('home.photoModal.extracted')}`, 'success')
      } catch (e) {
        addToast(`Error procesando imagen: ${e.message}`, 'error')
      }
    }
    setUploading(false)
    setPendingImages(null)
    if (lastDocId) navigate(`/document/${lastDocId}`)
  }

  // Ya no bloqueamos la pantalla si el backend no está listo.
  // El banner de Layout ya informa al usuario y el resto de la app sigue usable.

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        multiple
        className="hidden"
        onChange={e => handleFilesSelected(Array.from(e.target.files))}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        multiple
        className="hidden"
        onChange={e => handleImagesSelected(Array.from(e.target.files))}
      />

      {/* Hero drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-slate-600 hover:border-primary-500 rounded-2xl p-8 text-center
                   transition-all duration-200 mb-8"
      >
        <div className="flex justify-center mb-3"><IconBadge icon={IconFileText} color="blue" size="lg" /></div>
        <h2 className="text-xl font-semibold text-slate-200 mb-2">{t('home.dropzoneTitle')}</h2>
        <p className="text-slate-400 text-sm mb-5">{t('home.dropzoneDesc')}</p>
        <div className="flex justify-center gap-3">
          <button
            onClick={openFilePicker}
            className="btn-primary flex items-center gap-2"
          >
            <IconFileText size={16} /> {t('home.uploadPdf')}
          </button>
          <button
            onClick={openImagePicker}
            className="btn-secondary flex items-center gap-2"
          >
            <IconCamera size={16} /> {t('home.uploadPhoto')}
          </button>
        </div>
        <p className="flex items-center justify-center gap-1.5 text-xs text-amber-500/80 mt-4">
          <IconAlertTriangle size={14} className="shrink-0" /> {t('home.sensitiveDataWarning')}
        </p>
        <p className="text-xs text-slate-500 mt-1.5">💡 {t('home.drawingsTip')}</p>
      </div>

      {/* Exámenes próximos */}
      {(reminders.length > 0 || showAddExam) && (
        <div className="mb-6 bg-slate-800/60 rounded-2xl p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              📅 {t('home.upcomingExams')}
            </h3>
            <button onClick={() => setShowAddExam(s => !s)}
              className="text-xs text-violet-400 hover:text-violet-300">
              {showAddExam ? t('home.cancelExam') : t('home.addExam')}
            </button>
          </div>

          {/* Lista */}
          <div className="space-y-2 mb-3">
            {reminders.map(r => {
              const urgent = r.days_left <= 1
              const soon   = r.days_left <= 3
              const dotColor = r.color || r.subject_color || '#8b5cf6'
              return (
                <div key={r.id} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${urgent ? 'bg-red-900/30 border border-red-800/50' : soon ? 'bg-amber-900/20 border border-amber-800/30' : 'bg-slate-700/40'}`}>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} title={r.subject_name || ''} />
                  <span className="text-lg">{urgent ? '🚨' : soon ? '⚠️' : '📝'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-100 truncate">{r.title}</p>
                    <p className="text-xs text-slate-400">
                      {r.subject_name && `${r.subject_name} · `}
                      {r.days_left === 0 ? t('home.today') : r.days_left === 1 ? t('home.tomorrow') : t('home.inDays', { count: r.days_left })}
                      {' · '}{new Date(r.exam_date).toLocaleDateString('es', { day:'numeric', month:'short' })}
                    </p>
                  </div>
                  <button onClick={async () => {
                    await api('DELETE', `/exams/reminders/${r.id}`)
                    setReminders(prev => prev.filter(x => x.id !== r.id))
                  }} className="text-slate-600 hover:text-red-400 text-xs shrink-0">✕</button>
                </div>
              )
            })}
          </div>

          {/* Formulario añadir */}
          {showAddExam && (
            <form onSubmit={async e => {
              e.preventDefault()
              if (!examTitle || !examDate) return
              const res = await api('POST', '/exams/reminders', {
                title: examTitle, exam_date: examDate,
                subject_id: examSubjectId ? (isNaN(Number(examSubjectId)) ? examSubjectId : Number(examSubjectId)) : null,
                color: examCustomColor ? examColor : null,
              })
              const rems = await api('GET', '/exams/reminders')
              setReminders(rems.items || [])
              setExamTitle(''); setExamDate(''); setExamSubjectId('')
              setExamCustomColor(false); setExamColor('#8b5cf6'); setShowAddExam(false)
            }} className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-700">
              <input required value={examTitle} onChange={e => setExamTitle(e.target.value)}
                placeholder={t('home.examName')} className="input flex-1 text-sm py-1.5 min-w-36" />
              <input required type="date" value={examDate} onChange={e => setExamDate(e.target.value)}
                className="input text-sm py-1.5" />
              <select value={examSubjectId} onChange={e => {
                  setExamSubjectId(e.target.value)
                  if (!examCustomColor) {
                    const subj = subjects.find(s => String(s.id) === e.target.value)
                    setExamColor(subj?.color || '#8b5cf6')
                  }
                }}
                className="input text-sm py-1.5">
                <option value=''>{t('home.noSubject')}</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <label className="flex items-center gap-1.5 text-xs text-slate-400">
                <input type="checkbox" checked={examCustomColor}
                  onChange={e => {
                    setExamCustomColor(e.target.checked)
                    if (!e.target.checked) {
                      const subj = subjects.find(s => String(s.id) === examSubjectId)
                      setExamColor(subj?.color || '#8b5cf6')
                    }
                  }}
                  className="w-3.5 h-3.5" />
                {t('calendar.customColor')}
              </label>
              {examCustomColor && (
                <input type="color" value={examColor} onChange={e => setExamColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" title="Color" />
              )}
              <button type="submit" className="btn-primary text-sm py-1.5 px-4">{t('home.save')}</button>
            </form>
          )}
        </div>
      )}

      {/* Botón añadir examen si no hay ninguno */}
      {reminders.length === 0 && !showAddExam && (
        <button onClick={() => setShowAddExam(true)}
          className="w-full mb-6 py-2 rounded-xl border border-dashed border-slate-700 text-xs text-slate-500 hover:text-slate-300 hover:border-slate-500 transition-colors">
          {t('home.addExamReminder')}
        </button>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard Icon={IconBooks} label={t('home.statDocs')} value={recentDocs.length} color="blue" onClick={() => navigate('/library')} />
        <StatCard Icon={IconFolder} label={t('home.statSubjects')} value={subjects.length} color="purple" onClick={() => navigate('/library')} />
        <StatCard Icon={IconBrain} label={t('home.statCards')} value={dueCards} color="green" onClick={() => navigate('/study')} />
        <StatCard Icon={IconFlame} label={t('home.statStreak')} value={streakDays} color="amber" onClick={() => navigate('/stats')} />
      </div>

      {/* Dominio por asignatura */}
      {mastery.filter(m => m.total_cards > 0).length > 0 && (
        <section className="mb-8">
          <h3 className="section-title">{t('home.masteryTitle')}</h3>
          <div className="card space-y-3">
            {mastery.filter(m => m.total_cards > 0).map(m => (
              <div key={m.id}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="flex items-center gap-2 text-slate-200">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                    {m.name}
                  </span>
                  <span className="text-slate-400 text-xs">
                    {m.mastery_pct === null ? t('home.masteryNoData') : `${m.mastery_pct}%`}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-700/60 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${m.mastery_pct ?? 0}%`, backgroundColor: m.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent documents */}
      {recentDocs.length > 0 && (
        <section className="mb-8">
          <h3 className="section-title">{t('home.recent')}</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {recentDocs.map(doc => (
              <DocCard key={doc.id} doc={doc} onClick={() => navigate(`/document/${doc.id}`)} />
            ))}
          </div>
        </section>
      )}

      {/* Quick actions */}
      <section className="mb-8">
        <h3 className="section-title">{t('home.quickActions')}</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { Icon: IconFileText, color: 'purple', label: t('home.newExam'),      to: '/exam' },
            { Icon: IconBrain,    color: 'green',  label: t('home.studyCards'),   to: '/study' },
            { Icon: IconChartBar, color: 'blue',   label: t('home.myProgress'),   to: '/stats' },
            { Icon: IconScale,    color: 'amber',  label: t('home.comparePdfs'), to: '/compare' },
          ].map(({ Icon, color, label, to }) => (
            <button key={to} onClick={() => navigate(to)}
              className="card-hover flex flex-col items-center gap-2 py-5 text-center">
              <IconBadge icon={Icon} color={color} size="lg" />
              <span className="text-sm font-medium text-slate-200">{label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Uso del plan (solo app móvil completa) */}
      {IS_MOBILE && usage && planTier === 'free' && (
        <section className="mb-8">
          <h3 className="section-title">Uso del plan Free · este ciclo</h3>
          <div className="card space-y-3">
            {[
              { label: 'Generaciones', used: usage.generations_used, max: usage.generations_max },
              { label: 'Voz y análisis de imagen (min)', used: usage.voice_minutes_used, max: usage.voice_minutes_max },
            ].map(({ label, used, max }) => (
              <div key={label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-400">{label}</span>
                  <span className={used >= max ? 'text-amber-400 font-semibold' : 'text-slate-400'}>{used}/{max}</span>
                </div>
                <ProgressBar value={used} max={max} color={used >= max ? 'yellow' : 'primary'} height="h-1.5" />
              </div>
            ))}
          </div>
        </section>
      )}

      {IS_MOBILE && usage?.voice_budget && planTier === 'pro' && (
        <section className="mb-8">
          <h3 className="section-title">Uso de voz este ciclo</h3>
          <div className="card space-y-3">
            {[
              { label: '🎙️ Transcripción', b: usage.voice_budget.transcription },
              { label: '🎧 Podcasts', b: usage.voice_budget.podcast },
            ].map(({ label, b }) => {
              const pct = b?.spent_pct ?? 0
              return (
              <div key={label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-400">{label}</span>
                  <span className={pct >= 90 ? 'text-amber-400 font-semibold' : 'text-slate-400'}>{pct}%</span>
                </div>
                <ProgressBar value={pct} max={100} color={pct >= 90 ? 'yellow' : 'primary'} height="h-1.5" />
                {b?.bono_left > 0 && (
                  <p className="text-[11px] text-primary-400 mt-1">+{b.bono_left} {b.bono_unit} de bono</p>
                )}
              </div>
              )
            })}
            {usage.bono_expires_at && (
              <p className="text-xs text-amber-400">
                Tu saldo de bonos caduca el {new Date(usage.bono_expires_at).toLocaleDateString()}. Vuelve a Pro para conservarlo.
              </p>
            )}
            {(usage.voice_budget.transcription?.spent_pct >= 90 || usage.voice_budget.podcast?.spent_pct >= 90) && (
              <p className="text-xs text-amber-400">
                Te estás quedando sin cupo de voz este ciclo.{' '}
                <a href="mailto:soporte@mystudyai.eu" className="underline">Escríbenos</a> para ampliarlo.
              </p>
            )}
          </div>
        </section>
      )}

      {/* ── Suscripción Pro / bonos (solo app móvil completa) ─────────── */}
      {IS_MOBILE && planTier && planTier !== 'pro' && (
        <section className="mb-8">
          <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-yellow-600/10 p-4">
            <div className="flex items-center gap-2 mb-1">
              <IconCrown size={18} className="text-amber-400" />
              <p className="text-sm font-semibold text-amber-300">Hazte Pro</p>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Más generaciones, más minutos de voz y sin límites de {planTier === 'trial' ? 'la prueba' : 'plan Free'}.
            </p>
            <button
              onClick={handleGoPro}
              disabled={purchasing}
              className="w-full py-3 rounded-xl font-semibold text-sm bg-amber-500 hover:bg-amber-600 text-slate-900 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {purchasing
                ? <><IconLoader2 size={16} className="animate-spin" /> Procesando...</>
                : `Suscribirme${productPrice ? ` — ${productPrice}` : ''}`}
            </button>
            {purchaseError && <p className="text-xs text-red-400 mt-2 text-center">{purchaseError}</p>}
          </div>
        </section>
      )}

      {IS_MOBILE && planTier === 'pro' && (
        <section className="mb-8">
          <h3 className="section-title">Ampliar cupo de voz</h3>
          <div className="card divide-y divide-slate-800">
            {[
              { category: 'transcription', emoji: '🎙️', label: '10h de transcripción extra' },
              { category: 'podcast',       emoji: '🎧', label: '10 podcasts extra' },
            ].map(({ category, emoji, label }) => (
              <div key={category} className="py-3 flex items-center justify-between gap-4">
                <p className="text-sm font-semibold text-slate-200">{emoji} {label}</p>
                <button
                  onClick={() => handleBuyBono(category)}
                  disabled={buyingBono === category}
                  className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50 flex items-center gap-2"
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

      {/* ── Suscripción Pro / bonos (web, vía Stripe) ───────────────────── */}
      {IS_WEB && planTier && planTier !== 'pro' && (
        <section className="mb-8">
          <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-yellow-600/10 p-4">
            <div className="flex items-center gap-2 mb-1">
              <IconCrown size={18} className="text-amber-400" />
              <p className="text-sm font-semibold text-amber-300">Hazte Pro</p>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Más generaciones, más minutos de voz y sin límites de {planTier === 'trial' ? 'la prueba' : 'plan Free'}.
            </p>
            <label className="flex items-center gap-2 text-xs text-slate-400 mb-3">
              <input type="checkbox" checked={canarias} onChange={(e) => toggleCanarias(e.target.checked)} />
              Resido en Canarias (se aplica IGIC en vez de IVA)
            </label>
            <button
              onClick={() => handleStripeCheckout('pro')}
              disabled={!!billingBusy}
              className="w-full py-3 rounded-xl font-semibold text-sm bg-amber-500 hover:bg-amber-600 text-slate-900 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {billingBusy === 'pro'
                ? <><IconLoader2 size={16} className="animate-spin" /> Redirigiendo...</>
                : 'Suscribirme — 15€/mes'}
            </button>
          </div>
        </section>
      )}

      {IS_WEB && planTier === 'pro' && (
        <section className="mb-8">
          <h3 className="section-title">Ampliar cupo de voz</h3>
          <label className="flex items-center gap-2 text-xs text-slate-400 mb-2">
            <input type="checkbox" checked={canarias} onChange={(e) => toggleCanarias(e.target.checked)} />
            Resido en Canarias (se aplica IGIC en vez de IVA)
          </label>
          <div className="card divide-y divide-slate-800">
            {[
              { category: 'transcription', emoji: '🎙️', label: '10h de transcripción extra', price: '3€' },
              { category: 'podcast',       emoji: '🎧', label: '10 podcasts extra',           price: '7€' },
            ].map(({ category, emoji, label, price }) => (
              <div key={category} className="py-3 flex items-center justify-between gap-4">
                <p className="text-sm font-semibold text-slate-200">{emoji} {label}</p>
                <button
                  onClick={() => handleStripeCheckout(category)}
                  disabled={!!billingBusy}
                  className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50 flex items-center gap-2"
                >
                  {billingBusy === category
                    ? <IconLoader2 size={14} className="animate-spin" />
                    : price}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Enlaces legales */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500 mt-10 pt-6 border-t border-slate-800">
        <Link to="/terminos" target="_blank" className="hover:text-slate-300">{t('landing.footer.terms')}</Link>
        <Link to="/privacidad" target="_blank" className="hover:text-slate-300">{t('landing.footer.privacy')}</Link>
        <Link to="/cookies" target="_blank" className="hover:text-slate-300">Cookies</Link>
        <a href="mailto:support@mystudyai.eu" className="hover:text-slate-300">support@mystudyai.eu</a>
      </div>

      {/* Modal combinar PDFs */}
      <Modal
        open={combineModal}
        onClose={() => { if (!combining) { setCombineModal(false); navigate(`/document/${uploadedDocIds[uploadedDocIds.length - 1]}`) } }}
        title={`🗂️ ${uploadedDocIds.length} PDFs subidos`}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            {t('home.combineModal.question')}
          </p>

          {/* Info de tamaño / estrategia */}
          {combineInfo && (
            <div className={`rounded-lg p-3 text-xs space-y-1 ${combineInfo.is_large ? 'bg-amber-900/30 border border-amber-700/50' : 'bg-slate-800/60'}`}>
              {combineInfo.is_large && (
                <p className="text-amber-400 font-medium">⚠️ Texto grande — puede tardar un poco más</p>
              )}
              <p className="text-slate-400">
                {combineInfo.strategy === 'multi_pass'
                  ? `📋 Estrategia: resume cada PDF por separado (${combineInfo.estimated_calls - 1} llamadas) y luego los sintetiza`
                  : '✨ Estrategia: resumen directo de todos en una sola llamada'}
              </p>
              <div className="mt-1 space-y-0.5">
                {combineInfo.docs?.map(d => (
                  <p key={d.id} className="text-slate-500 truncate">• {d.title} ({(d.chars / 1000).toFixed(1)}k chars)</p>
                ))}
              </div>
            </div>
          )}
          {!combineInfo && (
            <div className="bg-slate-800/60 rounded-lg p-3 text-xs text-slate-500 text-center">
              {t('home.combineModal.analyzing')}
            </div>
          )}

          {/* Título opcional */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">{t('home.combineModal.titleLabel')}</label>
            <input
              type="text"
              className="input w-full text-sm"
              placeholder={t('home.combineModal.titlePlaceholder', { count: uploadedDocIds.length })}
              value={combineTitle}
              onChange={e => setCombineTitle(e.target.value)}
              disabled={combining}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => { setCombineModal(false); navigate(`/document/${uploadedDocIds[uploadedDocIds.length - 1]}`) }}
              disabled={combining}
              className="btn-secondary flex-1 text-sm"
            >
              {t('home.combineModal.skip')}
            </button>
            <button
              onClick={confirmCombine}
              disabled={combining || !combineInfo}
              className="btn-primary flex-1 text-sm"
            >
              {combining ? t('home.combineModal.combining') : t('home.combineModal.combine')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal fotos de apuntes */}
      <Modal
        open={!!pendingImages}
        onClose={() => setPendingImages(null)}
        title={`📸 ${pendingImages?.length === 1 ? `"${pendingImages[0].name}"` : `${pendingImages?.length} fotos`}`}
        size="sm"
      >
        <div className="space-y-4">
          <div className="bg-slate-800/60 rounded-lg p-3 text-xs text-slate-400">
            <span className="text-emerald-400 font-medium">✨ Visión inteligente</span> {t('home.photoModal.geminiNote')}
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-2 block">{t('home.photoModal.subjectLabel')}</label>
            <select
              className="input w-full"
              value={selectedSubject}
              onChange={e => setSelectedSubject(e.target.value)}
            >
              <option value=''>{t('common.noSubject')}</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          {selectedSubject && subjectTopics.length > 0 && (
            <div>
              <label className="text-sm text-slate-400 mb-2 block">{t('home.photoModal.topicLabel')}</label>
              <select
                className="input w-full"
                value={selectedTopic}
                onChange={e => setSelectedTopic(e.target.value)}
              >
                <option value=''>{t('home.photoModal.topicLoose')}</option>
                {subjectTopics.map(topic => (
                  <option key={topic.id} value={topic.id}>{topic.name}</option>
                ))}
              </select>
            </div>
          )}
          {!creatingSubject ? (
            <button onClick={() => setCreatingSubject(true)}
              className="text-xs text-primary-400 hover:text-primary-300 transition-colors">
              {t('home.photoModal.createNew')}
            </button>
          ) : (
            <div className="flex gap-2">
              <input className="input flex-1 text-sm" placeholder={t('home.photoModal.subjectPlaceholder')}
                value={newSubjectName} onChange={e => setNewSubjectName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createSubjectInline()} autoFocus />
              <input type="color" value={newSubjectColor} onChange={e => setNewSubjectColor(e.target.value)}
                className="w-9 h-9 rounded cursor-pointer bg-transparent border-0 flex-shrink-0" title="Color" />
              <button onClick={createSubjectInline} className="btn-primary btn-sm">Crear</button>
              <button onClick={() => { setCreatingSubject(false); setNewSubjectName(''); setNewSubjectColor('#3b82f6') }} className="btn-secondary btn-sm">✕</button>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => setPendingImages(null)} className="btn-secondary flex-1">{t('common.cancel')}</button>
            <button onClick={confirmImageUpload} disabled={uploading} className="btn-primary flex-1">
              {uploading ? t('home.photoModal.processingAi') : t('home.photoModal.extractText')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Upload modal (PDFs) */}
      <Modal
        open={!!pendingFiles}
        onClose={() => setPendingFiles(null)}
        title={`Subir ${pendingFiles?.length === 1 ? `"${pendingFiles[0].name}"` : `${pendingFiles?.length} PDFs`}`}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-400 mb-2 block">{t('home.uploadModal.subjectLabel')}</label>
            <select
              className="input w-full"
              value={selectedSubject}
              onChange={e => setSelectedSubject(e.target.value)}
            >
              <option value=''>{t('common.noSubject')}</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {selectedSubject && subjectTopics.length > 0 && (
            <div>
              <label className="text-sm text-slate-400 mb-2 block">{t('home.uploadModal.topicLabel')}</label>
              <select
                className="input w-full"
                value={selectedTopic}
                onChange={e => setSelectedTopic(e.target.value)}
              >
                <option value=''>{t('home.uploadModal.topicLoose')}</option>
                {subjectTopics.map(topic => (
                  <option key={topic.id} value={topic.id}>{topic.name}</option>
                ))}
              </select>
            </div>
          )}

          {!creatingSubject ? (
            <button
              onClick={() => setCreatingSubject(true)}
              className="text-xs text-primary-400 hover:text-primary-300 text-left transition-colors"
            >
              {t('home.photoModal.createNew')}
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                className="input flex-1 text-sm"
                placeholder={t('home.photoModal.subjectPlaceholder')}
                value={newSubjectName}
                onChange={e => setNewSubjectName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createSubjectInline()}
                autoFocus
              />
              <input type="color" value={newSubjectColor} onChange={e => setNewSubjectColor(e.target.value)}
                className="w-9 h-9 rounded cursor-pointer bg-transparent border-0 flex-shrink-0" title="Color" />
              <button onClick={createSubjectInline} className="btn-primary btn-sm">Crear</button>
              <button onClick={() => { setCreatingSubject(false); setNewSubjectName(''); setNewSubjectColor('#3b82f6') }} className="btn-secondary btn-sm">✕</button>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => setPendingFiles(null)} className="btn-secondary flex-1">{t('common.cancel')}</button>
            <button onClick={confirmUpload} disabled={uploading} className="btn-primary flex-1">
              {uploading ? t('home.uploadModal.uploading') : t('home.uploadModal.upload')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function StatCard({ Icon, label, value, color, onClick }) {
  const colors = {
    blue:   'text-primary-400 bg-primary-900/20 border-primary-800/50',
    purple: 'text-purple-400 bg-purple-900/20 border-purple-800/50',
    green:  'text-emerald-400 bg-emerald-900/20 border-emerald-800/50',
    amber:  'text-amber-400 bg-amber-900/20 border-amber-800/50',
  }
  return (
    <div onClick={onClick}
      className={`card border rounded-xl p-4 flex items-center gap-3 ${colors[color]} ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}>
      <IconBadge icon={Icon} color={color} size="lg" />
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs opacity-70">{label}</p>
      </div>
    </div>
  )
}

function DocCard({ doc, onClick }) {
  const { t } = useTranslation()
  return (
    <div onClick={onClick} className="card-hover flex items-start gap-3">
      <IconFileText size={22} className="shrink-0 mt-0.5 text-slate-400" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-slate-100 truncate">{doc.title}</p>
        <p className="text-xs text-slate-400 mt-0.5">{doc.subject_name || t('common.noSubject')} · {doc.pages} {t('common.pag')}</p>
      </div>
      <span className="text-xs text-slate-500 shrink-0">{new Date(doc.created_at).toLocaleDateString('es-ES')}</span>
    </div>
  )
}
