// Convierte el árbol {tema, groups} (mismo formato que el esquema numerado y
// el de llaves) en nodos/conexiones de React Flow, con un diseño RADIAL real:
// el tema va en el centro y cada rama ocupa un sector angular a su alrededor,
// repartido proporcionalmente a cuántas hojas tiene esa rama. Un layout en
// columnas (tipo dagre LR) se parecía demasiado a un árbol/esquema de llaves
// -- esto es lo que hace que se vea como un mapa conceptual de verdad.

const RADIUS_STEP = 220

function countLeaves(node) {
  const children = node.groups || []
  if (children.length === 0) return 1
  return children.reduce((sum, c) => sum + countLeaves(c), 0)
}

export function treeToFlow(tema, groups, palette) {
  const nodes = []
  const edges = []
  let idCounter = 0
  const newId = () => `n${idCounter++}`

  function addNode(title, color, isRoot, x, y) {
    const id = newId()
    nodes.push({ id, type: 'schemaNode', data: { label: title || '', color, isRoot }, position: { x, y } })
    return id
  }

  function addEdge(sourceId, targetId, color) {
    edges.push({
      id: `e-${sourceId}-${targetId}`,
      source: sourceId,
      target: targetId,
      // 'floating': calcula en MindMapFloatingEdge.jsx dónde la línea recta
      // cruza el borde de cada óvalo, para que la conexión se quede pegada
      // al borde y nunca "entre" dentro del texto -- necesario en un layout
      // radial, donde cada rama sale en un ángulo distinto (un handle fijo
      // izquierda/derecha hacía que la línea atravesara el óvalo).
      type: 'floating',
      style: { stroke: color, strokeWidth: 1.5 },
    })
  }

  function placeChildren(children, parentId, color, angleStart, angleEnd, depth) {
    const total = children.reduce((sum, c) => sum + countLeaves(c), 0) || 1
    let cursor = angleStart
    children.forEach(child => {
      const share = (angleEnd - angleStart) * (countLeaves(child) / total)
      const angle = cursor + share / 2
      const radius = RADIUS_STEP * depth
      const id = addNode(child.title, color, false, Math.cos(angle) * radius, Math.sin(angle) * radius)
      addEdge(parentId, id, color)
      placeChildren(child.groups || [], id, color, cursor, cursor + share, depth + 1)
      cursor += share
    })
  }

  const rootId = addNode(tema || 'Tema', '#6366f1', true, 0, 0)

  const fullCircle = Math.PI * 2
  const totalLeaves = groups.reduce((sum, g) => sum + countLeaves(g), 0) || 1
  let cursor = 0
  groups.forEach((group, i) => {
    const color = palette[i % palette.length]
    const share = fullCircle * (countLeaves(group) / totalLeaves)
    const angle = cursor + share / 2
    const id = addNode(group.title, color, false, Math.cos(angle) * RADIUS_STEP, Math.sin(angle) * RADIUS_STEP)
    addEdge(rootId, id, color)
    placeChildren(group.groups || [], id, color, cursor, cursor + share, 2)
    cursor += share
  })

  return { nodes, edges }
}
