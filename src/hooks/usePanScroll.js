import { useRef, useCallback, useEffect } from 'react'

// Arrastrar con el ratón para desplazar un contenedor con scroll (como en
// Miro/Google Maps), útil en esquemas grandes en vez de depender solo de las
// barras de scroll. Los listeners de mover/soltar van en `window` (no en el
// propio elemento) porque si el ratón se mueve rápido puede salirse de los
// límites del elemento a mitad de arrastre y dejaría de funcionar.
export function usePanScroll(ref) {
  const dragState = useRef(null)

  useEffect(() => {
    function onMouseMove(e) {
      if (!dragState.current || !ref.current) return
      const dx = e.clientX - dragState.current.startX
      const dy = e.clientY - dragState.current.startY
      ref.current.scrollLeft = dragState.current.scrollLeft - dx
      ref.current.scrollTop = dragState.current.scrollTop - dy
    }
    function onMouseUp() {
      if (!dragState.current) return
      dragState.current = null
      if (ref.current) ref.current.style.cursor = 'grab'
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [ref])

  const onMouseDown = useCallback((e) => {
    if (!ref.current || e.button !== 0) return
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: ref.current.scrollLeft,
      scrollTop: ref.current.scrollTop,
    }
    ref.current.style.cursor = 'grabbing'
    // Evita que arrastrar seleccione texto de la página por accidente.
    document.body.style.userSelect = 'none'
  }, [ref])

  return { onMouseDown, panCursorStyle: { cursor: 'grab' } }
}

// Rueda del ratón = zoom directo (sin necesitar Ctrl), igual que el mapa
// conceptual (React Flow) -- así el zoom se siente consistente en toda la
// sección de esquemas. `onZoomChange` es el setter de estado del padre.
export function makeWheelZoom(onZoomChange, { min = 40, max = 150, step = 5 } = {}) {
  return function onWheel(e) {
    if (!onZoomChange) return
    e.preventDefault()
    const delta = e.deltaY > 0 ? -step : step
    onZoomChange(z => Math.min(max, Math.max(min, z + delta)))
  }
}
