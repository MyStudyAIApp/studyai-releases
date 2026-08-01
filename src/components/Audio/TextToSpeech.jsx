import { useState, useRef, useEffect } from 'react'
import { useAppStore, getAuthHeader, getLocalAuthHeader } from '../../store/appStore'

/**
 * TextToSpeech — plays text or a list of text chunks in sequence.
 *
 * Props:
 *   text    — single string (for summaries/results)
 *   chunks  — string[] (for full documents, auto-advances)
 *   label   — optional button label (default: emoji only)
 */
export default function TextToSpeech({ text, chunks, label }) {
  const { apiBase, addToast, ttsVoicesPerLang, ttsRate } = useAppStore()

  const [playing, setPlaying]         = useState(false)
  const [loading, setLoading]         = useState(false)
  const [chunkIdx, setChunkIdx]       = useState(0)
  const [totalChunks, setTotalChunks] = useState(0)
  const audioRef = useRef(null)
  const stoppedRef = useRef(false)   // true when user manually stopped

  // Build the list of chunks to play
  function getChunks() {
    if (chunks?.length) return chunks
    if (text?.trim())   return [text]
    return []
  }

  // Stop and reset everything
  function stop() {
    stoppedRef.current = true
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setPlaying(false)
    setLoading(false)
    setChunkIdx(0)
  }

  // Fetch audio for one chunk and play it, then auto-advance
  async function playChunk(allChunks, idx) {
    if (stoppedRef.current || idx >= allChunks.length) {
      setPlaying(false)
      setLoading(false)
      setChunkIdx(0)
      return
    }
    setChunkIdx(idx)
    setLoading(true)
    try {
      const authHeader = await getAuthHeader()
      const localHeader = await getLocalAuthHeader()
      const res = await fetch(`${apiBase}/tts/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader, ...localHeader },
        body: JSON.stringify({
          text: allChunks[idx],
          voices_per_lang: ttsVoicesPerLang,
          rate: ttsRate,
        }),
      })
      if (!res.ok) throw new Error('TTS no disponible')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = new Audio(url)
      audioRef.current = a
      setLoading(false)
      setPlaying(true)
      a.onended = () => {
        if (!stoppedRef.current) playChunk(allChunks, idx + 1)
      }
      a.onerror = () => {
        addToast('Error reproduciendo audio', 'error')
        stop()
      }
      a.play()
    } catch (e) {
      addToast(e.message, 'warning')
      stop()
    }
  }

  async function handleClick() {
    if (playing || loading) { stop(); return }
    const all = getChunks()
    if (!all.length) return
    stoppedRef.current = false
    setTotalChunks(all.length)
    setChunkIdx(0)
    playChunk(all, 0)
  }

  // Clean up on unmount
  useEffect(() => () => stop(), [])

  const all    = getChunks()
  const isMulti = all.length > 1
  const icon   = loading ? '⏳' : playing ? '⏹' : '🔊'
  const tip    = loading ? 'Cargando audio...'
               : playing ? (isMulti ? `Detener (parte ${chunkIdx + 1}/${totalChunks})` : 'Detener lectura')
               : 'Leer en voz alta'

  return (
    <button
      onClick={handleClick}
      disabled={!all.length}
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
