import { useRef, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, useScroll, useTransform } from 'framer-motion'
import Logo from '../components/UI/Logo'
import ParticleBackground from '../components/Landing/ParticleBackground'
import { useScrollProgress } from '../hooks/useScrollProgress'
import { IconBrandInstagram, IconBrandFacebook, IconBrandTiktok, IconBrandYoutube } from '@tabler/icons-react'

const SOCIAL_LINKS = [
  { Icon: IconBrandInstagram, href: 'https://instagram.com/mystudyaiapp', label: 'Instagram' },
  { Icon: IconBrandFacebook,  href: 'https://facebook.com/1264908873368210', label: 'Facebook' },
  { Icon: IconBrandTiktok,    href: 'https://tiktok.com/@mystudy.ai', label: 'TikTok' },
  { Icon: IconBrandYoutube,   href: 'https://youtube.com/@mystudyai-h6p', label: 'YouTube' },
]

const FEATURES = [
  { icon: '📄', key: 'summary' },
  { icon: '🗂️', key: 'flashcards' },
  { icon: '📝', key: 'exam' },
  { icon: '🦉', key: 'tutor' },
  { icon: '🌍', key: 'languages' },
  { icon: '🎙️', key: 'lecture' },
  { icon: '📅', key: 'calendar' },
  { icon: '🧮', key: 'solve' },
]

const MASTERY_DEMO = [
  { name: 'Física',    pct: 82, color: 'bg-emerald-400' },
  { name: 'Historia',  pct: 61, color: 'bg-primary-400' },
  { name: 'Biología',  pct: 45, color: 'bg-amber-400' },
]

// ── Mockup del teléfono: 5 "fotogramas" ligados al scroll ───────────────────
function PhoneStep({ step, t }) {
  if (step === 0) {
    return (
      <div className="relative flex flex-col items-center justify-center h-full px-6 gap-4">
        {/* Zona donde "cae" el PDF arrastrado */}
        <div className="relative w-full">
          <div className="bg-slate-800 border-2 border-dashed border-slate-600 rounded-xl px-4 py-6 text-center text-[11px] text-slate-500">
            {t('landing.demo.dropzoneLabel')}
          </div>
          <div className="absolute inset-0 flex items-center justify-center opacity-0 [animation-fill-mode:forwards] animate-[dragIn_0.8s_ease-out_0.1s]">
            <div className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 flex items-center gap-2 shadow-lg">
              <span className="text-lg">📄</span>
              <span className="text-[11px] text-slate-200">Apuntes_Fisica.pdf</span>
            </div>
          </div>
        </div>

        {/* Botón "Generar resumen" con cursor animado haciendo clic */}
        <div className="relative opacity-0 [animation-fill-mode:forwards] animate-[popIn_0.4s_ease-out_0.9s]">
          <span className="btn-primary btn-sm select-none inline-flex animate-[clickPulse_0.3s_ease-in-out_1.9s]">
            ✨ {t('landing.demo.generateBtn')}
          </span>
          <span className="absolute -right-3 -bottom-3 text-base opacity-0 [animation-fill-mode:forwards] animate-[cursorMove_0.6s_ease-out_1.3s]">
            👆
          </span>
        </div>

        {/* Resumen generado */}
        <div className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-left opacity-0 [animation-fill-mode:forwards] animate-[popIn_0.5s_ease-out_2.3s]">
          <p className="text-[10px] font-semibold text-primary-400 mb-1">📋 {t('landing.demo.summaryTitle')}</p>
          <p className="text-[11px] text-slate-300 leading-snug">{t('landing.demo.summaryLine1')}</p>
          <p className="text-[11px] text-slate-300 leading-snug mt-1">{t('landing.demo.summaryLine2')}</p>
        </div>
      </div>
    )
  }
  if (step === 1) {
    return (
      <div className="relative flex flex-col items-center justify-center h-full px-6 gap-5">
        <div className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-primary-400 mb-2">
            {t('landing.demo.tfLabel')}
          </p>
          <p className="text-sm text-slate-100 leading-snug">{t('landing.demo.tfStatement')}</p>
        </div>
        <div className="relative flex gap-3 justify-center">
          <span className="badge-green px-4 py-1.5 animate-[clickPulse_0.3s_ease-in-out_1.4s]">
            ✓ {t('landing.demo.tfTrue')}
          </span>
          <span className="badge-red px-4 py-1.5 opacity-60">{t('landing.demo.tfFalse')}</span>
          <span className="absolute -top-9 left-3 text-2xl opacity-0 [animation-fill-mode:forwards] animate-[swipeDown_0.7s_ease-out_0.6s]">
            👇
          </span>
        </div>
      </div>
    )
  }
  if (step === 2) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6">
        <FlipReveal t={t} />
      </div>
    )
  }
  // step 3 — dominio por asignatura
  return (
    <div className="flex flex-col justify-center h-full px-6">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
        {t('landing.demo.masteryTitle')}
      </p>
      <div className="space-y-3">
        {MASTERY_DEMO.map(s => (
          <div key={s.name}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-300">{s.name}</span>
              <span className="text-slate-400">{s.pct}%</span>
            </div>
            <div className="progress-bar h-1.5">
              <div className={`progress-fill ${s.color}`} style={{ width: `${s.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Ficha que se voltea sola (reutiliza .flip-card de index.css, igual que en Estudiar)
// para revelar que la respuesta era incorrecta + la corrección y la explicación.
function FlipReveal({ t }) {
  const [flipped, setFlipped] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setFlipped(true), 700)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="flip-card w-full h-44">
      <div className={`flip-card-inner ${flipped ? 'flipped' : ''}`}>
        <div className="flip-card-front bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col items-center justify-center text-center">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-primary-400 mb-2">
            {t('landing.demo.tfLabel')}
          </p>
          <p className="text-sm text-slate-100 leading-snug">{t('landing.demo.tfStatement')}</p>
        </div>
        <div className="flip-card-back bg-slate-800 border border-red-600/50 rounded-xl p-4 flex flex-col items-center justify-center text-center">
          <p className="text-sm font-bold text-red-400 mb-1">✗ {t('landing.demo.tfIncorrect')}</p>
          <p className="text-xs text-slate-300 mb-2">{t('landing.demo.tfCorrectAnswer')}</p>
          <p className="text-[11px] text-slate-400 leading-snug">{t('landing.demo.tfExplanation')}</p>
        </div>
      </div>
    </div>
  )
}

function ScrollDemo({ t }) {
  const sectionRef = useRef(null)
  const progress = useScrollProgress(sectionRef)
  const step = Math.min(3, Math.floor(progress * 4))

  // Efecto 3D de entrada (adaptado de Container Scroll Animation, 21st.dev/Aceternity):
  // el teléfono se endereza y agranda solo al principio del scroll, luego se queda
  // quieto mientras cambian los pasos de dentro.
  const { scrollYProgress } = useScroll({ target: sectionRef })
  // Ángulo más suave y perspectiva más lejana que el original de 21st.dev — con
  // valores fuertes (20deg / 1200px) el teléfono se veía plano, como una lámina
  // enrollándose, porque no tiene grosor real. Con esto se nota menos ese efecto.
  const rotate = useTransform(scrollYProgress, [0, 0.15], [14, 0])
  const scale = useTransform(scrollYProgress, [0, 0.15], [0.88, 1])

  return (
    <div ref={sectionRef} className="relative" style={{ height: '220vh' }}>
      <div className="sticky top-[14vh] flex flex-col items-center" style={{ perspective: '2400px' }}>
        {/* Marco del teléfono */}
        <motion.div
          style={{
            rotateX: rotate,
            scale,
            transformStyle: 'preserve-3d',
          }}
          className="relative w-[280px] h-[560px]"
        >
          {/* Panel trasero, ligeramente hundido en el eje Z: da grosor real al
              girar (el borde se asoma por detrás), en vez de verse una lámina plana */}
          <div
            className="absolute inset-0 bg-black rounded-[2.5rem]"
            style={{ transform: 'translateZ(-14px)' }}
          />
          {/* Cara frontal — el teléfono en sí */}
          <div
            className="absolute inset-0 bg-slate-950 border-[6px] border-slate-800 rounded-[2.5rem] overflow-hidden"
            style={{
              transform: 'translateZ(0px)',
              boxShadow: '0 0 #0000004d, 0 25px 50px #00000055, 0 45px 70px #00000035',
            }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-slate-800 rounded-b-xl z-10" />
            <div key={step} className="h-full pt-8 animate-fade-in">
              <PhoneStep step={step} t={t} />
            </div>
            {/* Brillo sutil de "cristal" para reforzar que es una pantalla física */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 30%)',
                mixBlendMode: 'overlay',
              }}
            />
          </div>
        </motion.div>
        {/* Indicador de pasos */}
        <div className="flex gap-1.5 mt-5">
          {[0, 1, 2, 3].map(i => (
            <span key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${
              i === step ? 'bg-primary-400' : 'bg-slate-700'
            }`} />
          ))}
        </div>
        <p className="text-slate-500 text-xs mt-3">{t('landing.demo.scrollHint')}</p>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 relative isolate">
      {/* Fondo animado: partículas conectadas que reaccionan al ratón, fijo
          detrás de toda la página (no solo el hero) */}
      <ParticleBackground className="-z-10" />

      <div className="relative z-10">
      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Logo size="md" />
          <Link to="/login" className="btn-secondary btn-sm">{t('landing.nav.login')}</Link>
        </div>
      </nav>

      <main>
      {/* Hero */}
      <section className="min-h-[80vh] flex items-center">
        <div className="max-w-5xl mx-auto px-4 py-16 text-center w-full">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-100 leading-tight mb-4">
            {t('landing.hero.title')}
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-8">
            {t('landing.hero.subtitle')}
          </p>
          <Link to="/login" className="btn-primary text-base px-6 py-3 inline-flex">
            {t('landing.hero.cta')}
          </Link>
        </div>
      </section>

      {/* Demo animada con scroll */}
      <ScrollDemo t={t} />

      {/* Funciones */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="section-title text-center mb-8">{t('landing.features.title')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {FEATURES.map(f => (
            <div key={f.key} className="card-hover text-center py-6 hover:-translate-y-1">
              <div className="text-3xl mb-2">{f.icon}</div>
              <p className="text-sm font-semibold text-slate-100 mb-1">{t(`landing.features.${f.key}.title`)}</p>
              <p className="text-xs text-slate-400 leading-snug">{t(`landing.features.${f.key}.desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="section-title text-center mb-8">{t('landing.how.title')}</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {[1, 2, 3].map(n => (
            <div key={n} className="card-hover text-center hover:-translate-y-1">
              <div className="w-9 h-9 rounded-full bg-primary-600/20 border border-primary-700/50 text-primary-300 font-bold flex items-center justify-center mx-auto mb-3">
                {n}
              </div>
              <p className="text-sm font-semibold text-slate-100 mb-1">{t(`landing.how.step${n}Title`)}</p>
              <p className="text-xs text-slate-400 leading-snug">{t(`landing.how.step${n}Desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Precios */}
      <section id="pricing" className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="section-title text-center mb-8">{t('landing.pricing.title')}</h2>
        <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
          <div className="card h-full flex flex-col">
            <span className="badge-blue mb-3">{t('landing.pricing.freeBadge')}</span>
            <p className="text-2xl font-bold text-slate-100 mb-1">0 €</p>
            <p className="text-xs text-slate-500 mb-4">{t('landing.pricing.freeTrial')}</p>
            <ul className="text-sm text-slate-300 space-y-2 mb-6">
              <li>✓ {t('landing.pricing.freeItem1')}</li>
              <li>✓ {t('landing.pricing.freeItem2')}</li>
              <li>✓ {t('landing.pricing.freeItem3')}</li>
            </ul>
            <Link to="/login" className="btn-secondary w-full justify-center mt-auto">{t('landing.pricing.freeCta')}</Link>
          </div>
          <div className="card border-primary-600/60 h-full flex flex-col">
            <span className="badge-purple mb-3">{t('landing.pricing.proBadge')}</span>
            <p className="text-2xl font-bold text-slate-100 mb-1">{t('landing.pricing.proPrice')}</p>
            <p className="text-xs text-slate-500 mb-4">{t('landing.pricing.proSubtitle')}</p>
            <ul className="text-sm text-slate-300 space-y-2 mb-6">
              <li>✓ {t('landing.pricing.proItem1')}</li>
              <li>✓ {t('landing.pricing.proItem2')}</li>
              <li>✓ {t('landing.pricing.proItem3')}</li>
            </ul>
            <a href="mailto:support@mystudyai.eu" className="btn-primary w-full justify-center mt-auto">{t('landing.pricing.proCta')}</a>
          </div>
        </div>
      </section>

      {/* Descarga */}
      <section className="max-w-lg mx-auto px-4 py-16">
        <h2 className="section-title text-center mb-6">{t('landing.download.title')}</h2>
        <div className="space-y-3">
          <a
            href="https://github.com/StudyAIUp/studyai-releases/releases/latest/download/StudyAI-Setup.exe"
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-primary-500 rounded-2xl px-3 py-3 transition-all group min-w-0"
          >
            <span className="text-2xl shrink-0">🖥️</span>
            <div className="min-w-0">
              <p className="text-[10px] text-slate-400 group-hover:text-slate-300 truncate">{t('landing.download.for')}</p>
              <p className="text-sm font-semibold text-slate-100 truncate">Windows</p>
            </div>
          </a>
          <div className="grid grid-cols-2 gap-3">
            <a
              href="https://github.com/Taylorete/studyai-releases/releases/download/v1.0.42/StudyAI-Android-1.0.42.apk"
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-primary-500 rounded-2xl px-3 py-3 transition-all group min-w-0"
            >
              <span className="text-2xl shrink-0">🔍</span>
              <div className="min-w-0">
                <p className="text-[10px] text-slate-400 group-hover:text-slate-300 truncate">Android</p>
                <p className="text-sm font-semibold text-slate-100 truncate">MyStudy Scan</p>
              </div>
            </a>
            <a
              href="https://github.com/Taylorete/studyai-releases/releases/download/v1.0.42/MyStudyApp-1.0.42.apk"
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-primary-500 rounded-2xl px-3 py-3 transition-all group min-w-0"
            >
              <span className="text-2xl shrink-0">🎓</span>
              <div className="min-w-0">
                <p className="text-[10px] text-slate-400 group-hover:text-slate-300 truncate">Android</p>
                <p className="text-sm font-semibold text-slate-100 truncate">MyStudy App</p>
              </div>
            </a>
          </div>
        </div>
      </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-8">
        <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <Logo size="sm" />
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a href="https://www.iubenda.com/condiciones-de-uso/88689564" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300">{t('landing.footer.terms')}</a>
            <a href="https://www.iubenda.com/privacy-policy/88689564" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300">{t('landing.footer.privacy')}</a>
            <a href="#" className="iubenda-cs-preferences-link hover:text-slate-300">Preferencias de cookies</a>
            <Link to="/delete-account" className="hover:text-slate-300">{t('landing.footer.deleteAccount')}</Link>
            <a href="mailto:support@mystudyai.eu" className="hover:text-slate-300">support@mystudyai.eu</a>
          </div>
          <div className="flex items-center gap-3">
            {SOCIAL_LINKS.map(({ Icon, href, label }) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                className="text-slate-500 hover:text-primary-400 transition-colors" title={label} aria-label={label}>
                <Icon size={18} />
              </a>
            ))}
          </div>
          <p>© {new Date().getFullYear()} MyStudy AI</p>
        </div>
      </footer>
      </div>
    </div>
  )
}
