import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IconHome, IconBooks, IconBrain, IconFileText, IconWorld, IconMicrophone2,
  IconCalculator, IconScale, IconChartBar, IconCalendar, IconSettings,
} from '@tabler/icons-react'
import IconBadge from '../UI/IconBadge'

// Mismo icono/color que en la barra lateral (Sidebar.jsx) y en el selector de
// tutoriales de Ajustes (SettingsPage.jsx) — si cambian los iconos de la app,
// hay que actualizar los 3 sitios.
const SECTION_ICONS = {
  home:      { Icon: IconHome,        color: 'blue'   },
  library:   { Icon: IconBooks,       color: 'purple' },
  study:     { Icon: IconBrain,       color: 'green'  },
  exam:      { Icon: IconFileText,    color: 'amber'  },
  tutor:     { emoji: '🦉',           color: 'purple' },
  languages: { Icon: IconWorld,       color: 'teal'   },
  lecture:   { Icon: IconMicrophone2, color: 'pink'   },
  solve:     { Icon: IconCalculator,  color: 'blue'   },
  compare:   { Icon: IconScale,       color: 'purple' },
  stats:     { Icon: IconChartBar,    color: 'green'  },
  calendar:  { Icon: IconCalendar,    color: 'amber'  },
  settings:  { Icon: IconSettings,    color: 'slate'  },
}

// ── Definición de pasos ───────────────────────────────────────────────────────
// section  → a qué tutorial de Ajustes pertenece (cada tour solo muestra los suyos)
// route    → navega a esta ruta antes de mostrar el paso
// target   → selector CSS del elemento a resaltar (null = card centrada)
// position → 'right' | 'bottom' | 'top' | 'center' (hint para posicionar la card)

const ALL_STEPS = [
  // ── Inicio (Home.jsx) ────────────────────────────────────────────────────
  {
    id: 'home-1', section: 'home', route: '/', target: null,
    icon: '🏠', title: 'Inicio — tu panel de control',
    body: 'Sube un documento nuevo, revisa tus próximos exámenes y accede rápido al resto de la app — es la primera pantalla que ves al entrar.',
  },
  {
    id: 'home-2', section: 'home', route: '/', target: null,
    icon: '⬆️', title: 'Sube tu primer documento',
    body: 'Arrastra un PDF o una foto de tus apuntes sobre el recuadro de arriba (o usa los botones), sin tener que ir antes a la Biblioteca. Si subes 2 o más PDFs a la vez, te ofrece generar un resumen combinado de todos.',
  },
  {
    id: 'home-3', section: 'home', route: '/', target: null,
    icon: '📅', title: 'Exámenes próximos',
    body: 'Añade la fecha de un examen directamente desde aquí (con asignatura y color opcionales) y lo verás listado con cuenta atrás — es el mismo aviso que aparece en el Calendario.',
  },
  {
    id: 'home-4', section: 'home', route: '/', target: null,
    icon: '📊', title: 'Documentos, Asignaturas, Fichas y Racha',
    body: 'Las 4 tarjetas de arriba son accesos directos: Documentos y Asignaturas te llevan a la Biblioteca, Fichas hoy a Pendiente, y Racha a Progreso.',
  },
  {
    id: 'home-5', section: 'home', route: '/', target: null,
    icon: '🧠', title: 'Dominio por asignatura',
    body: 'En cuanto empieces a repasar flashcards, aparece aquí una barra de progreso por asignatura, calculada con tus aciertos reales — para ver de un vistazo qué llevas dominado.',
  },

  // ── Biblioteca (Library.jsx) ─────────────────────────────────────────────
  {
    id: 'library-1', section: 'library', route: '/library', target: null,
    icon: '📚', title: 'Biblioteca — tus apuntes y PDFs',
    body: 'Sube tus apuntes (PDF, foto o texto) y organízalos por Asignatura y Tema. Al entrar en un documento podrás generar resúmenes, esquemas, flashcards, exámenes, podcast y más.',
  },
  {
    id: 'library-subjects', section: 'library', route: '/library', target: '[data-tour="library-subjects"]',
    icon: '📁', title: 'Asignaturas y Temas',
    body: 'Crea una asignatura y, dentro, agrupa documentos por Tema. Puedes arrastrar un documento sobre una asignatura o tema para reasignarlo en cualquier momento.',
    position: 'right',
  },
  {
    id: 'library-upload', section: 'library', route: '/library', target: '[data-tour="library-upload"]',
    icon: '⬆️', title: 'Importar PDFs',
    body: 'Sube uno o varios PDFs con este botón, o arrástralos directamente sobre la lista de documentos.',
    position: 'bottom',
  },
  {
    id: 'library-tabs', section: 'library', route: '/library', target: null,
    icon: '🗂️', title: 'Documentos, Resúmenes y Planes de estudio',
    body: 'Además de la lista de documentos, hay dos pestañas más en el menú lateral: "Resúmenes guardados" (los que has guardado con 💾) y "Planes de estudio" (con su progreso).',
  },
  {
    id: 'library-multiselect', section: 'library', route: '/library', target: null,
    icon: '☑️', title: 'Selección múltiple',
    body: 'Marca varios documentos con las casillas y aparece una barra abajo con 4 opciones: resumen combinado, flashcards combinadas, examen combinado y plan de estudio conjunto — útiles antes de un examen que junta varios temas.',
  },
  {
    id: 'library-plan', section: 'library', route: '/library', target: null,
    icon: '🗓️', title: 'Plan de estudio conjunto',
    body: 'Ponle fecha de examen y tus horas semanales disponibles (Ajustes → Disponibilidad de estudio) y la IA reparte los temas día a día. Si le pones fecha, se crea también el aviso en tu Calendario automáticamente.',
  },
  {
    id: 'library-podcast', section: 'library', route: '/library', target: null,
    icon: '🎧', title: 'Podcast de tus apuntes',
    body: 'En cualquier documento o resumen guardado hay un icono de auriculares — genera un podcast narrado que puedes descargar o enviar a "Mis podcasts" en tu móvil para escucharlo sin conexión. Disponible en escritorio, web y también en MyStudy Scan.',
  },
  {
    id: 'library-sync', section: 'library', route: '/library', target: null,
    icon: '☁️', title: 'Sincronización con la nube (escritorio)',
    body: 'En la app de escritorio, cada documento muestra un icono: ámbar si solo está en este ordenador (pulsa para subirlo), verde si ya está también en la nube.',
  },

  // ── Pendiente (StudySession.jsx) ─────────────────────────────────────────
  {
    id: 'study-1', section: 'study', route: '/study', target: null,
    icon: '🧠', title: 'Pendiente — todo lo que te queda por hacer',
    body: 'Un único panel con tarjetas: fichas por repasar hoy, asignaturas sin ningún examen hecho, apuntes que aún no has trabajado, cuánto te falta para tu objetivo semanal, y el % que te queda de cualquier plan de estudio activo.',
  },
  {
    id: 'study-2', section: 'study', route: '/study', target: null,
    icon: '📆', title: 'Repaso con flashcards (SM-2)',
    body: 'Al pulsar la tarjeta de fichas, solo verás las que te tocan hoy según su calendario de repetición espaciada — no todo tu mazo entero. Si aciertas, tarda más en volver a aparecer; si fallas, vuelve pronto.',
  },
  {
    id: 'study-3', section: 'study', route: '/study', target: null,
    icon: '🔄', title: 'Modo estudio',
    body: 'Pulsa la tarjeta (o Espacio) para voltearla y ver la respuesta, y marca si acertaste con los botones "Otra vez / Difícil / Bien / Fácil" (o las teclas 1-4) — así el sistema ajusta cuándo volver a preguntártela.',
  },
  {
    id: 'study-4', section: 'study', route: '/study', target: null,
    icon: '💡', title: 'Explicación además de respuesta',
    body: 'El reverso de cada ficha puede incluir una pista y una breve explicación del porqué, no solo la respuesta correcta, para entender el concepto en vez de memorizarlo sin más.',
  },

  // ── Examen (ExamPage.jsx → se genera dentro del documento) ───────────────
  {
    id: 'exam-1', section: 'exam', route: '/exam', target: null,
    icon: '📝', title: 'Examen — elige un documento',
    body: 'Esta pantalla es solo el punto de partida: elige el documento sobre el que quieres examinarte y entrarás en él para generar el examen. (Para un examen que junte varios documentos a la vez, hazlo desde la Biblioteca con selección múltiple.)',
  },
  {
    id: 'exam-2', section: 'exam', route: '/exam', target: null,
    icon: '📋', title: 'Tipos de examen disponibles',
    body: 'Dentro del documento, en el grupo "Evaluación" puedes elegir: test, desarrollo, problemas resueltos, adaptativo (se centra en tus puntos débiles reales) o simulacro cronometrado.',
  },
  {
    id: 'exam-3', section: 'exam', route: '/exam', target: null,
    icon: '✅', title: 'Corrección automática',
    body: 'Al terminar se corrige solo y te da la puntuación al instante, con la respuesta correcta explicada en cada pregunta que falles.',
  },
  {
    id: 'exam-4', section: 'exam', route: '/exam', target: null,
    icon: '📈', title: 'Historial',
    body: 'Todos tus exámenes completados quedan guardados y puedes consultar tu evolución de notas en Progreso.',
  },

  // ── Tutor (TutorPage.jsx) ─────────────────────────────────────────────────
  {
    id: 'tutor-1', section: 'tutor', route: '/tutor', target: null,
    icon: '🦉', title: 'Tutor — aprende conversando',
    body: 'Escribe o habla con el Tutor sobre cualquier duda. Arriba puedes elegir un documento de tu Biblioteca como contexto, o dejarlo en "tema libre".',
  },
  {
    id: 'tutor-mic', section: 'tutor', route: '/tutor', target: '[data-tour="tutor-mic"]',
    icon: '🎙️', title: 'Modo voz',
    body: 'Pulsa el micrófono para una conversación por voz — el Tutor te escucha, responde en voz alta, y puedes interrumpirle hablando en cualquier momento (detecta tu voz incluso mientras él está hablando).',
    position: 'right',
  },
  {
    id: 'tutor-socratic', section: 'tutor', route: '/tutor', target: '[data-tour="tutor-socratic"]',
    icon: '🤔', title: 'Modo guiado (socrático)',
    body: 'Actívalo para que, en vez de darte la respuesta directa, el Tutor te haga preguntas que te lleven a encontrarla tú solo — como un profesor particular. Si te atascas, puedes pedirle la respuesta.',
    position: 'top',
  },
  {
    id: 'tutor-board', section: 'tutor', route: '/tutor', target: '[data-tour="tutor-board"]',
    icon: '🖊️', title: 'Pizarra',
    body: 'El Tutor puede dibujar diagramas, fórmulas y esquemas en una pizarra lateral (ampliable a pantalla completa). Tú también puedes dibujar encima con el lápiz.',
    position: 'left',
  },
  {
    id: 'tutor-history', section: 'tutor', route: '/tutor', target: null,
    icon: '🕐', title: 'Historial de sesiones',
    body: 'Cada conversación se guarda sola mientras hablas — pulsa el reloj (arriba) para retomar una sesión anterior, o el lápiz para empezar una nueva.',
  },

  // ── Idiomas (LanguagesPage.jsx) ───────────────────────────────────────────
  {
    id: 'languages-1', section: 'languages', route: '/languages', target: null,
    icon: '🌍', title: 'Idiomas — practica todos los días',
    body: 'Elige entre 12 idiomas, tu nivel (A1 a C2, la escala oficial europea) y un tema de conversación (viajes, trabajo, comida, tecnología...).',
  },
  {
    id: 'languages-mode', section: 'languages', route: '/languages', target: '[data-tour="lang-mode"]',
    icon: '✍️', title: 'Escrito, conversación oral o comprensión auditiva',
    body: 'Modo escrito: ejercicios de texto (rellenar huecos, traducir, conjugar...). Conversación oral: hablas con un tutor nativo por voz. Comprensión auditiva: escuchas audios generados y respondes preguntas.',
    position: 'bottom',
  },
  {
    id: 'languages-vocab', section: 'languages', route: '/languages', target: null,
    icon: '📖', title: 'Vocabulario propio',
    body: 'Sube tus propias listas de vocabulario (de clase o de un libro) y se usarán para generar ejercicios y exámenes personalizados con ese material.',
  },
  {
    id: 'languages-exam', section: 'languages', route: '/languages', target: null,
    icon: '📝', title: 'Examen completo del idioma',
    body: 'Además de practicar suelto, puedes generarte un examen completo con corrección automática y nota final.',
  },

  // ── Apuntes por voz (LecturePage.jsx) ─────────────────────────────────────
  {
    id: 'lecture-1', section: 'lecture', route: '/lecture', target: null,
    icon: '🎙️', title: 'Apuntes por voz — graba mientras estudias',
    body: 'Elige una asignatura (opcional) y graba tus apuntes hablando. Se transcriben automáticamente y se genera un resumen con los puntos clave al terminar.',
  },
  {
    id: 'lecture-recorder', section: 'lecture', route: '/lecture', target: '[data-tour="lecture-recorder"]',
    icon: '🔴', title: 'Panel de grabación',
    body: 'Activa "Quitar ruido e interrupciones" si vas a grabar en un ambiente ruidoso o largo — filtra automáticamente lo que no tenga relación con el contenido. Al parar, los apuntes se guardan solos en tu Biblioteca.',
    position: 'right',
  },
  {
    id: 'lecture-recent', section: 'lecture', route: '/lecture', target: null,
    icon: '📋', title: 'Apuntes recientes',
    body: 'El panel derecho lista tus últimos apuntes por voz — toca uno para abrirlo directamente en la Biblioteca.',
  },

  // ── Resolver ejercicio (ExerciseSolverPage.jsx) ───────────────────────────
  {
    id: 'solve-1', section: 'solve', route: '/solve', target: '[data-tour="solve-panel"]',
    icon: '🧮', title: 'Resolver ejercicio fotografiado',
    body: 'Haz una foto o sube una imagen de un ejercicio (matemáticas, física, química...) y se resuelve paso a paso al instante — sin necesidad de guardarlo antes como documento.',
    position: 'right',
  },
  {
    id: 'solve-2', section: 'solve', route: '/solve', target: null,
    icon: '💾', title: 'Guardarlo si te sirve',
    body: 'Si quieres repasarlo más adelante, puedes guardar la solución en tu Biblioteca al terminar — y verlo listado en "Recientes" en esta misma pantalla.',
  },

  // ── Comparar (ComparePage.jsx) ────────────────────────────────────────────
  {
    id: 'compare-1', section: 'compare', route: '/compare', target: null,
    icon: '⚖️', title: 'Comparar dos documentos',
    body: 'Elige documento A y B, y el modo: solo diferencias, solo similitudes, o ambas — útil para comparar tus apuntes con el libro de texto, o dos exámenes de años distintos.',
  },

  // ── Progreso (StatsPage.jsx) ──────────────────────────────────────────────
  {
    id: 'stats-1', section: 'stats', route: '/stats', target: null,
    icon: '📊', title: 'Progreso — tus estadísticas de estudio',
    body: 'Tarjetas con tarjetas repasadas, exámenes completados, nota media y tu racha de días seguidos.',
  },
  {
    id: 'stats-2', section: 'stats', route: '/stats', target: null,
    icon: '📈', title: 'Actividad y evolución de notas',
    body: 'Un gráfico muestra tu actividad de estudio reciente, y otro la evolución de tus notas de examen a lo largo del tiempo.',
  },
  {
    id: 'stats-3', section: 'stats', route: '/stats', target: null,
    icon: '🎯', title: 'Puntos débiles y tiempo por asignatura',
    body: 'Un bloque te señala en qué temas concretos fallas más (para saber dónde reforzar), y otro cuánto tiempo llevas dedicado a cada asignatura.',
  },

  // ── Calendario (CalendarPage.jsx) ─────────────────────────────────────────
  {
    id: 'calendar-1', section: 'calendar', route: '/calendar', target: null,
    icon: '📅', title: 'Calendario — no te pille ningún examen',
    body: 'Vista mensual con navegación entre meses y botón "Hoy". Pulsa "+ Añadir evento" o cualquier día para crear un aviso de examen, con asignatura y color propio.',
  },
  {
    id: 'calendar-2', section: 'calendar', route: '/calendar', target: null,
    icon: '🔔', title: 'Avisos antes del examen',
    body: 'Recibe una notificación (en el móvil o en el navegador) unos días antes, para que no se te eche encima sin darte cuenta.',
  },
  {
    id: 'calendar-3', section: 'calendar', route: '/calendar', target: null,
    icon: '🗓️', title: 'También aparecen los planes de estudio',
    body: 'Si generas un plan de estudio conjunto desde la Biblioteca con fecha de examen, el aviso se añade aquí automáticamente — no hace falta crearlo dos veces.',
  },

  // ── Ajustes (SettingsPage.jsx) ────────────────────────────────────────────
  {
    id: 'settings-1', section: 'settings', route: '/settings', target: null,
    icon: '🎨', title: 'Apariencia e idiomas',
    body: 'Cambia el tema visual, las voces y velocidad de lectura en voz alta, el idioma de la interfaz (Español/English/Deutsch/Français) y el idioma en el que la IA redacta resúmenes/fichas/exámenes — son dos ajustes independientes.',
  },
  {
    id: 'settings-2', section: 'settings', route: '/settings', target: null,
    icon: '📅', title: 'Disponibilidad de estudio',
    body: 'Indica cuántas horas puedes dedicar cada día de la semana — el plan de estudio (Biblioteca) usa estos datos para repartir los temas de forma realista. Puedes cambiarlos antes de generar cada plan concreto.',
  },
  {
    id: 'settings-3', section: 'settings', route: '/settings', target: null,
    icon: '🔔', title: 'Avisos de examen',
    body: 'Activa o desactiva las notificaciones de examen, y elige con cuántos días de antelación quieres que te avisen.',
  },
  {
    id: 'settings-4', section: 'settings', route: '/settings', target: null,
    icon: '👤', title: 'Tu cuenta y datos',
    body: 'Cambia tu nombre o contraseña, gestiona copias de seguridad (en escritorio, junto con la configuración de Whisper para transcripción local) o borra tu cuenta si lo necesitas.',
  },
]

// ── Helpers de posicionamiento ────────────────────────────────────────────────

function calcCardStyle(rect, hint, winW, winH) {
  if (!rect) return null
  const CARD_W = 310, CARD_H = 280, GAP = 18

  // Intentar la posición preferida, si no cabe usar la mejor disponible
  const fits = {
    right:  rect.left + rect.width  + GAP + CARD_W < winW,
    left:   rect.left - GAP - CARD_W > 0,
    bottom: rect.top  + rect.height + GAP + CARD_H < winH,
    top:    rect.top  - GAP - CARD_H > 0,
  }

  const preferred = hint || (fits.right ? 'right' : fits.bottom ? 'bottom' : fits.left ? 'left' : 'top')
  const dir = fits[preferred] ? preferred : Object.keys(fits).find(k => fits[k]) || 'right'

  let top, left
  if (dir === 'right') {
    left = rect.left + rect.width + GAP
    top  = Math.max(12, Math.min(winH - CARD_H - 12, rect.top + rect.height / 2 - CARD_H / 2))
  } else if (dir === 'left') {
    left = rect.left - GAP - CARD_W
    top  = Math.max(12, Math.min(winH - CARD_H - 12, rect.top + rect.height / 2 - CARD_H / 2))
  } else if (dir === 'bottom') {
    top  = rect.top + rect.height + GAP
    left = Math.max(12, Math.min(winW - CARD_W - 12, rect.left + rect.width / 2 - CARD_W / 2))
  } else {
    top  = rect.top - GAP - CARD_H
    left = Math.max(12, Math.min(winW - CARD_W - 12, rect.left + rect.width / 2 - CARD_W / 2))
  }

  return { position: 'fixed', top, left, width: CARD_W, zIndex: 10002 }
}

// ── Contenido de la card ──────────────────────────────────────────────────────

function CardContent({ stepIdx, total, current, isFirst, isLast, finishLabel, onPrev, onNext, onFinish, onSkip, onDragStart }) {
  const sectionIcon = SECTION_ICONS[current.section]
  return (
    <div className="space-y-4">
      {/* Icono + título — zona de arrastre */}
      <div
        className="flex items-center gap-3 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={onDragStart}
        title="Arrastra para mover"
      >
        <IconBadge icon={sectionIcon?.Icon} emoji={sectionIcon?.emoji} color={sectionIcon?.color} size="sm" />
        <h2 className="font-bold text-slate-100 text-base leading-tight flex-1">{current.title}</h2>
        <span className="text-slate-600 text-sm shrink-0">⠿</span>
      </div>

      {/* Cuerpo */}
      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">{current.body}</p>

      {/* Dots */}
      <div className="flex gap-1.5 flex-wrap">
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className={`rounded-full transition-all duration-300 ${
            i === stepIdx   ? 'w-4 h-1.5 bg-primary-400'
            : i < stepIdx  ? 'w-1.5 h-1.5 bg-primary-600/50'
                           : 'w-1.5 h-1.5 bg-slate-700'
          }`} />
        ))}
      </div>

      {/* Botones */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {!isFirst && (
            <button onClick={onPrev} className="btn-secondary text-xs px-2.5 py-1.5">← Ant.</button>
          )}
          {!isLast && (
            <button onClick={onSkip} className="text-[11px] text-slate-600 hover:text-slate-400 px-1">Omitir</button>
          )}
        </div>
        {isLast ? (
          <button onClick={onFinish}
            className="px-3 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold transition-colors">
            {finishLabel}
          </button>
        ) : (
          <button onClick={onNext}
            className="px-3 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold transition-colors">
            Siguiente →
          </button>
        )}
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
// Recorrido detallado de una única sección (lanzado desde Ajustes → Tutoriales).

export default function OnboardingTutorial({ onFinish, section }) {
  const STEPS = ALL_STEPS.filter(s => s.section === section)
  const TOTAL = STEPS.length

  const [step, setStep]             = useState(0)
  const [spotRect, setSpotRect]     = useState(null)
  const [navReady, setNavReady]     = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const navigate                    = useNavigate()
  const prevRoute                   = useRef(null)
  const dragState                   = useRef({ active: false, startX: 0, startY: 0, baseX: 0, baseY: 0 })

  const current  = STEPS[step]
  const isFirst  = step === 0
  const isLast   = step === TOTAL - 1
  const finishLabel = 'Cerrar ✓'

  // Navegar cuando cambia el paso (solo si la ruta cambia)
  useEffect(() => {
    setNavReady(false)
    setSpotRect(null)
    setDragOffset({ x: 0, y: 0 })  // resetear posición de la card al cambiar paso

    if (current.route && current.route !== prevRoute.current) {
      prevRoute.current = current.route
      navigate(current.route)
    }

    // Dar tiempo al render de la página destino
    const t = setTimeout(() => setNavReady(true), 350)
    return () => clearTimeout(t)
  }, [step])  // eslint-disable-line

  // Calcular spotlight una vez que la página está renderizada
  const updateSpot = useCallback(() => {
    if (!current.target || !navReady) { setSpotRect(null); return }
    const el = document.querySelector(current.target)
    if (el) {
      const r = el.getBoundingClientRect()
      setSpotRect({ top: r.top - 8, left: r.left - 8, width: r.width + 16, height: r.height + 16 })
    } else {
      setSpotRect(null)
    }
  }, [current.target, navReady])

  useEffect(() => {
    updateSpot()
    window.addEventListener('resize', updateSpot)
    return () => window.removeEventListener('resize', updateSpot)
  }, [updateSpot])

  // ── Arrastrar la card ───────────────────────────────────────────────────────
  function startDrag(e) {
    e.preventDefault()
    dragState.current = {
      active: true,
      startX: e.clientX, startY: e.clientY,
      baseX: dragOffset.x, baseY: dragOffset.y,
    }
    function onMove(ev) {
      if (!dragState.current.active) return
      setDragOffset({
        x: dragState.current.baseX + ev.clientX - dragState.current.startX,
        y: dragState.current.baseY + ev.clientY - dragState.current.startY,
      })
    }
    function onUp() {
      dragState.current.active = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function finishTour() { onFinish() }
  function skipTour() { onFinish() }
  const next = () => setStep(s => Math.min(s + 1, TOTAL - 1))
  const prev = () => setStep(s => Math.max(s - 1, 0))

  const winW = window.innerWidth
  const winH = window.innerHeight
  const cardStyle = spotRect ? calcCardStyle(spotRect, current.position, winW, winH) : null

  // Aplicar offset de arrastre sobre la posición calculada
  const dragTransform = `translate(${dragOffset.x}px, ${dragOffset.y}px)`

  const cardProps = {
    stepIdx: step, total: TOTAL, current, isFirst, isLast, finishLabel,
    onPrev: prev, onNext: next, onFinish: finishTour, onSkip: skipTour,
    onDragStart: startDrag,
  }

  return (
    <>
      <style>{`
        @keyframes spot-pulse {
          0%,100% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.78), 0 0 0 2px rgba(139,92,246,0.85); }
          50%      { box-shadow: 0 0 0 9999px rgba(0,0,0,0.78), 0 0 0 5px rgba(167,139,250,1); }
        }
        .tour-spot { animation: spot-pulse 2s ease-in-out infinite; }
      `}</style>

      <div className="fixed inset-0" style={{ zIndex: 9999 }}>

        {spotRect && navReady ? (
          // ── SPOTLIGHT ─────────────────────────────────────────────────────
          <>
            {/* El hueco con borde pulsante crea el efecto "spotlight" */}
            <div className="fixed tour-spot pointer-events-none transition-all duration-500"
              style={{
                top: spotRect.top, left: spotRect.left,
                width: spotRect.width, height: spotRect.height,
                borderRadius: 10, zIndex: 10000,
              }}
            />

            {/* Captura clicks en la zona oscura → avanzar */}
            <div className="absolute inset-0" style={{ zIndex: 10001 }} onClick={next} />

            {/* Card arrastrable */}
            {cardStyle && (
              <div className="card border-primary-600/60 shadow-2xl overflow-y-auto"
                style={{ ...cardStyle, maxHeight: 'calc(100vh - 24px)', transform: dragTransform, pointerEvents: 'all' }}
                onClick={e => e.stopPropagation()}
              >
                <CardContent {...cardProps} />
              </div>
            )}
          </>
        ) : (
          // ── PÁGINA VISIBLE + CARD CENTRADA ────────────────────────────────
          <>
            {/* Overlay semitransparente — la página se ve debajo */}
            <div className="absolute inset-0 bg-black/72" onClick={!isFirst && !isLast ? next : undefined} />

            {/* Card centrada (arrastrable) */}
            <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 10001, pointerEvents: 'none' }}>
              <div
                className="card border-primary-600/60 shadow-2xl mx-6 max-w-sm overflow-y-auto"
                style={{ maxHeight: 'calc(100vh - 48px)', transform: dragTransform, pointerEvents: 'all' }}
                onClick={e => e.stopPropagation()}
              >
                <CardContent {...cardProps} />
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
