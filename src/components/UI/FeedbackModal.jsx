import { useState } from 'react'
import { api } from '../../store/appStore'
import { useAppStore } from '../../store/appStore'
import Modal from './Modal'

const TYPES = [
  { value: 'bug',        emoji: '🐛', label: 'Encontré un error' },
  { value: 'suggestion', emoji: '💡', label: 'Tengo una sugerencia' },
  { value: 'opinion',    emoji: '💬', label: 'Quiero dar mi opinión' },
]

export default function FeedbackModal({ open, onClose, platform = 'web' }) {
  const { addToast } = useAppStore()
  const [type,       setType]       = useState('suggestion')
  const [message,    setMessage]    = useState('')
  const [replyEmail, setReplyEmail] = useState('')
  const [sending,    setSending]    = useState(false)

  async function handleSend() {
    if (!message.trim()) return
    setSending(true)
    try {
      await api('POST', '/feedback', {
        type,
        message: message.trim(),
        reply_email: replyEmail.trim() || undefined,
        platform,
      })
      addToast('¡Gracias! Tu mensaje nos ha llegado 💪', 'success')
      setMessage('')
      setReplyEmail('')
      setType('suggestion')
      onClose()
    } catch {
      addToast('No se pudo enviar. Inténtalo más tarde.', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Ayúdanos a mejorar" size="sm">
      <div className="space-y-4">

        {/* Tipo */}
        <div className="grid grid-cols-3 gap-2">
          {TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs font-medium transition-colors
                ${type === t.value
                  ? 'bg-primary-600/20 border-primary-500 text-primary-300'
                  : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}
            >
              <span className="text-xl">{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Mensaje */}
        <textarea
          className="input w-full h-32 resize-none"
          placeholder="Cuéntanos qué pasó, qué mejorarías o qué piensas..."
          value={message}
          onChange={e => setMessage(e.target.value)}
          autoFocus
        />

        {/* Email opcional */}
        <div>
          <label className="text-xs text-slate-500 block mb-1">Tu email <span className="text-slate-600">(opcional, si quieres que te respondamos)</span></label>
          <input
            type="email"
            className="input w-full"
            placeholder="tu@email.com"
            value={replyEmail}
            onChange={e => setReplyEmail(e.target.value)}
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="btn-secondary flex-1" disabled={sending}>
            Cancelar
          </button>
          <button
            onClick={handleSend}
            className="btn-primary flex-1"
            disabled={sending || !message.trim()}
          >
            {sending ? '⏳ Enviando...' : '📨 Enviar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
