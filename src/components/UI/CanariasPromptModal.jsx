/** Pregunta la región fiscal justo antes de pagar, si todavía no se conoce
 * (cuenta antigua, o registrada antes de que existiera este dato). */
export default function CanariasPromptModal({ onAnswer, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <h3 className="text-lg font-semibold text-slate-100 mb-2">Antes de pagar...</h3>
        <p className="text-sm text-slate-400 mb-5">
          ¿Dónde resides? Lo necesitamos para aplicarte el impuesto correcto.
        </p>
        <div className="space-y-2">
          <button
            onClick={() => onAnswer('resto')}
            className="w-full bg-primary-600 hover:bg-primary-500 text-white font-semibold py-2.5 rounded-xl transition-all"
          >
            Resto de España / extranjero
          </button>
          <button
            onClick={() => onAnswer('canarias')}
            className="w-full bg-slate-700 hover:bg-slate-600 text-slate-100 font-semibold py-2.5 rounded-xl transition-all"
          >
            Canarias
          </button>
          <button
            onClick={() => onAnswer('ceuta_melilla')}
            className="w-full bg-slate-700 hover:bg-slate-600 text-slate-100 font-semibold py-2.5 rounded-xl transition-all"
          >
            Ceuta o Melilla
          </button>
        </div>
        <button onClick={onClose} className="w-full text-slate-500 hover:text-slate-300 text-xs mt-4">
          Cancelar
        </button>
      </div>
    </div>
  )
}
