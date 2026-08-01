// Esquema de desarrollo numerado: 1. Idea principal, 1.1 Idea secundaria,
// 1.1.1 Idea terciaria... el número de cada nivel se colorea distinto para
// que se distinga de un vistazo la profundidad.
import { useRef } from 'react'
import { usePanScroll, makeWheelZoom } from '../../hooks/usePanScroll'

const LEVEL_COLORS = ['#fbbf24', '#38bdf8', '#34d399', '#f472b6', '#a78bfa']

function NumberBadge({ path, level }) {
  const color = LEVEL_COLORS[level % LEVEL_COLORS.length]
  return (
    <span
      className="inline-block px-2 py-0.5 rounded font-bold text-slate-900 text-sm shrink-0"
      style={{ backgroundColor: color }}
    >
      {path.join('.')}
    </span>
  )
}

function Item({ node, path, level, whiteBg }) {
  const children = node.groups || []
  return (
    <div style={{ marginLeft: level > 0 ? '1.75rem' : 0 }} className="mt-2">
      <div className="flex items-center gap-2">
        <NumberBadge path={path} level={level} />
        <span className={`${whiteBg ? 'text-slate-900' : 'text-slate-100'} ${level === 0 ? 'font-semibold text-base' : 'text-sm'}`}>{node.title}</span>
      </div>
      {children.map((child, i) => (
        <Item key={i} node={child} path={[...path, i + 1]} level={level + 1} whiteBg={whiteBg} />
      ))}
    </div>
  )
}

export default function NumberedSchemaView({ result, whiteBg, zoom, onZoomChange }) {
  const { tema, groups = [] } = result || {}
  const cardRef = useRef(null)
  const { onMouseDown, panCursorStyle } = usePanScroll(cardRef)
  const onWheel = makeWheelZoom(onZoomChange)

  if (!tema && groups.length === 0) {
    return (
      <div className="card">
        <p className="text-slate-500 text-sm">No se pudo generar el esquema.</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className={`inline-block border-2 rounded-lg px-4 py-1.5 ${whiteBg ? 'border-slate-300' : 'border-slate-600'}`}>
        <p className={`font-bold text-sm ${whiteBg ? 'text-slate-900' : 'text-slate-100'}`}>Esquema de desarrollo numerado</p>
      </div>
      {tema && <h2 className={`text-2xl italic font-serif ${whiteBg ? 'text-slate-900' : 'text-slate-100'}`}>{tema}</h2>}
      {/* Con overflow en los dos ejes + arrastrar con el ratón (usePanScroll),
          para poder mover esquemas grandes sin depender solo de las barras de
          scroll. El zoom se aplica al contenido de dentro, no a esta tarjeta,
          para que el marco/hoja se quede del mismo tamaño. */}
      <div
        ref={cardRef}
        className="card no-scrollbar"
        style={{
          overflow: 'auto',
          maxHeight: '70vh',
          backgroundColor: whiteBg ? '#ffffff' : undefined,
          transition: 'background-color 0.15s',
          ...panCursorStyle,
        }}
        onMouseDown={onMouseDown}
        onWheel={onWheel}
      >
        <div style={{ transform: zoom && zoom !== 100 ? `scale(${zoom / 100})` : undefined, transformOrigin: 'top left' }}>
          {groups.map((principal, i) => (
            <Item key={i} node={principal} path={[i + 1]} level={0} whiteBg={whiteBg} />
          ))}
        </div>
      </div>
    </div>
  )
}
