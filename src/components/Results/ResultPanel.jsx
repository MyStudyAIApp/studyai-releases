import { useRef, useState, useEffect } from 'react'
import { useAppStore, api } from '../../store/appStore'
import ExportPanel from '../Export/ExportPanel'
import Spinner from '../UI/Spinner'
import TextToSpeech from '../Audio/TextToSpeech'
import SummaryView, { buildPrintHtml, escapeHtml } from './SummaryView'
import NumberedSchemaView from './NumberedSchemaView'
import BracesSchemaView from './BracesSchemaView'
import MindMapView from './MindMapView'
import GlossaryView from './GlossaryView'
import FormulasView from './FormulasView'
import TimelineView from './TimelineView'
import FlashcardsResult from '../Flashcards/FlashcardsResult'
import ClozeView from '../Flashcards/ClozeView'
import TestExamView from '../Exam/TestExamView'
import DevelopmentExamView from '../Exam/DevelopmentExamView'
import ProblemsView from '../Exam/ProblemsView'
import AdaptiveExamView from '../Exam/AdaptiveExamView'
import StudyPlanView from '../Study/StudyPlanView'
import ConnectionsView from './ConnectionsView'
import WaitingGame from './WaitingGame'

const LABELS = {
  summary:          'Resumen',
  extended_summary: 'Resumen ampliado',
  schema:           'Esquema',
  schema_braces:    'Esquema de llaves',
  mindmap:      'Mapa conceptual',
  glossary:     'Glosario',
  formulas:     'Hoja de fórmulas',
  timeline:     'Línea del tiempo',
  flashcards:   'Flashcards',
  cloze:        'Texto con huecos',
  test:         'Test',
  development:  'Desarrollo',
  problems:     'Problemas resueltos',
  problems_new: 'Nuevos problemas',
  adaptive:     'Examen adaptativo',
  timed:        'Simulacro',
  studyplan:    'Plan de estudio',
  connections:  'Conexiones',
}

const VIEW_MAP = {
  summary:          SummaryView,
  extended_summary: SummaryView,
  schema:           NumberedSchemaView,
  schema_braces:    BracesSchemaView,
  mindmap:      MindMapView,
  glossary:     GlossaryView,
  formulas:     FormulasView,
  timeline:     TimelineView,
  flashcards:   FlashcardsResult,
  cloze:        ClozeView,
  test:         TestExamView,
  development:  DevelopmentExamView,
  problems:     ProblemsView,
  problems_new: ProblemsView,
  adaptive:     AdaptiveExamView,
  timed:        TestExamView,
  studyplan:    StudyPlanView,
  connections:  ConnectionsView,
}

function fixJsonNewlines(str) {
  let fixed = '', inStr = false
  for (let i = 0; i < str.length; i++) {
    const c = str[i]
    if (c === '\\' && inStr) { fixed += c; fixed += str[++i] || '' }
    else if (c === '"') { inStr = !inStr; fixed += c }
    else if (c === '\n' && inStr) { fixed += '\\n' }
    else if (c === '\r' && inStr) { fixed += '\\r' }
    else { fixed += c }
  }
  return fixed
}

function normalizeResult(result) {
  if (!result) return result
  const raw = result.content
  if (raw && typeof raw === 'string' && raw.trimStart().startsWith('{')) {
    try {
      const block = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
      const jsonStr = block ? block[1].trim() : raw
      const obj = jsonStr.match(/\{[\s\S]*\}/)
      if (obj) {
        const parsed = JSON.parse(fixJsonNewlines(obj[0]))
        return { ...parsed, type: result.type, model_used: result.model_used }
      }
    } catch {}
  }
  return result
}

export default function ResultPanel({ result, streamedText, generating, genProgress, doc, activeAction, onSaved, onPrepDay }) {
  const { addToast } = useAppStore()
  const printRef = useRef()
  const [showExport, setShowExport] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [nameInput,  setNameInput]  = useState('')
  // Imprimir/exportar nunca encajaron bien con las llaves ni con el esquema
  // numerado (paginación, dibujo fiel...) — para esta sección se sustituyen
  // por un botón que pone fondo blanco, así el usuario hace una captura de
  // pantalla y la pega directamente en Word, sin depender de ningún export automático.
  const [whiteBg, setWhiteBg] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showGame, setShowGame] = useState(false)
  const isSchemaSection = activeAction === 'schema' || activeAction === 'schema_braces' || activeAction === 'mindmap'

  useEffect(() => {
    if (!isFullscreen) return
    function onKeyDown(e) { if (e.key === 'Escape') setIsFullscreen(false) }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isFullscreen])
  // El mapa conceptual (React Flow) ya trae su propio zoom integrado -- el
  // control +/- de esta barra solo aplica a los otros dos (numerado/llaves).
  const showZoomControl = activeAction === 'schema' || activeAction === 'schema_braces'
  const normalizedResult = normalizeResult(result)

  function handlePrint() {
    const r = normalizedResult
    if (!r) return

    const title = doc?.title || LABELS[activeAction] || 'Resultado'

    let html = ''

    if (activeAction === 'summary') {
      html = buildPrintHtml(r, title)  // buildPrintHtml ya escapa docTitle internamente
    } else {
      const safeTitle = escapeHtml(title)
      const el = printRef.current
      const inner = el ? el.innerHTML : ''

      // La ventana de impresión es un documento en blanco (about:blank): no hereda
      // el CSS de la app (Tailwind), así que las clases flex/absolute/etc. no
      // existen ahí y todo colapsa a bloque. Copiamos las hojas de estilo reales
      // de la página (dev: <style> de Vite; build: <link> con href absoluta).
      const pageStyles = [
        ...Array.from(document.querySelectorAll('style')).map(s => `<style>${s.innerHTML}</style>`),
        ...Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => `<link rel="stylesheet" href="${l.href}">`),
      ].join('\n')

      html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
        <title>${safeTitle}</title>
        ${pageStyles}
        <style>
          @page { size: A4; margin: 1.5cm; }
          body { font-family: Georgia, serif; font-size: 11pt; line-height: 1.7;
                 color: #111; background: white; padding: 2cm; max-width: 21cm; margin: 0 auto; }
          h1,h2,h3 { color: #1e3a5f; margin: 12pt 0 6pt; }
          h1 { font-size: 18pt; border-bottom: 2pt solid #3b6fbf; padding-bottom: 4pt; }
          h2 { font-size: 14pt; border-left: 4pt solid #3b6fbf; padding-left: 6pt; }
          table { border-collapse: collapse; width: 100%; margin: 8pt 0; }
          th { background: #1e3a5f; color: white; padding: 5pt 8pt; text-align: left; }
          td { border: 0.5pt solid #ccc; padding: 4pt 8pt; }
          tr:nth-child(even) td { background: #f5f8ff; }
          .card > svg { width: 100% !important; height: auto !important; max-width: none !important; }
          .card { max-height: none !important; overflow: visible !important; }
          body, body :not(.card):not(.card *) { color: #111 !important; background: white !important; border-color: #ccc !important; }
          @media print { body { padding: 1cm; } }
        </style></head>
        <body><h1>${safeTitle}</h1>${inner}</body></html>`
    }

    const w = window.open('', '_blank', 'width=900,height=700')
    if (!w) { addToast('Bloqueado el popup — permite popups para imprimir', 'error'); return }
    w.document.write(html)
    w.document.close()
    w.focus()
    w.onload = () => { try { w.print() } catch(e) {} }
    setTimeout(() => { try { if (!w.closed) w.print() } catch(e) {} }, 800)
  }

  function startSave() {
    if (!result) return
    if (['summary', 'extended_summary'].includes(activeAction)) {
      const date = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
      setNameInput(`${doc?.title || 'Resumen'} — ${date}`)
      setSavingName(true)
    } else {
      handleSave()
    }
  }

  async function handleSave(name) {
    if (!result) return
    try {
      await api('POST', `/documents/${doc.id}/results`, {
        type: activeAction,
        data: result,
        ...(name ? { name } : {}),
      })
      addToast('Guardado correctamente', 'success')
      setSavingName(false)
      onSaved?.()
    } catch (e) { addToast(e.message, 'error') }
  }

  const ViewComponent = normalizedResult ? VIEW_MAP[normalizedResult.type] : null
  // Antes se mostraba streamedText en bruto (JSON a medio formar, ilegible)
  // mientras llegaba -- ahora se mantiene el spinner durante TODO el tiempo
  // que dura la generación, no solo hasta que llega el primer token.
  const isLoading = generating && !result
  const isEmpty = !result && !streamedText

  // El mini juego solo aparece si la generación tarda más de unos segundos —
  // en generaciones rápidas solo molestaría (parpadeo de tablero).
  useEffect(() => {
    if (!isLoading) { setShowGame(false); return }
    const t = setTimeout(() => setShowGame(true), 3000)
    return () => clearTimeout(t)
  }, [isLoading])

  // Build readable text for TTS: strip markdown symbols and join key fields
  function getTtsText() {
    const r = normalizedResult
    if (!r) return ''
    const parts = []
    if (r.content) parts.push(r.content.replace(/#{1,6} /g, '').replace(/\*\*/g, '').replace(/\*/g, ''))
    if (r.key_points?.length) parts.push('Puntos clave: ' + r.key_points.join('. '))
    if (r.callouts?.length)   parts.push('Fórmulas importantes: ' + r.callouts.join('. '))
    // For glossary / flashcards / vocabulary
    if (r.terms?.length)      parts.push(r.terms.map(t => `${t.term}: ${t.definition}`).join('. '))
    if (r.vocabulary?.length) parts.push(r.vocabulary.map(v => `${v.term}: ${v.definition}`).join('. '))
    if (r.cards?.length)      parts.push(r.cards.map(c => `${c.front}. ${c.back}`).join('. '))
    return parts.join('\n\n').slice(0, 4000)
  }

  // Single root wrapper — always flex-1 so it fills the flex-col parent in DocumentPage
  return (
    <div className={isFullscreen
      ? 'fixed inset-0 z-[100] bg-slate-950 flex flex-col'
      : 'flex flex-col flex-1 min-h-0 overflow-hidden'}>

      {/* ── Loading ── */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center flex-1 gap-4">
          <Spinner size="lg" />
          <p className="text-sm text-slate-400 animate-pulse max-w-xs text-center">
            Generando {(LABELS[activeAction] || activeAction || '').toLowerCase()}...
          </p>
          {showGame && <WaitingGame />}
        </div>
      )}

      {/* ── Empty ── */}
      {isEmpty && !isLoading && (
        <div className="flex flex-col items-center justify-center flex-1 text-center p-8 text-slate-500">
          <span className="text-5xl mb-4">✨</span>
          <p className="text-lg font-medium text-slate-400">Elige una acción</p>
          <p className="text-sm mt-1">Selecciona qué quieres generar en el panel izquierdo</p>
        </div>
      )}

      {/* ── Result ── */}
      {!isEmpty && !isLoading && (
        <>
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800 shrink-0">
            <span className="text-sm font-medium text-slate-200 flex-1">
              {LABELS[activeAction] || activeAction}
            </span>
            {generating && <span className="text-xs text-primary-400 animate-pulse">Generando...</span>}
            <div className="flex gap-2 items-center">
              {result && (
                <>
                  <TextToSpeech text={getTtsText()} />
                  {savingName ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        autoFocus
                        value={nameInput}
                        onChange={e => setNameInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter')  handleSave(nameInput)
                          if (e.key === 'Escape') setSavingName(false)
                        }}
                        className="input input-sm text-xs w-52"
                        placeholder="Nombre del resumen"
                      />
                      <button onClick={() => handleSave(nameInput)} className="btn-primary btn-sm text-xs">✓</button>
                      <button onClick={() => setSavingName(false)} className="btn-ghost btn-sm text-xs text-slate-400">✕</button>
                    </div>
                  ) : (
                    <button onClick={startSave} className="btn-secondary btn-sm">💾 Guardar</button>
                  )}
                  {isSchemaSection ? (
                    <>
                      <button
                        onClick={() => setIsFullscreen(v => !v)}
                        className={`btn-secondary btn-sm no-print ${isFullscreen ? 'border-primary-500 text-primary-300' : ''}`}
                        title={isFullscreen ? 'Salir de pantalla completa (Esc)' : 'Ver en pantalla completa'}
                      >
                        {isFullscreen ? '🗗 Salir' : '⛶ Pantalla completa'}
                      </button>
                      {showZoomControl && (
                        <div className="flex items-center gap-1 border border-slate-700 rounded-md px-1">
                          <button
                            onClick={() => setZoom(z => Math.max(40, z - 10))}
                            className="btn-ghost btn-sm px-2 text-slate-300"
                            title="Alejar"
                          >
                            −
                          </button>
                          <span className="text-xs text-slate-400 w-9 text-center select-none">{zoom}%</span>
                          <button
                            onClick={() => setZoom(z => Math.min(150, z + 10))}
                            className="btn-ghost btn-sm px-2 text-slate-300"
                            title="Acercar"
                          >
                            +
                          </button>
                        </div>
                      )}
                      <button
                        onClick={() => setWhiteBg(v => !v)}
                        className={`btn-secondary btn-sm no-print ${whiteBg ? 'border-primary-500 text-primary-300' : ''}`}
                        title="Pone fondo blanco para hacer una captura y pegarla en Word"
                      >
                        {whiteBg ? '⬜ Fondo blanco (activo)' : '⬜ Fondo blanco'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={handlePrint} className="btn-secondary btn-sm no-print">🖨️ Imprimir</button>
                      <button
                        onClick={() => setShowExport(v => !v)}
                        className={`btn-secondary btn-sm no-print ${showExport ? 'border-primary-500 text-primary-300' : ''}`}
                      >
                        📤 Exportar
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Export panel — collapsible */}
          {showExport && result && !isSchemaSection && (
            <div className="border-b border-slate-800 bg-slate-900/60 px-4 py-3 shrink-0">
              <ExportPanel result={normalizedResult} doc={doc} onClose={() => setShowExport(false)} />
            </div>
          )}

          {/* Scrollable content */}
          <div className="flex-1 min-h-0 overflow-auto p-4" ref={printRef}>
            {normalizedResult && ViewComponent && (
              <div className="print-target animate-fade-in">
                <ViewComponent
                  result={normalizedResult}
                  doc={doc}
                  onPrepDay={normalizedResult.type === 'studyplan' ? onPrepDay : undefined}
                  whiteBg={isSchemaSection ? whiteBg : undefined}
                  zoom={showZoomControl ? zoom : undefined}
                  onZoomChange={showZoomControl ? setZoom : undefined}
                />
              </div>
            )}
          </div>
        </>
      )}

    </div>
  )
}
