import { useRef, useState, useEffect } from 'react'
import DOMPurify from 'dompurify'
import mermaid, { fixSvgColors } from '../../utils/mermaidConfig'
import { sanitizeMermaid } from '../../utils/mermaid'

const COLORS = ['#f1f5f9', '#f87171', '#60a5fa', '#4ade80', '#fbbf24', '#a78bfa']

// ── SVG sanitizer + responsive fix ───────────────────────────────────────────
// El contenido viene de la pizarra del Tutor, generada por el modelo a partir
// de un documento subido por el usuario -- un blacklist de regex se puede
// saltar con atributos sin comillas (<image onerror=...>), por eso se usa un
// sanitizador real basado en parser (DOMPurify), no expresiones regulares.
function sanitizeSVG(raw) {
  // DOMPurify ya bloquea todos los atributos on* y las URIs javascript: por
  // defecto -- solo hace falta añadir lo que su perfil SVG no cubre: foreignObject
  // (permite incrustar HTML arbitrario, incluidos manejadores de eventos) y
  // use/script como capas extra de defensa.
  let svg = DOMPurify.sanitize(raw, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['foreignObject', 'script', 'use'],
  })
  // Force responsive — replace fixed px/number dimensions with 100%
  svg = svg.replace(/(<svg\b[^>]*?)\s+width="[^"%][^"]*"/i, '$1 width="100%"')
  svg = svg.replace(/(<svg\b[^>]*?)\s+height="[^"%][^"]*"/i, '$1 height="100%"')
  if (!/<svg[^>]+\bwidth=/i.test(svg))  svg = svg.replace(/<svg/i, '<svg width="100%"')
  if (!/<svg[^>]+\bheight=/i.test(svg)) svg = svg.replace(/<svg/i, '<svg height="100%"')
  return svg
}

function isSVG(content) {
  return content.trimStart().startsWith('<svg')
}

// ── Mermaid diagram (proceso/flujo o mapa conceptual) ───────────────────────
function isMermaid(content) {
  return /^(graph|flowchart|mindmap)\b/i.test(content.trimStart())
}

function MermaidBoard({ content }) {
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setSvg('')
    setError('')
    const id = `tutor-mm-${Date.now()}`
    mermaid.render(id, sanitizeMermaid(content))
      .then(({ svg: renderedSvg }) => setSvg(fixSvgColors(renderedSvg)))
      .catch(e => setError(e.message || 'Error de sintaxis Mermaid'))
    return () => {
      document.querySelectorAll('body > [id^="dtutor-mm"], body > [id^="tutor-mm-"]').forEach(el => el.remove())
    }
  }, [content])

  if (error) {
    return (
      <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none p-4">
        <pre className="text-xs text-slate-500 whitespace-pre-wrap">{content}</pre>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 flex flex-col overflow-auto z-10 pointer-events-none p-3 gap-1">
      {svg && <div className="flex-1" dangerouslySetInnerHTML={{ __html: svg }} />}
      <p className="text-[10px] text-slate-600 text-center shrink-0">
        Diagrama ilustrativo — verifica con tu libro de texto
      </p>
    </div>
  )
}

// ── Rich board content renderer ───────────────────────────────────────────────

function FlowRow({ items }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap py-1">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className="px-3 py-1.5 bg-violet-900/70 border border-violet-500 rounded-lg text-violet-100 text-sm font-medium whitespace-nowrap shadow-sm">
            {item}
          </div>
          {i < items.length - 1 && (
            <span className="text-violet-400 text-xl font-bold select-none">→</span>
          )}
        </div>
      ))}
    </div>
  )
}

function BoardContent({ content }) {
  const lines = content.split('\n')
  const elements = []
  let i = 0

  while (i < lines.length) {
    const raw = lines[i]
    const t   = raw.trim()

    if (!t) { i++; continue }

    if (t === '---' || t === '===') {
      elements.push(<div key={i} className="border-t border-slate-600 my-2" />)
      i++; continue
    }

    // Table separator row — skip
    if (t.match(/^[-|:\s]+$/) && t.includes('|')) { i++; continue }

    // FORMULA: large centered display
    if (/^FORMULA:/i.test(t)) {
      const formula = t.replace(/^FORMULA:/i, '').trim()
      elements.push(
        <div key={i} className="text-center py-3 my-1 bg-slate-900/60 rounded-xl">
          <span className="text-2xl font-bold text-emerald-300 tracking-wider font-mono">{formula}</span>
        </div>
      )
      i++; continue
    }

    // Flow diagram: "A → B → C" on one line (not starting with →)
    if ((t.includes(' → ') || t.includes(' -> ')) && !t.startsWith('→') && !t.startsWith('->')) {
      const items = t.split(/ → | -> /).map(s => s.trim()).filter(Boolean)
      if (items.length >= 2) {
        elements.push(<FlowRow key={i} items={items} />)
        i++; continue
      }
    }

    // Table: lines with |
    if (t.includes('|')) {
      const tableLines = []
      while (i < lines.length) {
        const tl = lines[i].trim()
        if (!tl.includes('|') && !tl.match(/^[-|:\s]+$/)) break
        tableLines.push(tl)
        i++
      }
      const rows = tableLines
        .filter(tl => tl.includes('|') && !tl.match(/^[-|:\s]+$/))
        .map(tl => tl.replace(/^\||\|$/g, '').split('|').map(c => c.trim()))
      if (rows.length) {
        elements.push(
          <table key={`t${i}`} className="w-full border-collapse text-xs my-1">
            <thead>
              <tr>{rows[0].map((c, j) => (
                <th key={j} className="border border-violet-700 bg-violet-900/60 px-2 py-1.5 text-violet-200 font-bold text-center">{c}</th>
              ))}</tr>
            </thead>
            <tbody>{rows.slice(1).map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? 'bg-slate-900/40' : 'bg-slate-800/40'}>
                {row.map((c, ci) => (
                  <td key={ci} className="border border-slate-700 px-2 py-1 text-slate-200 text-center">{c}</td>
                ))}
              </tr>
            ))}</tbody>
          </table>
        )
      }
      continue
    }

    // Arrow bullet (→ item)
    if (t.startsWith('→') || t.startsWith('->')) {
      elements.push(
        <div key={i} className="flex items-center gap-2 ml-3">
          <span className="text-violet-400 text-lg leading-none">→</span>
          <span className="text-slate-200 text-sm">{t.replace(/^→|^->/, '').trim()}</span>
        </div>
      )
      i++; continue
    }

    // Numbered step: "1. text"
    const numMatch = t.match(/^(\d+)\.\s+(.+)/)
    if (numMatch) {
      elements.push(
        <div key={i} className="flex items-start gap-2.5">
          <span className="w-6 h-6 rounded-full bg-violet-700 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
            {numMatch[1]}
          </span>
          <span className="text-slate-200 text-sm pt-0.5">{numMatch[2]}</span>
        </div>
      )
      i++; continue
    }

    // Indented sub-item
    if (raw.startsWith('  ') || raw.startsWith('\t')) {
      elements.push(
        <div key={i} className="ml-8 text-slate-400 text-xs flex items-center gap-1">
          <span className="text-slate-600">└</span><span>{t}</span>
        </div>
      )
      i++; continue
    }

    // Heading: first element, or ALL CAPS ≥4 chars
    const isHeading = elements.length === 0 ||
      (t === t.toUpperCase() && t.length >= 4 && /[A-ZÁÉÍÓÚÑ]/.test(t))
    if (isHeading) {
      elements.push(
        <div key={i} className="text-violet-300 font-bold text-base tracking-wide mb-1">{t}</div>
      )
      i++; continue
    }

    // Normal text
    elements.push(<div key={i} className="text-slate-300 text-sm">{t}</div>)
    i++
  }

  return <div className="p-5 space-y-2 font-mono select-none">{elements}</div>
}

// ── Circuit diagram renderer (IEC symbols) ───────────────────────────────────

function isCircuit(content) {
  try { const j = JSON.parse(content.trim()); return j && (j.tipo === 'serie' || j.tipo === 'paralelo') }
  catch { return false }
}

const _LW = 1.5

function CompSym({ name, cx, cy }) {
  const n = (name || '').toLowerCase()
  const lbl = <text x={cx} y={cy + 32} textAnchor="middle" fill="#94a3b8" fontSize="9">{n}</text>
  if (n === 'bombilla') return (
    <g>
      <rect x={cx - 20} y={cy - 20} width="40" height="40" fill="#0f172a"/>
      <circle cx={cx} cy={cy} r={15} stroke="#fbbf24" fill="none" strokeWidth={_LW}/>
      <line x1={cx - 10} y1={cy - 10} x2={cx + 10} y2={cy + 10} stroke="#fbbf24" strokeWidth={_LW}/>
      <line x1={cx + 10} y1={cy - 10} x2={cx - 10} y2={cy + 10} stroke="#fbbf24" strokeWidth={_LW}/>
      {lbl}
    </g>
  )
  if (n === 'resistencia') return (
    <g>
      <rect x={cx - 24} y={cy - 14} width="48" height="28" fill="#0f172a"/>
      <rect x={cx - 20} y={cy - 10} width="40" height="20" stroke="#60a5fa" fill="none" strokeWidth={_LW}/>
      {lbl}
    </g>
  )
  if (n === 'interruptor') return (
    <g>
      <rect x={cx - 24} y={cy - 22} width="48" height="44" fill="#0f172a"/>
      <circle cx={cx - 14} cy={cy} r="3" fill="white"/>
      <line x1={cx - 14} y1={cy} x2={cx + 8} y2={cy - 14} stroke="white" strokeWidth={_LW}/>
      <circle cx={cx + 14} cy={cy} r="3" fill="white"/>
      <text x={cx} y={cy + 30} textAnchor="middle" fill="#94a3b8" fontSize="9">interruptor</text>
    </g>
  )
  if (n === 'condensador') return (
    <g>
      <rect x={cx - 20} y={cy - 16} width="40" height="32" fill="#0f172a"/>
      <line x1={cx - 6} y1={cy - 13} x2={cx - 6} y2={cy + 13} stroke="#60a5fa" strokeWidth="2.5"/>
      <line x1={cx + 6} y1={cy - 13} x2={cx + 6} y2={cy + 13} stroke="#60a5fa" strokeWidth="2.5"/>
      {lbl}
    </g>
  )
  if (n === 'motor' || n === 'generador') {
    const letter = n === 'motor' ? 'M' : 'G'
    const col = n === 'motor' ? '#4ade80' : '#a78bfa'
    return (
      <g>
        <rect x={cx - 18} y={cy - 18} width="36" height="36" fill="#0f172a"/>
        <circle cx={cx} cy={cy} r={15} stroke={col} fill="none" strokeWidth={_LW}/>
        <text x={cx} y={cy + 5} textAnchor="middle" fill={col} fontSize="13" fontWeight="bold">{letter}</text>
        {lbl}
      </g>
    )
  }
  return <text x={cx} y={cy} textAnchor="middle" fill="#f87171" fontSize="10">{name}</text>
}

function BatH({ cx, cy }) {
  return (
    <g>
      <rect x={cx - 30} y={cy - 20} width="60" height="40" fill="#0f172a"/>
      <line x1={cx - 12} y1={cy - 14} x2={cx - 12} y2={cy + 14} stroke="#4ade80" strokeWidth={_LW}/>
      <line x1={cx + 12} y1={cy - 8} x2={cx + 12} y2={cy + 8} stroke="#f87171" strokeWidth="3.5"/>
      <text x={cx - 12} y={cy - 18} textAnchor="middle" fill="#4ade80" fontSize="10">+</text>
      <text x={cx + 12} y={cy - 18} textAnchor="middle" fill="#f87171" fontSize="10">−</text>
      <text x={cx} y={cy + 30} textAnchor="middle" fill="#94a3b8" fontSize="10">batería</text>
    </g>
  )
}

function BatV({ cx, topY, botY }) {
  const cy = (topY + botY) / 2
  return (
    <g>
      <rect x={cx - 26} y={cy - 20} width="52" height="40" fill="#0f172a"/>
      <line x1={cx - 14} y1={cy - 7} x2={cx + 14} y2={cy - 7} stroke="#4ade80" strokeWidth={_LW}/>
      <line x1={cx - 7} y1={cy + 7} x2={cx + 7} y2={cy + 7} stroke="#f87171" strokeWidth="3.5"/>
      <text x={cx + 22} y={cy - 5} fill="#4ade80" fontSize="10">+</text>
      <text x={cx + 22} y={cy + 10} fill="#f87171" fontSize="10">−</text>
      <text x={cx} y={topY - 8} textAnchor="middle" fill="#94a3b8" fontSize="9">batería</text>
    </g>
  )
}

function SerieCircuit({ spec }) {
  const comps = [...(spec.control ? [spec.control] : []), ...(spec.componentes || [])]
  const n = Math.max(comps.length, 1)
  const T = 75, B = 235, L = 80, R = 720
  const spacing = (R - L) / (n + 1)
  return (
    <svg viewBox="0 0 800 310" width="100%" height="100%">
      <rect width="800" height="310" fill="#0f172a"/>
      <line x1={L} y1={T} x2={R} y2={T} stroke="white" strokeWidth={_LW}/>
      <line x1={L} y1={T} x2={L} y2={B} stroke="white" strokeWidth={_LW}/>
      <line x1={R} y1={T} x2={R} y2={B} stroke="white" strokeWidth={_LW}/>
      <line x1={L} y1={B} x2={370} y2={B} stroke="white" strokeWidth={_LW}/>
      <line x1={430} y1={B} x2={R} y2={B} stroke="white" strokeWidth={_LW}/>
      {comps.map((c, i) => <CompSym key={i} name={c} cx={L + spacing * (i + 1)} cy={T}/>)}
      <BatH cx={400} cy={B}/>
    </svg>
  )
}

function ParaleloCircuit({ spec }) {
  const ramas = spec.ramas || [[], []]
  const B1 = 100, B2 = 200, AX = 220, BX = 580, LX = 80, RX = 720
  const bw = BX - AX
  const r1 = ramas[0] || [], r2 = ramas[1] || []
  const p1 = r1.map((_, i) => AX + bw / (r1.length + 1) * (i + 1))
  const p2 = r2.map((_, i) => AX + bw / (r2.length + 1) * (i + 1))
  return (
    <svg viewBox="0 0 800 300" width="100%" height="100%">
      <rect width="800" height="300" fill="#0f172a"/>
      <line x1={LX} y1={B1} x2={LX} y2={B2} stroke="white" strokeWidth={_LW}/>
      <BatV cx={LX} topY={B1} botY={B2}/>
      <line x1={LX} y1={B1} x2={AX} y2={B1} stroke="white" strokeWidth={_LW}/>
      <line x1={LX} y1={B2} x2={AX} y2={B2} stroke="white" strokeWidth={_LW}/>
      <line x1={AX} y1={B1} x2={AX} y2={B2} stroke="white" strokeWidth={_LW}/>
      <line x1={AX} y1={B1} x2={BX} y2={B1} stroke="white" strokeWidth={_LW}/>
      {r1.map((c, i) => <CompSym key={`b1-${i}`} name={c} cx={p1[i]} cy={B1}/>)}
      <line x1={AX} y1={B2} x2={BX} y2={B2} stroke="white" strokeWidth={_LW}/>
      {r2.map((c, i) => <CompSym key={`b2-${i}`} name={c} cx={p2[i]} cy={B2}/>)}
      <line x1={BX} y1={B1} x2={BX} y2={B2} stroke="white" strokeWidth={_LW}/>
      <line x1={BX} y1={B1} x2={RX} y2={B1} stroke="white" strokeWidth={_LW}/>
      <line x1={BX} y1={B2} x2={RX} y2={B2} stroke="white" strokeWidth={_LW}/>
      <line x1={RX} y1={B1} x2={RX} y2={B2} stroke="white" strokeWidth={_LW}/>
      <circle cx={AX} cy={B1} r="4" fill="white"/>
      <circle cx={AX} cy={B2} r="4" fill="white"/>
      <circle cx={BX} cy={B1} r="4" fill="white"/>
      <circle cx={BX} cy={B2} r="4" fill="white"/>
      {spec.control && <CompSym name={spec.control} cx={(LX + AX) / 2} cy={B1}/>}
      <text x={AX} y={B1 - 10} textAnchor="middle" fill="#60a5fa" fontSize="10">A</text>
      <text x={BX} y={B1 - 10} textAnchor="middle" fill="#60a5fa" fontSize="10">B</text>
    </svg>
  )
}

function CircuitBoard({ content }) {
  try {
    const spec = JSON.parse(content.trim())
    return (
      <div className="absolute inset-0 flex flex-col overflow-hidden z-10 pointer-events-none p-2 gap-1">
        <div className="flex-1 overflow-hidden flex items-center justify-center">
          {spec.tipo === 'paralelo' ? <ParaleloCircuit spec={spec}/> : <SerieCircuit spec={spec}/>}
        </div>
        <p className="text-[10px] text-slate-600 text-center shrink-0">
          Diagrama con símbolos IEC — verifica con tu libro de texto
        </p>
      </div>
    )
  } catch { return null }
}

// ── Drawing canvas ────────────────────────────────────────────────────────────

const TOOLS = [
  { id: 'pen',    icon: '✏️', title: 'Lápiz (trazo libre)' },
  { id: 'arrow',  icon: '➡️', title: 'Flecha' },
  { id: 'rect',   icon: '⬜', title: 'Rectángulo' },
  { id: 'circle', icon: '⭕', title: 'Elipse' },
  { id: 'eraser', icon: '🧹', title: 'Borrar' },
]

export default function TutorWhiteboard({ tutorContent }) {
  const canvasRef  = useRef(null)
  const drawing    = useRef(false)
  const lastPos    = useRef(null)
  const shapeStart = useRef(null)
  const snapshot   = useRef(null)
  const [color, setColor] = useState('#f1f5f9')
  const [size, setSize]   = useState(3)
  const [tool, setTool]   = useState('pen')

  // ── Paste image (Ctrl+V) ─────────────────────────────────────────────────
  useEffect(() => {
    function onPaste(e) {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          const reader = new FileReader()
          reader.onload = ev => {
            const img = new Image()
            img.onload = () => {
              const canvas = canvasRef.current
              if (!canvas) return
              const ctx = canvas.getContext('2d')
              const scale = Math.min(canvas.width / img.width, canvas.height / img.height, 1) * 0.55
              const w = img.width * scale
              const h = img.height * scale
              const x = (canvas.width - w) / 2
              const y = (canvas.height - h) / 2
              ctx.globalCompositeOperation = 'source-over'
              ctx.drawImage(img, x, y, w, h)
            }
            img.src = ev.target.result
          }
          reader.readAsDataURL(file)
          break
        }
      }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [])

  // ── Canvas helpers ───────────────────────────────────────────────────────
  function getPos(e) {
    const canvas = canvasRef.current
    const rect   = canvas.getBoundingClientRect()
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height
    const src    = e.touches ? e.touches[0] : e
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top)  * scaleY,
    }
  }

  function drawArrow(ctx, from, to) {
    const dx = to.x - from.x, dy = to.y - from.y
    const angle = Math.atan2(dy, dx)
    const head  = Math.max(16, size * 4)
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = color; ctx.fillStyle = color
    ctx.lineWidth = size; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(to.x, to.y)
    ctx.lineTo(to.x - head * Math.cos(angle - Math.PI / 6), to.y - head * Math.sin(angle - Math.PI / 6))
    ctx.lineTo(to.x - head * Math.cos(angle + Math.PI / 6), to.y - head * Math.sin(angle + Math.PI / 6))
    ctx.closePath(); ctx.fill()
  }

  function drawRect(ctx, from, to) {
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = color; ctx.lineWidth = size; ctx.lineCap = 'round'
    ctx.strokeRect(from.x, from.y, to.x - from.x, to.y - from.y)
  }

  function drawCircle(ctx, from, to) {
    const rx = Math.abs(to.x - from.x) / 2, ry = Math.abs(to.y - from.y) / 2
    const cx = from.x + (to.x - from.x) / 2, cy = from.y + (to.y - from.y) / 2
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = color; ctx.lineWidth = size
    ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(rx,1), Math.max(ry,1), 0, 0, Math.PI * 2); ctx.stroke()
  }

  const isShape = () => ['arrow', 'rect', 'circle'].includes(tool)

  function applyShape(ctx, from, to) {
    if (tool === 'arrow')  drawArrow(ctx, from, to)
    if (tool === 'rect')   drawRect(ctx, from, to)
    if (tool === 'circle') drawCircle(ctx, from, to)
  }

  function startDraw(e) {
    e.preventDefault()
    const pos = getPos(e)
    if (isShape()) {
      shapeStart.current = pos
      const canvas = canvasRef.current
      snapshot.current = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
    } else {
      drawing.current = true
      lastPos.current = pos
    }
  }

  function draw(e) {
    e.preventDefault()
    const pos = getPos(e)
    const ctx = canvasRef.current.getContext('2d')

    if (isShape()) {
      if (!shapeStart.current) return
      ctx.putImageData(snapshot.current, 0, 0)
      applyShape(ctx, shapeStart.current, pos)
      return
    }

    if (!drawing.current) return
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = 'rgba(0,0,0,1)'
      ctx.lineWidth   = 28
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = color
      ctx.lineWidth   = size
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke()
    lastPos.current = pos
  }

  function stopDraw(e) {
    if (isShape()) {
      if (e && shapeStart.current) {
        const pos = getPos(e)
        const ctx = canvasRef.current.getContext('2d')
        ctx.putImageData(snapshot.current, 0, 0)
        applyShape(ctx, shapeStart.current, pos)
      }
      shapeStart.current = null; snapshot.current = null
    } else {
      drawing.current = false; lastPos.current = null
    }
  }

  function clear() {
    const canvas = canvasRef.current
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
  }

  function saveBoard() {
    const canvas = canvasRef.current
    const link = document.createElement('a')
    link.download = `pizarra-${Date.now()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const cursorStyle = tool === 'eraser' ? 'cell' : 'crosshair'

  function printBoard() {
    const canvas = canvasRef.current
    const canvasPng = canvas.toDataURL('image/png')

    // SVG adaptado para papel blanco:
    // - quita rects de fondo oscuro
    // - convierte texto/stroke blanco a tinta oscura
    let printSVG = ''
    if (tutorContent && isSVG(tutorContent)) {
      printSVG = sanitizeSVG(tutorContent)
        .replace(/<rect([^>]*fill=["']#0f172a["'][^>]*)\/>/gi, '')
        .replace(/<rect([^>]*fill=["']#1e293b["'][^>]*)\/>/gi, '')
        .replace(/<rect([^>]*fill=["']#0f172a["'][^>]*)><\/rect>/gi, '')
        .replace(/fill=["']white["']/gi,    'fill="#1a1a2e"')
        .replace(/fill=["']#ffffff["']/gi,  'fill="#1a1a2e"')
        .replace(/fill=["']#e2e8f0["']/gi,  'fill="#1a1a2e"')
        .replace(/fill=["']#f8fafc["']/gi,  'fill="#1a1a2e"')
        .replace(/fill=["']#cbd5e1["']/gi,  'fill="#334155"')
        .replace(/stroke=["']white["']/gi,  'stroke="#1a1a2e"')
        .replace(/stroke=["']#e2e8f0["']/gi,'stroke="#1a1a2e"')
        .replace(/stroke=["']#ffffff["']/gi,'stroke="#1a1a2e"')
    }

    const w = window.open('', '_blank')
    w.document.write(`<!DOCTYPE html><html><head><title>Pizarra MyStudy AI</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: white; }
  .board {
    position: relative;
    width: 100%;
    aspect-ratio: 800 / 420;
    background: white;
  }
  .svg-layer { position: absolute; inset: 0; overflow: hidden; }
  .svg-layer svg { width: 100%; height: 100%; }
  .canvas-layer { position: absolute; inset: 0; }
  .canvas-layer img { width: 100%; height: 100%; object-fit: fill; }
  @media print {
    @page { size: landscape; margin: 8mm; }
    body { background: white; }
    .board { page-break-inside: avoid; }
  }
</style></head>
<body>
  <div class="board">
    ${printSVG ? `<div class="svg-layer">${printSVG}</div>` : ''}
    <div class="canvas-layer"><img src="${canvasPng}"></div>
  </div>
  <script>window.onload = () => setTimeout(() => window.print(), 400)</script>
</body></html>`)
    w.document.close()
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700 bg-slate-900/60 shrink-0 flex-wrap">
        {/* Shape tools */}
        <div className="flex gap-0.5">
          {TOOLS.map(tl => (
            <button key={tl.id} onClick={() => setTool(tl.id)} title={tl.title}
              className={`w-7 h-7 rounded flex items-center justify-center text-sm transition-colors
                ${tool === tl.id ? 'bg-violet-600 ring-1 ring-white' : 'text-slate-400 hover:bg-slate-700'}`}
            >{tl.icon}</button>
          ))}
        </div>

        <div className="w-px h-5 bg-slate-700" />

        {/* Colors */}
        <div className="flex gap-1">
          {COLORS.map(c => (
            <button key={c} onClick={() => { setColor(c); if (tool === 'eraser') setTool('pen') }}
              className="rounded-full border-2 transition-transform hover:scale-110"
              style={{ background: c, width: 20, height: 20,
                borderColor: color === c && tool !== 'eraser' ? 'white' : 'transparent' }}
            />
          ))}
        </div>

        <div className="w-px h-5 bg-slate-700" />

        {/* Brush sizes */}
        {[2, 4, 8].map(s => (
          <button key={s} onClick={() => setSize(s)}
            className={`rounded-full bg-slate-400 transition-all ${size === s ? 'ring-2 ring-white' : 'opacity-50'}`}
            style={{ width: s * 3 + 6, height: s * 3 + 6 }}
          />
        ))}

        <span className="text-[10px] text-slate-600 ml-2 hidden lg:inline">Ctrl+V = pegar imagen</span>
        <div className="ml-auto flex gap-1">
          <button onClick={saveBoard} className="px-2 py-0.5 rounded text-xs text-slate-400 hover:text-emerald-400 transition-colors" title="Guardar dibujo como imagen">💾 Guardar</button>
          <button onClick={printBoard} className="px-2 py-0.5 rounded text-xs text-slate-400 hover:text-violet-400 transition-colors" title="Imprimir pizarra">🖨️ Imprimir</button>
          <button onClick={clear} className="px-2 py-0.5 rounded text-xs text-slate-400 hover:text-red-400 transition-colors">🗑 Limpiar</button>
        </div>
      </div>

      {/* ── Canvas area ── */}
      <div className="flex-1 relative overflow-hidden bg-slate-950">

        {/* Tutor content layer */}
        {tutorContent ? (
          isMermaid(tutorContent)
            ? <MermaidBoard content={tutorContent} />
            : isSVG(tutorContent)
              ? <div className="absolute inset-0 flex flex-col overflow-hidden z-10 pointer-events-none p-3 gap-1">
                  <div className="flex-1 overflow-hidden"
                       dangerouslySetInnerHTML={{ __html: sanitizeSVG(tutorContent) }} />
                  <p className="text-[10px] text-slate-600 text-center shrink-0">
                    Diagrama ilustrativo — verifica con tu libro de texto
                  </p>
                </div>
              : isCircuit(tutorContent)
                ? <CircuitBoard content={tutorContent}/>
                : <div className="absolute inset-0 overflow-y-auto z-10 pointer-events-none">
                    <BoardContent content={tutorContent} />
                  </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none">
            <p className="text-slate-700 text-sm">El tutor escribirá aquí esquemas y pasos</p>
          </div>
        )}

        {/* User drawing canvas — transparent, on top */}
        <canvas
          ref={canvasRef}
          width={900}
          height={600}
          className="absolute inset-0 w-full h-full touch-none z-20"
          style={{ cursor: cursorStyle }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
      </div>
    </div>
  )
}
