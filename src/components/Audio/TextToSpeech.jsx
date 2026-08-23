import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../../store/appStore'
import { hablar, parar, elegirVoz, hayVozEnElDispositivo } from '../../lib/deviceTts'

/**
 * TextToSpeech — lee texto en voz alta con el motor del PROPIO dispositivo.
 *
 * Antes pedía el audio a /tts/speak (Azure), que costaba dinero y consumía
 * cupo. Ahora habla el aparato: gratis, sin límite y sin enviar el texto a
 * ningún tercero. Azure se reserva para los podcasts descargables, que el
 * navegador no puede generar.
 *
 * Props:
 *   text    — cadena suelta (resúmenes, resultados)
 *   chunks  — string[] (documentos largos, se leen seguidos)
 *   label   — texto opcional del botón (por defecto solo el icono)
 *   lang    — idioma del contenido (por defecto español)
 */
export default function TextToSpeech({ text, chunks, label, lang = 'es-ES' }) {
  const { addToast, ttsVoicesPerLang, ttsRate } = useAppStore()

  const [playing, setPlaying]         = useState(false)
  const [chunkIdx, setChunkIdx]       = useState(0)
  const [totalChunks, setTotalChunks] = useState(0)
  const stoppedRef = useRef(false)

  const disponible = hayVozEnElDispositivo()

  function stop() {
    stoppedRef.current = true
    parar()
    setPlaying(false)
    setChunkIdx(0)
  }

  function getTexto() {
    if (chunks?.length) return chunks.join(' ')
    return text?.trim() || ''
  }

  async function handleClick() {
    if (playing) { stop(); return }

    const contenido = getTexto()
    if (!contenido) return

    if (!disponible) {
      addToast('Este dispositivo no tiene voz instalada para leer en voz alta', 'warning')
      return
    }

    stoppedRef.current = false
    setPlaying(true)
    try {
      const voz = await elegirVoz(lang, ttsVoicesPerLang)
      if (!voz) {
        addToast('No hay ninguna voz instalada para este idioma en tu dispositivo', 'warning')
        stop()
        return
      }
      await hablar(contenido, {
        lang,
        voz,
        rate: ttsRate,
        onProgress: (i, total) => {
          setChunkIdx(i)
          setTotalChunks(total)
        },
      })
    } catch (e) {
      if (!stoppedRef.current) addToast(e.message, 'warning')
    } finally {
      if (!stoppedRef.current) { setPlaying(false); setChunkIdx(0) }
    }
  }

  useEffect(() => () => stop(), [])

  const hayContenido = !!getTexto()
  const isMulti = totalChunks > 1
  const icon = playing ? '⏹' : '🔊'
  const tip  = !disponible ? 'Tu dispositivo no tiene voz instalada'
             : playing ? (isMulti ? `Detener (parte ${chunkIdx + 1}/${totalChunks})` : 'Detener lectura')
             : 'Leer en voz alta'

  return (
    <button
      onClick={handleClick}
      disabled={!hayContenido}
      className={`btn-secondary btn-sm text-base transition-colors flex items-center gap-1.5 ${
        playing ? 'text-primary-300 border-primary-500 bg-primary-900/20' : ''
      }`}
      title={tip}
    >
      <span>{icon}</span>
      {label && <span>{label}</span>}
      {isMulti && playing && (
        <span className="text-xs font-mono text-primary-400 ml-0.5">
          {chunkIdx + 1}/{totalChunks}
        </span>
      )}
    </button>
  )
}
