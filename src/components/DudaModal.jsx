import { useState, useEffect, useRef } from 'react'
import { IconLoader2, IconCheck, IconX } from '@tabler/icons-react'

/** Cuadro para confirmar o corregir UNA palabra que la transcripcion dudo. */
export default function DudaModal({ duda, guardando, onCerrar, onResolver }) {
  const [valor, setValor] = useState(duda.palabra)
  const inputRef = useRef(null)

  // Foco y texto seleccionado al abrir: lo normal es querer reescribir la
  // palabra entera, no colocar el cursor a mano en un movil.
  useEffect(() => { inputRef.current?.select() }, [])

  const cambiada = valor.trim() && valor.trim() !== duda.palabra

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
         onClick={onCerrar}>
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 w-full max-w-sm"
           onClick={ev => ev.stopPropagation()}>
        <p className="text-sm text-slate-400 mb-1">Esta palabra no se leyó con seguridad</p>
        <p className="text-xs text-slate-500 mb-3">Corrígela si está mal, o confírmala si es correcta.</p>

        <input
          ref={inputRef}
          value={valor}
          onChange={ev => setValor(ev.target.value)}
          onKeyDown={ev => { if (ev.key === 'Enter' && cambiada) onResolver(valor.trim()) }}
          disabled={guardando}
          className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5 text-slate-100
                     focus:border-primary-500 focus:outline-none disabled:opacity-50"
          autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}
        />

        <div className="flex gap-2 mt-4">
          {/* "Correcto" quita la interrogacion sin tocar la palabra; "Editar"
              la sustituye. Se pasa `undefined` en el primer caso justamente
              para dejar la palabra tal cual (ver resolverDuda). */}
          <button
            onClick={() => onResolver(undefined)}
            disabled={guardando}
            className="flex-1 flex items-center justify-center gap-1.5 bg-slate-700 hover:bg-slate-600
                       text-slate-100 rounded-xl py-2.5 text-sm font-medium disabled:opacity-50"
          >
            <IconCheck size={16} /> Correcto
          </button>
          <button
            onClick={() => onResolver(valor.trim())}
            disabled={guardando || !cambiada}
            className="flex-1 flex items-center justify-center gap-1.5 bg-primary-600 hover:bg-primary-500
                       text-white rounded-xl py-2.5 text-sm font-medium
                       disabled:opacity-40 disabled:hover:bg-primary-600"
          >
            {guardando ? <IconLoader2 size={16} className="animate-spin" /> : <IconCheck size={16} />} Editar
          </button>
        </div>

        <button onClick={onCerrar} disabled={guardando}
                className="w-full mt-2 text-xs text-slate-500 hover:text-slate-300 py-1.5
                           flex items-center justify-center gap-1 disabled:opacity-50">
          <IconX size={13} /> Ahora no
        </button>
      </div>
    </div>
  )
}
