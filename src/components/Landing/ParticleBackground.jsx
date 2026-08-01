import { useEffect, useRef } from 'react'

// Fondo de partículas conectadas que reaccionan al ratón — adaptado de un
// componente de 21st.dev/Aether Flow. Usa position:fixed del tamaño de la
// ventana (no de toda la página, que puede medir varias pantallas de alto)
// para que se vea "detrás" de todas las secciones al hacer scroll sin tener
// que repintar un lienzo gigante en cada fotograma. Además se desliza un
// poco más despacio que el resto (parallax) para dar sensación de profundidad
// — el margen de lienzo extra se calcula según lo que mide la página entera,
// para que el desplazamiento no se pare a medio camino y llegue justo al
// final al llegar al final de la página.
const PARALLAX_FACTOR = 0.1 // 10% de la velocidad real del scroll

export default function ParticleBackground({ className = '' }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ctx = canvas.getContext('2d')
    let animationFrameId
    let particles = []
    let parallaxMargin = 0
    const mouse = { x: null, y: null, radius: 140 }

    class Particle {
      constructor(x, y, directionX, directionY, size) {
        this.x = x
        this.y = y
        this.directionX = directionX
        this.directionY = directionY
        this.size = size
      }
      draw() {
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false)
        ctx.fillStyle = 'rgba(191, 128, 255, 0.8)'
        ctx.fill()
      }
      update() {
        if (this.x > canvas.width || this.x < 0) this.directionX = -this.directionX
        if (this.y > canvas.height || this.y < 0) this.directionY = -this.directionY

        if (mouse.x !== null && mouse.y !== null) {
          const dx = mouse.x - this.x
          const dy = mouse.y - this.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          if (distance < mouse.radius + this.size) {
            const force = (mouse.radius - distance) / mouse.radius
            this.x -= (dx / distance) * force * 5
            this.y -= (dy / distance) * force * 5
          }
        }

        this.x += this.directionX
        this.y += this.directionY
        this.draw()
      }
    }

    function init() {
      particles = []
      const count = Math.min(180, (canvas.height * canvas.width) / 9000)
      for (let i = 0; i < count; i++) {
        const size = Math.random() * 2 + 1
        const x = Math.random() * (canvas.width - size * 4) + size * 2
        const y = Math.random() * (canvas.height - size * 4) + size * 2
        const directionX = Math.random() * 0.4 - 0.2
        const directionY = Math.random() * 0.4 - 0.2
        particles.push(new Particle(x, y, directionX, directionY, size))
      }
    }

    function resize() {
      const scrollRange = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
      parallaxMargin = prefersReducedMotion ? 0 : Math.ceil(scrollRange * PARALLAX_FACTOR)
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight + parallaxMargin
      canvas.style.height = `${canvas.height}px`
      init()
    }

    function connect() {
      for (let a = 0; a < particles.length; a++) {
        for (let b = a; b < particles.length; b++) {
          const distance =
            (particles[a].x - particles[b].x) ** 2 + (particles[a].y - particles[b].y) ** 2
          const maxDist = (canvas.width / 7) * (canvas.height / 7)
          if (distance < maxDist) {
            const opacity = 1 - distance / 20000
            const dxm = particles[a].x - (mouse.x ?? -9999)
            const dym = particles[a].y - (mouse.y ?? -9999)
            const distMouse = Math.sqrt(dxm * dxm + dym * dym)
            ctx.strokeStyle = mouse.x && distMouse < mouse.radius
              ? `rgba(255, 255, 255, ${opacity})`
              : `rgba(200, 150, 255, ${opacity})`
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(particles[a].x, particles[a].y)
            ctx.lineTo(particles[b].x, particles[b].y)
            ctx.stroke()
          }
        }
      }
    }

    function animate() {
      animationFrameId = requestAnimationFrame(animate)
      ctx.fillStyle = '#0f172a'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      particles.forEach(p => p.update())
      connect()

      if (!prefersReducedMotion) {
        const offset = Math.max(-parallaxMargin, -window.scrollY * PARALLAX_FACTOR)
        canvas.style.transform = `translate3d(0, ${offset}px, 0)`
      }
    }

    function handleMouseMove(e) {
      mouse.x = e.clientX
      mouse.y = e.clientY
    }
    function handleMouseOut() {
      mouse.x = null
      mouse.y = null
    }

    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseout', handleMouseOut)

    resize()
    animate()

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseout', handleMouseOut)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={`fixed top-0 left-0 w-screen will-change-transform ${className}`}
    />
  )
}
