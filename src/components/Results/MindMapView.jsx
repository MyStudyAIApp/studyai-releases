import { useMemo } from 'react'
import ReactFlow, { Background, Controls, Handle, Position } from 'reactflow'
import 'reactflow/dist/style.css'
import { treeToFlow } from '../../utils/mindmapLayout'
import MindMapFloatingEdge from './MindMapFloatingEdge'

const PALETTE = ['#818cf8', '#34d399', '#fbbf24', '#f87171', '#38bdf8', '#f472b6', '#a3e635', '#fb923c']

// Nodo con solo el contorno de color (sin relleno), para que el texto se lea
// bien -- el nodo raíz sí lleva fondo de color para destacar como centro.
// Los Handle van centrados de verdad (no en un lateral fijo) para que la
// línea recta salga del centro exacto del nodo en cualquier ángulo -- en un
// layout radial cada rama sale en una dirección distinta, un handle fijo a
// la izquierda/derecha hacía que la línea se desviara y cruzara otros textos.
const CENTER_HANDLE_STYLE = { opacity: 0, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }

function SchemaNode({ data }) {
  const { label, color, isRoot, whiteBg } = data
  return (
    <div
      style={{
        position: 'relative',
        padding: isRoot ? '10px 16px' : '6px 12px',
        borderRadius: '999px',
        border: `2px solid ${color}`,
        backgroundColor: isRoot ? color : 'transparent',
        color: isRoot ? '#ffffff' : whiteBg ? '#1e1b4b' : '#f1f5f9',
        fontWeight: isRoot ? 700 : 600,
        fontSize: isRoot ? '14px' : '13px',
        whiteSpace: 'nowrap',
        textAlign: 'center',
      }}
    >
      <Handle type="target" position={Position.Left} style={CENTER_HANDLE_STYLE} />
      {label}
      <Handle type="source" position={Position.Right} style={CENTER_HANDLE_STYLE} />
    </div>
  )
}

const nodeTypes = { schemaNode: SchemaNode }
const edgeTypes = { floating: MindMapFloatingEdge }

export default function MindMapView({ result, whiteBg }) {
  const { tema, groups = [] } = result || {}

  const { nodes, edges } = useMemo(() => {
    if (!tema && groups.length === 0) return { nodes: [], edges: [] }
    const flow = treeToFlow(tema, groups, PALETTE)
    return { nodes: flow.nodes, edges: flow.edges }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result])

  // El whiteBg del nodo se aplica aquí (no en treeToFlow) para no tener que
  // regenerar el layout solo por cambiar de tema de color.
  const styledNodes = useMemo(
    () => nodes.map(n => ({ ...n, data: { ...n.data, whiteBg } })),
    [nodes, whiteBg]
  )

  if (!tema && groups.length === 0) {
    return (
      <div className="card">
        <p className="text-slate-500 text-sm">No se pudo generar el mapa conceptual.</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-3">
      {tema && <h2 className={`text-lg font-bold text-center ${whiteBg ? 'text-slate-900' : 'text-slate-100'}`}>{tema}</h2>}
      <div
        className="card"
        style={{ height: '70vh', padding: 0, overflow: 'hidden', backgroundColor: whiteBg ? '#ffffff' : undefined, transition: 'background-color 0.15s' }}
      >
        <ReactFlow
          nodes={styledNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
        >
          <Background color={whiteBg ? '#cbd5e1' : '#334155'} gap={20} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  )
}
