import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { IconX, IconSend } from '@tabler/icons-react'
import { api } from '../../store/appStore'
import { useAuth } from '../../contexts/AuthContext'

// El buho vive siempre abajo a la derecha. La primera vez pregunta "¿como nos
// has conocido?" (botones y no texto libre: un toque y los datos salen limpios
// para /admin). Cerrar con la X se guarda como 'skip' para no volver a
// preguntar en ningun dispositivo. Despues, tocar al buho abre la ayuda.
const ORIGENES = ['instagram', 'tiktok', 'google', 'play_store', 'friend', 'teacher', 'other']
const SOPORTE = 'support@mystudyai.eu'

// "Mostrar el buho" (Ajustes). Por dispositivo, en localStorage: es una
// preferencia de pantalla, no un dato. El evento avisa al buho ya montado.
const CLAVE_OCULTO = 'owl_hidden'
const EVENTO = 'owl-visibility'
const leerOculto = () => { try { return localStorage.getItem(CLAVE_OCULTO) === '1' } catch { return false } }

export function OwlToggle({ className = '' }) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(() => !leerOculto())
  const toggle = () => {
    const next = !visible
    setVisible(next)
    try { next ? localStorage.removeItem(CLAVE_OCULTO) : localStorage.setItem(CLAVE_OCULTO, '1') } catch {}
    window.dispatchEvent(new Event(EVENTO))
  }
  return (
    <button onClick={toggle}
            className={`flex items-center gap-2 text-[11px] text-slate-400 hover:text-slate-300 transition-colors ${className}`}>
      <span className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${visible ? 'bg-primary-600' : 'bg-slate-600'}`}>
        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${visible ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
      </span>
      {t('owl.showSetting')}
    </button>
  )
}

export default function OwlWelcome({ encimaDeTabBar = false }) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const [fase, setFase] = useState(null)      // null | 'pregunta' | 'otro' | 'gracias' | 'ayuda'
  const [preguntado, setPreguntado] = useState(true)
  const [detalle, setDetalle] = useState('')
  const [oculto, setOculto] = useState(leerOculto)
  // Chat de dudas de uso (fase 'ayuda'). Se pierde al recargar: son dudas
  // sueltas, no hace falta historial.
  const [chat, setChat] = useState([])
  const [pregunta, setPregunta] = useState('')
  const [pensando, setPensando] = useState(false)
  const [quedan, setQuedan] = useState(null)
  const finChat = useRef(null)

  useEffect(() => { finChat.current?.scrollIntoView({ block: 'end' }) }, [chat, pensando])

  const preguntar = async (e) => {
    e.preventDefault()
    const q = pregunta.trim()
    if (!q || pensando) return
    const mensajes = [...chat, { role: 'user', content: q }]
    setChat(mensajes); setPregunta(''); setPensando(true)
    try {
      const r = await api('POST', '/me/help-chat', { messages: mensajes, lang: i18n.language })
      if (r.limit_reached) { setQuedan(0); setChat(c => [...c, { role: 'aviso', content: t('owl.limit') }]) }
      else { setQuedan(r.left); setChat(c => [...c, { role: 'assistant', content: r.response }]) }
    } catch {
      setChat(c => [...c, { role: 'aviso', content: t('owl.chatError') }])
    } finally { setPensando(false) }
  }

  useEffect(() => {
    const alCambiar = () => setOculto(leerOculto())
    window.addEventListener(EVENTO, alCambiar)
    return () => window.removeEventListener(EVENTO, alCambiar)
  }, [])

  useEffect(() => {
    if (!user) return
    let vivo = true
    // Unos segundos de margen: que el alumno vea la app antes de que le hablen.
    const id = setTimeout(() => {
      api('GET', '/me').then(me => {
        if (!vivo || me.heard_from_asked) return
        setPreguntado(false)
        setFase('pregunta')
      }).catch(() => {})
    }, 4000)
    return () => { vivo = false; clearTimeout(id) }
  }, [user?.id])

  const enviar = (source, detail) => {
    api('POST', '/me/heard-from', { source, detail }).catch(() => {})
    setPreguntado(true)
    if (source === 'skip') return setFase(null)
    setFase('gracias')
    setTimeout(() => setFase(f => (f === 'gracias' ? null : f)), 3500)
  }

  const cerrar = () => (fase === 'pregunta' || fase === 'otro' ? enviar('skip') : setFase(null))
  const tocarBuho = () => setFase(f => (f ? null : preguntado ? 'ayuda' : 'pregunta'))

  if (!user || oculto) return null

  const texto = { pregunta: t('owl.question'), otro: t('owl.question'),
                  gracias: t('owl.thanks'), ayuda: t('owl.help') }[fase]

  // Bocadillo de comic encima del buho, con el pico abajo apuntandole a la
  // cabeza. Azul claro a proposito, distinto del fondo oscuro de la web, para
  // que se vea que es una conversacion y no un aviso mas.
  return (
    <div className={`fixed right-3 ${encimaDeTabBar ? 'bottom-24 md:bottom-4' : 'bottom-4'} z-50 flex flex-col items-end gap-3 no-print`}>
      {fase && (
        <div className={`relative ${fase === 'ayuda' ? 'w-[min(22rem,calc(100vw-1.5rem))]' : 'w-[min(18rem,calc(100vw-1.5rem))]'} bg-sky-100 text-slate-900
                        rounded-2xl shadow-2xl p-3.5 mr-1`}>
          <span className="absolute right-5 -bottom-2 w-4 h-4 bg-sky-100 rotate-45 rounded-sm" aria-hidden />

          <div className="relative flex items-start gap-2">
            <p className="flex-1 text-sm leading-snug font-medium">
              {texto}
            </p>
            {fase !== 'gracias' && (
              <button onClick={cerrar} aria-label={t('owl.close')}
                      className="text-slate-500 hover:text-slate-900 -mt-1 -mr-1 p-1">
                <IconX size={16} />
              </button>
            )}
          </div>

          {fase === 'pregunta' && (
            <div className="relative flex flex-wrap gap-1.5 mt-3">
              {ORIGENES.map(o => (
                <button key={o}
                        onClick={() => (o === 'other' ? setFase('otro') : enviar(o))}
                        className="px-3 py-1.5 rounded-full text-xs font-medium bg-white text-sky-800
                                   border border-sky-300 hover:bg-sky-600 hover:text-white hover:border-sky-600
                                   transition-colors">
                  {t(`owl.src.${o}`)}
                </button>
              ))}
            </div>
          )}

          {fase === 'ayuda' && (
            <div className="relative mt-3">
              {chat.length > 0 && (
                <div className="max-h-[50vh] overflow-y-auto flex flex-col gap-2 mb-3 pr-1">
                  {chat.map((m, i) => (
                    <div key={i}
                         className={`text-sm leading-snug rounded-xl px-3 py-2 whitespace-pre-wrap ${
                           m.role === 'user' ? 'self-end bg-sky-600 text-white max-w-[85%]'
                                             : 'self-start bg-white text-slate-900 max-w-[95%]'}`}>
                      {m.content}
                      {m.role === 'aviso' && (
                        <> <a href={`mailto:${SOPORTE}`} className="text-sky-700 underline">{SOPORTE}</a></>
                      )}
                    </div>
                  ))}
                  {pensando && <div className="self-start text-xs text-slate-500 px-1">{t('owl.thinking')}</div>}
                  <div ref={finChat} />
                </div>
              )}
              {quedan !== 0 && (
                <form className="flex gap-2" onSubmit={preguntar}>
                  <input autoFocus value={pregunta} maxLength={500} onChange={e => setPregunta(e.target.value)}
                         placeholder={t('owl.chatPlaceholder')}
                         className="flex-1 min-w-0 bg-white border border-sky-300 rounded-xl px-3 py-1.5
                                    text-sm text-slate-900 placeholder-slate-400 focus:border-sky-600 focus:outline-none" />
                  <button type="submit" aria-label={t('owl.send')} disabled={pensando || !pregunta.trim()}
                          className="p-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-40">
                    <IconSend size={16} />
                  </button>
                </form>
              )}
              {quedan > 0 && quedan <= 3 && (
                <p className="text-[11px] text-slate-500 mt-1.5">{t('owl.left', { n: quedan })}</p>
              )}
            </div>
          )}

          {fase === 'otro' && (
            <form className="relative flex gap-2 mt-3" onSubmit={e => { e.preventDefault(); enviar('other', detalle) }}>
              <input autoFocus value={detalle} maxLength={100} onChange={e => setDetalle(e.target.value)}
                     placeholder={t('owl.otherPlaceholder')}
                     className="flex-1 min-w-0 bg-white border border-sky-300 rounded-xl px-3 py-1.5
                                text-sm text-slate-900 placeholder-slate-400 focus:border-sky-600 focus:outline-none" />
              <button type="submit" aria-label={t('owl.send')}
                      className="p-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white">
                <IconSend size={16} />
              </button>
            </form>
          )}
        </div>
      )}

      <button onClick={tocarBuho} aria-label={t('owl.open')}
              // En reposo, pequeno y medio transparente para no tapar nada; se
              // ve entero al pasar por encima o con el bocadillo abierto.
              className={`inline-flex items-center justify-center rounded-full bg-sky-100 shadow-2xl
                          transition-all ${fase ? 'w-14 h-14' : 'w-10 h-10 opacity-60 hover:opacity-100'}`}
              style={{ fontSize: fase ? 32 : 22, lineHeight: 1 }}>
        🦉
      </button>
    </div>
  )
}
