import React, { useRef } from 'react'
import { usePanScroll, makeWheelZoom } from '../../hooks/usePanScroll'

// Paleta de colores vibrantes para modo oscuro, que se adaptan automáticamente
// a alta definición e impresión gracias a la herencia de currentColor.
const PALETTE = ['#818cf8', '#34d399', '#fbbf24', '#f87171', '#38bdf8', '#f472b6', '#a3e635', '#fb923c']

// ── COMPONENTES MODULARES DE LA LLAVE ──
// Para evitar la deformación de las curvas (típica de estirar un único SVG),
// segmentamos la llave en piezas fijas superiores/inferiores y una línea recta
// que se estira mediante `top`/`bottom` (no distorsiona porque es recta).

function TopCurve({ color }) {
  return (
    <svg
      className="absolute"
      style={{ left: '8px', top: 0, width: '12px', height: '12px', color }}
      viewBox="0 0 12 12"
      fill="none"
    >
      <path d="M 12,1 Q 1,1 1,12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function BottomCurve({ color }) {
  return (
    <svg
      className="absolute"
      style={{ left: '8px', bottom: 0, width: '12px', height: '12px', color }}
      viewBox="0 0 12 12"
      fill="none"
    >
      <path d="M 1,0 Q 1,11 12,11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function CenterPeak({ color }) {
  return (
    <svg
      className="absolute"
      style={{ left: 0, top: '50%', marginTop: '-12px', width: '8px', height: '24px', color }}
      viewBox="0 0 8 24"
      fill="none"
    >
      <path d="M 8,0 Q 8,12 1,12 Q 8,12 8,24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function SingleConnector({ color }) {
  return (
    <div
      className="absolute"
      style={{
        left: 0,
        top: '50%',
        width: '20px',
        height: '2px',
        borderTop: '2px solid currentColor',
        color,
        opacity: 0.5,
      }}
    />
  )
}

// Dibuja UNA sola llave que abarca la altura completa del grupo de hermanos,
// en vez de un gancho por cada hijo. Se coloca como overlay absoluto (inset:0)
// dentro de un contenedor `position:relative` cuyo tamaño lo define la lista
// de hijos (flex-col) — así la llave siempre mide exactamente lo que mide el grupo.
function GroupBrace({ count, color }) {
  if (count <= 1) {
    return <SingleConnector color={color} />
  }
  return (
    <>
      <TopCurve color={color} />
      <BottomCurve color={color} />
      <CenterPeak color={color} />
      <div
        className="absolute"
        style={{
          left: '8px',
          top: '12px',
          bottom: '12px',
          width: '2px',
          backgroundColor: 'currentColor',
          color,
          opacity: 0.45,
        }}
      />
    </>
  )
}

function NodeBox({ title, level, color, subtreeRef, whiteBg }) {
  const isRoot = level === 0
  return (
    <div
      className={`node-box ${isRoot ? 'node-root' : ''} inline-block rounded-lg font-medium shadow-sm transition-all`}
      style={{
        padding: isRoot ? '8px 14px' : '5px 10px',
        borderRadius: '6px',
        fontWeight: isRoot ? 700 : 600,
        fontSize: isRoot ? '14px' : '13px',
        lineHeight: '1.4',
        backgroundColor: isRoot ? '#4f46e5' : whiteBg ? '#eef2ff' : '#1e293b',
        color: isRoot ? '#ffffff' : whiteBg ? '#1e1b4b' : '#f1f5f9',
        border: isRoot ? 'none' : `2px solid ${color}`,
        whiteSpace: 'nowrap',
      }}
    >
      {title}
      {subtreeRef && (
        <span 
          className="braces-subtree-badge ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30 align-middle"
        >
          Secc. {subtreeRef}
        </span>
      )}
    </div>
  )
}

function Branch({ node, color, level = 0, whiteBg }) {
  const children = node.groups || []
  const N = children.length

  return (
    <div className="flex items-center gap-4" style={{ breakInside: 'avoid' }}>
      {/* Caja de contenido del nodo */}
      <NodeBox title={node.title} level={level} color={color} subtreeRef={node.subtreeRef} whiteBg={whiteBg} />

      {/* Contenedor de descendientes y llave (una sola por grupo de hermanos) */}
      {N > 0 && (
        <div className="relative flex items-center">
          <div className="absolute inset-0 pointer-events-none">
            <GroupBrace count={N} color={color} />
          </div>

          <div className="flex flex-col gap-3 pl-5 py-2">
            {children.map((child, i) => (
              <div key={i} style={{ breakInside: 'avoid' }}>
                <Branch node={child} color={color} level={level + 1} whiteBg={whiteBg} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function BracesSchemaView({ result, doc, whiteBg, zoom, onZoomChange }) {
  const { tema, groups = [] } = result || {}
  const cardRef = useRef(null)
  const { onMouseDown, panCursorStyle } = usePanScroll(cardRef)
  const onWheel = makeWheelZoom(onZoomChange)

  if (!tema && groups.length === 0) {
    return (
      <div className="card">
        <p className="text-slate-500 text-sm">No se pudo generar el esquema de llaves.</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-3">
      {(doc?.title || tema) && (
        <h2 className={`text-lg font-bold text-center ${whiteBg ? 'text-slate-900' : 'text-slate-100'}`}>{doc?.title || tema}</h2>
      )}
      {/* Con overflow en los dos ejes + arrastrar con el ratón (usePanScroll),
          para poder mover esquemas grandes sin depender solo de las barras de
          scroll — útil sobre todo combinado con el zoom. */}
      <div
        ref={cardRef}
        className="card p-4 no-scrollbar"
        style={{
          overflow: 'auto',
          maxHeight: '85vh',
          backgroundColor: whiteBg ? '#ffffff' : undefined,
          transition: 'background-color 0.15s',
          ...panCursorStyle,
        }}
        onMouseDown={onMouseDown}
        onWheel={onWheel}
      >
        {/* El zoom se aplica AQUÍ DENTRO (no en la tarjeta blanca de fuera), para
            que el marco/hoja se quede del mismo tamaño y solo el árbol se
            encoja o agrande visualmente dentro de él. id usado también por
            ResultPanel al imprimir: mide el ancho NATURAL del árbol (no el del
            contenedor con scroll, que siempre da un valor recortado). */}
        <div
          id="braces-natural-width"
          style={{
            minWidth: 'fit-content',
            transform: zoom && zoom !== 100 ? `scale(${zoom / 100})` : undefined,
            transformOrigin: 'top left',
          }}
          className="py-2"
        >
          <div className="flex items-center gap-4">
            <NodeBox title={tema || 'Tema'} level={0} color="#6366f1" whiteBg={whiteBg} />

            {groups.length > 0 && (
              <div className="relative flex items-center">
                <div className="absolute inset-0 pointer-events-none">
                  <GroupBrace count={groups.length} color="#94a3b8" />
                </div>

                <div className="flex flex-col gap-3 pl-5 py-2">
                  {groups.map((group, i) => (
                    <div key={i} style={{ breakInside: 'avoid' }}>
                      <Branch node={group} color={PALETTE[i % PALETTE.length]} level={1} whiteBg={whiteBg} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
