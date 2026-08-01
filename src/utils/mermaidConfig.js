/**
 * Configuración centralizada de Mermaid — importar desde SchemaView y MindMapView.
 * Solo se inicializa una vez gracias al módulo singleton de ES.
 */
import mermaid from 'mermaid'

mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    // Base / graph TD
    background: '#1e293b',
    primaryColor: '#4f46e5',
    primaryTextColor: '#ffffff',
    primaryBorderColor: '#6366f1',
    lineColor: '#94a3b8',
    secondaryColor: '#0f172a',
    tertiaryColor: '#1e293b',
    edgeLabelBackground: '#1e293b',
    fontSize: '20px',
    // Mindmap cScale0-11 (nivel de profundidad)
    cScale0: '#4f46e5',
    cScale1: '#7c3aed',
    cScale2: '#0369a1',
    cScale3: '#0f766e',
    cScale4: '#b45309',
    cScale5: '#be123c',
    cScale6: '#1d4ed8',
    cScale7: '#7e22ce',
    cScale8: '#0e7490',
    cScale9: '#15803d',
    cScale10: '#c2410c',
    cScale11: '#9333ea',
  },
  flowchart: {
    padding: 15,
    nodeSpacing: 40,
    rankSpacing: 60,
    useMaxWidth: false,
  },
  mindmap: {
    padding: 15,
    useMaxWidth: false,
  },
})

/** Inyecta CSS en el SVG para garantizar legibilidad en tema oscuro.
 *
 * IMPORTANTE: este <style> se inserta con dangerouslySetInnerHTML dentro de
 * la página, así que NO queda aislado al SVG del diagrama -- un <style> se
 * aplica siempre a todo el documento, esté donde esté en el DOM. Por eso
 * cada regla se ancla al id único que Mermaid ya pone en el <svg> raíz (el
 * mismo que se le pasa a mermaid.render()); si no, un simple `svg { width:
 * 100% }` infla TODOS los SVG de la página (el logo, los iconos de flecha...)
 * en cuanto se genera un diagrama. */
export function fixSvgColors(svg) {
  const idMatch = svg.match(/<svg[^>]*\bid="([^"]+)"/)
  const s = idMatch ? `#${idMatch[1]}` : 'svg'
  const style = `<style>
    ${s} { background: transparent !important; width: 100% !important; height: auto !important; max-width: none !important; }
    /* graph TD */
    ${s} .node rect, ${s} .node circle, ${s} .node ellipse, ${s} .node polygon, ${s} .node path {
      stroke: #6366f1 !important;
    }
    ${s} .node .label { color: #ffffff !important; }
    ${s} .edgeLabel { background-color: #1e293b !important; color: #cbd5e1 !important; }
    ${s} .edgeLabel foreignObject { color: #cbd5e1 !important; }
    /* mindmap: óvalos solo con el contorno de color (sin relleno), para que
       el texto se lea mejor -- el color de cada rama sigue viéndose en el borde. */
    ${s} .mindmap-node > * { stroke-width: 2px !important; fill: none !important; }
    ${s} .mindmap-node .label, ${s} .mindmap-node text, ${s} .mindmap-node tspan {
      fill: #f1f5f9 !important; font-weight: 500 !important;
    }
    ${s} .section-root > * { fill: none !important; stroke: #818cf8 !important; stroke-width: 2.5px !important; }
    ${s} .edge { stroke: #94a3b8 !important; stroke-width: 1.5px !important; }
  </style>`
  return svg.replace('</svg>', style + '</svg>')
}

export default mermaid
