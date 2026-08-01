// Cartel de bienvenida en el primer arranque (web/escritorio) — sustituye al
// antiguo recorrido general por toda la app. Solo avisa de que existen
// tutoriales detallados por sección en Ajustes.
export default function WelcomeCard({ onGo, onClose }) {
  return (
    <div className="fixed inset-0" style={{ zIndex: 9999 }}>
      <div className="absolute inset-0 bg-black/72" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center px-6" style={{ zIndex: 10001 }}>
        <div className="card border-primary-600/60 shadow-2xl max-w-sm text-center" onClick={e => e.stopPropagation()}>
          <span className="text-5xl">🎓</span>
          <h2 className="text-xl font-bold text-slate-100 mt-3">¡Bienvenido a MyStudy AI!</h2>
          <p className="text-sm text-slate-300 mt-2 leading-relaxed">
            Convierte tus apuntes en resúmenes, exámenes, flashcards y mucho más.
            {'\n\n'}Cuando tengas una duda sobre una sección concreta, en Ajustes → 📖 Tutoriales detallados
            tienes un recorrido guiado centrado solo en esa pantalla.
          </p>
          <div className="flex items-center justify-center gap-3 mt-5">
            <button onClick={onClose} className="btn-secondary text-sm px-4 py-2">Cerrar</button>
            <button onClick={onGo}
              className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-bold transition-colors">
              Ir a tutoriales →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
