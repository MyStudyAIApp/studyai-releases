import { useCallback } from 'react'
import { useStore, getStraightPath, BaseEdge } from 'reactflow'

// "Floating edge": en vez de salir del centro exacto del nodo (que hace que
// la línea se vea "meterse" dentro del óvalo), calcula dónde esa línea recta
// cruza el borde del óvalo de origen y de destino, y dibuja solo ese tramo --
// así la conexión se queda pegada al borde, nunca invade el texto de dentro.
// Aproxima cada nodo a un rombo/elipse usando su ancho y alto reales (ya
// medidos por React Flow), técnica estándar para layouts que no son en filas.
function getNodeIntersection(intersectionNode, targetNode) {
  const w = (intersectionNode.width || 0) / 2
  const h = (intersectionNode.height || 0) / 2
  const x2 = intersectionNode.positionAbsolute.x + w
  const y2 = intersectionNode.positionAbsolute.y + h
  const x1 = targetNode.positionAbsolute.x + (targetNode.width || 0) / 2
  const y1 = targetNode.positionAbsolute.y + (targetNode.height || 0) / 2

  const xx1 = (x1 - x2) / (2 * w || 1) - (y1 - y2) / (2 * h || 1)
  const yy1 = (x1 - x2) / (2 * w || 1) + (y1 - y2) / (2 * h || 1)
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1) || 1)
  const xx3 = a * xx1
  const yy3 = a * yy1
  const x = w * (xx3 + yy3) + x2
  const y = h * (-xx3 + yy3) + y2
  return { x, y }
}

export default function MindMapFloatingEdge({ id, source, target, style }) {
  const sourceNode = useStore(useCallback(s => s.nodeInternals.get(source), [source]))
  const targetNode = useStore(useCallback(s => s.nodeInternals.get(target), [target]))

  if (!sourceNode || !targetNode || !sourceNode.width || !targetNode.width) return null

  const sourcePoint = getNodeIntersection(sourceNode, targetNode)
  const targetPoint = getNodeIntersection(targetNode, sourceNode)

  const [path] = getStraightPath({
    sourceX: sourcePoint.x,
    sourceY: sourcePoint.y,
    targetX: targetPoint.x,
    targetY: targetPoint.y,
  })

  return <BaseEdge id={id} path={path} style={style} />
}
