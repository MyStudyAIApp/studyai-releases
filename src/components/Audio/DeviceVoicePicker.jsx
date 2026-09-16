import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'
import { useEffect, useState } from 'react'
import { useAppStore, IS_MOBILE } from '../../store/appStore'
import { cargarVoces, hablar, parar, abrirInstalacionDeVoces, motivoSinVoces, rutaAjustesVoz } from '../../lib/deviceTts'

/**
 * Elige la voz con la que el DISPOSITIVO lee en voz alta, por idioma.
 *
 * No hay catálogo fijo: se pregunta al aparato qué voces tiene instaladas, así
 * que cada usuario ve las suyas. Si no tiene ninguna de un idioma, se le dice
 * y —en el móvil— se le ofrece instalarla.
 *
 * La voz de los podcasts NO se elige aquí: esa la genera Azure en el servidor
 * y tiene su propio selector.
 */

// Solo para poner bandera y nombre bonito a los idiomas más habituales. La
// LISTA que se muestra NO sale de aquí: sale de lo que el aparato dice tener
// instalado, que en un móvil suelen ser muchos más. Tenerla fija dejaba fuera
// idiomas que sí funcionaban (el usuario tenía árabe hablando en Idiomas y no
// le aparecía en Ajustes).
const CONOCIDOS = [
  { code: 'es', flag: '🇪🇸', label: 'Español' },
  { code: 'en', flag: '🇬🇧', label: 'English' },
  { code: 'fr', flag: '🇫🇷', label: 'Français' },
  { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
  { code: 'it', flag: '🇮🇹', label: 'Italiano' },
  { code: 'pt', flag: '🇵🇹', label: 'Português' },
  { code: 'ca', flag: '🏴', label: 'Català' },
  { code: 'eu', flag: '🏴', label: 'Euskara' },
  { code: 'gl', flag: '🏴', label: 'Galego' },
  { code: 'ar', flag: '🇸🇦', label: 'العربية' },
  { code: 'ru', flag: '🇷🇺', label: 'Русский' },
  { code: 'zh', flag: '🇨🇳', label: '中文' },
  { code: 'ja', flag: '🇯🇵', label: '日本語' },
  { code: 'ko', flag: '🇰🇷', label: '한국어' },
  { code: 'pl', flag: '🇵🇱', label: 'Polski' },
  { code: 'nl', flag: '🇳🇱', label: 'Nederlands' },
  { code: 'tr', flag: '🇹🇷', label: 'Türkçe' },
  { code: 'hi', flag: '🇮🇳', label: 'हिन्दी' },
  { code: 'sv', flag: '🇸🇪', label: 'Svenska' },
  { code: 'da', flag: '🇩🇰', label: 'Dansk' },
  { code: 'nb', flag: '🇳🇴', label: 'Norsk' },
  { code: 'fi', flag: '🇫🇮', label: 'Suomi' },
  { code: 'cs', flag: '🇨🇿', label: 'Čeština' },
  { code: 'sk', flag: '🇸🇰', label: 'Slovenčina' },
  { code: 'el', flag: '🇬🇷', label: 'Ελληνικά' },
  { code: 'he', flag: '🇮🇱', label: 'עברית' },
  { code: 'hu', flag: '🇭🇺', label: 'Magyar' },
  { code: 'ro', flag: '🇷🇴', label: 'Română' },
  { code: 'uk', flag: '🇺🇦', label: 'Українська' },
  { code: 'bg', flag: '🇧🇬', label: 'Български' },
  { code: 'hr', flag: '🇭🇷', label: 'Hrvatski' },
  { code: 'id', flag: '🇮🇩', label: 'Bahasa Indonesia' },
  { code: 'th', flag: '🇹🇭', label: 'ไทย' },
  { code: 'vi', flag: '🇻🇳', label: 'Tiếng Việt' },
  { code: 'bn', flag: '🇧🇩', label: 'বাংলা' },
  { code: 'ta', flag: '🇮🇳', label: 'தமிழ்' },
  { code: 'ur', flag: '🇵🇰', label: 'اردو' },
  { code: 'fa', flag: '🇮🇷', label: 'فارسی' },
  { code: 'sr', flag: '🇷🇸', label: 'Српски' },
  { code: 'ms', flag: '🇲🇾', label: 'Bahasa Melayu' },
  { code: 'fil', flag: '🇵🇭', label: 'Filipino' },
  { code: 'sw', flag: '🇰🇪', label: 'Kiswahili' },
]

function nombreDeIdiomaLocal(code) {
  try {
    return new Intl.DisplayNames(['es'], { type: 'language' }).of(code) || code
  } catch {
    return code
  }
}

const MUESTRA = {
  es: 'Así sonarán tus apuntes leídos en voz alta.',
  en: 'This is how your notes will sound when read aloud.',
  fr: 'Voici comment vos notes seront lues à voix haute.',
  de: 'So klingen deine Notizen, wenn sie vorgelesen werden.',
  it: 'Ecco come suoneranno i tuoi appunti letti ad alta voce.',
  pt: 'É assim que os seus apontamentos vão soar em voz alta.',
}

export default function DeviceVoicePicker() {
  useTranslation() // re-render al cambiar de idioma
  const { ttsVoicesPerLang, setTtsVoiceForLang, ttsRate, addToast } = useAppStore()
  const [voces, setVoces] = useState(null)   // null = todavía cargando
  const [probando, setProbando] = useState(null)
  // Un solo idioma a la vista. Con seis bloques abiertos a la vez la pantalla
  // de Ajustes se volvía ilegible, y casi nadie configura más de uno.
  const [idioma, setIdioma] = useState('es')

  useEffect(() => {
    let vivo = true
    cargarVoces().then(v => { if (vivo) setVoces(v) })
    return () => { vivo = false; parar() }
  }, [])

  async function instalar() {
    const abrio = await abrirInstalacionDeVoces()
    if (!abrio) {
      addToast(i18n.t('tts.cantOpen', { path: rutaAjustesVoz() }), 'info', 9000)
    }
  }

  async function probar(voz, code) {
    parar()
    setProbando(voz.name)
    try {
      await hablar(MUESTRA[code] || MUESTRA.es, { lang: voz.lang, voz, rate: ttsRate })
    } catch { /* el usuario paró, o el aparato no pudo */ }
    setProbando(null)
  }

  if (voces === null) {
    return <p className="text-sm text-slate-400">{i18n.t('voices.searching')}</p>
  }

  if (!voces.length) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-amber-300">
          {i18n.t('voices.none')}
        </p>
        {/* El motivo tecnico ayuda a distinguir "no hay voces" de "el motor no
            respondio", que se arreglan de formas muy distintas. */}
        {motivoSinVoces && (
          <p className="text-xs text-slate-500">{i18n.t('voices.detail')}: {motivoSinVoces}</p>
        )}
        {IS_MOBILE && (
          <button onClick={instalar} className="btn-secondary btn-sm">
            {i18n.t('voices.install')}
          </button>
        )}
      </div>
    )
  }

  // Los idiomas que este aparato puede pronunciar. Primero los conocidos (con
  // bandera), luego el resto por orden alfabético.
  const codigos = [...new Set(voces.map(v => (v.lang || '').split('-')[0].toLowerCase()).filter(Boolean))]
  const IDIOMAS = codigos
    .map(code => CONOCIDOS.find(c => c.code === code) || { code, flag: '🌐', label: nombreDeIdiomaLocal(code) })
    .sort((a, b) => {
      const ca = CONOCIDOS.some(c => c.code === a.code) ? 0 : 1
      const cb = CONOCIDOS.some(c => c.code === b.code) ? 0 : 1
      return ca - cb || a.label.localeCompare(b.label)
    })

  const disponibles = voces.filter(v => (v.lang || '').split('-')[0].toLowerCase() === idioma)
  // La que está guardada en Ajustes, o la primera si aún no eligió ninguna.
  const elegida = disponibles.find(v => v.name === ttsVoicesPerLang?.[idioma]) || disponibles[0] || null
  const conVoces = new Set(voces.map(v => v.lang.split('-')[0].toLowerCase()))

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={idioma}
          onChange={e => setIdioma(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
        >
          {IDIOMAS.map(i => (
            <option key={i.code} value={i.code}>
              {i.flag} {i.label}{conVoces.has(i.code) ? '' : ` — ${i18n.t('voices.noVoices')}`}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-500">
          {i18n.t('voices.installedOn')} <strong>{i18n.t('voices.this')}</strong> {i18n.t('voices.device')}
        </span>
      </div>

      {!disponibles.length ? (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-amber-300">
            {i18n.t('voices.noneForLang')}
          </span>
          {IS_MOBILE && (
            <button onClick={instalar} className="text-xs text-primary-400 underline">
              {i18n.t('voices.install')}
            </button>
          )}
        </div>
      ) : (
        // Un desplegable, no una rejilla de botones: el motor de Android expone
        // cientos de voces (una por variante regional) y pintarlas todas dejaba
        // la pantalla inservible.
        <div className="flex items-center gap-2">
          <select
            value={elegida?.name || ''}
            onChange={e => setTtsVoiceForLang(idioma, e.target.value)}
            className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
          >
            {disponibles.map(v => (
              <option key={`${v.name}|${v.lang}`} value={v.name}>
                {v.name}{v.lang && !v.name.includes(v.lang) ? ` · ${v.lang}` : ''}
              </option>
            ))}
          </select>
          <button
            onClick={() => elegida && probar(elegida, idioma)}
            title={i18n.t('voices.listen')}
            className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/40 text-sm hover:border-slate-600 shrink-0"
          >
            {probando ? '⏳' : '🔊'}
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        {!!disponibles.length && (
          <p className="text-xs text-slate-500">
            {i18n.t('voices.available', { count: disponibles.length })}
          </p>
        )}
        {/* Siempre visible en el móvil, no solo cuando falta un idioma: quien
            ya los tiene todos no podía llegar nunca a esta pantalla. */}
        {IS_MOBILE && (
          <button onClick={instalar} className="text-xs text-primary-400 underline">
            {i18n.t('voices.installMore')}
          </button>
        )}
      </div>
    </div>
  )
}
