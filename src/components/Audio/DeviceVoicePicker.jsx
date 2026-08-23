import { useEffect, useState } from 'react'
import { useAppStore, IS_MOBILE } from '../../store/appStore'
import { cargarVoces, hablar, parar, abrirInstalacionDeVoces } from '../../lib/deviceTts'

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

const IDIOMAS = [
  { code: 'es', flag: '🇪🇸', label: 'Español' },
  { code: 'en', flag: '🇬🇧', label: 'English' },
  { code: 'fr', flag: '🇫🇷', label: 'Français' },
  { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
  { code: 'it', flag: '🇮🇹', label: 'Italiano' },
  { code: 'pt', flag: '🇵🇹', label: 'Português' },
]

const MUESTRA = {
  es: 'Así sonarán tus apuntes leídos en voz alta.',
  en: 'This is how your notes will sound when read aloud.',
  fr: 'Voici comment vos notes seront lues à voix haute.',
  de: 'So klingen deine Notizen, wenn sie vorgelesen werden.',
  it: 'Ecco come suoneranno i tuoi appunti letti ad alta voce.',
  pt: 'É assim que os seus apontamentos vão soar em voz alta.',
}

export default function DeviceVoicePicker() {
  const { ttsVoicesPerLang, setTtsVoiceForLang, ttsRate } = useAppStore()
  const [voces, setVoces] = useState(null)   // null = todavía cargando
  const [probando, setProbando] = useState(null)

  useEffect(() => {
    let vivo = true
    cargarVoces().then(v => { if (vivo) setVoces(v) })
    return () => { vivo = false; parar() }
  }, [])

  async function probar(voz, code) {
    parar()
    setProbando(voz.name)
    try {
      await hablar(MUESTRA[code] || MUESTRA.es, { lang: voz.lang, voz, rate: ttsRate })
    } catch { /* el usuario paró, o el aparato no pudo */ }
    setProbando(null)
  }

  if (voces === null) {
    return <p className="text-sm text-slate-400">Buscando las voces de tu dispositivo…</p>
  }

  if (!voces.length) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-amber-300">
          Tu dispositivo no tiene ninguna voz instalada, así que la lectura en voz alta
          no funcionará.
        </p>
        {IS_MOBILE && (
          <button onClick={abrirInstalacionDeVoces} className="btn-secondary btn-sm">
            Instalar voces
          </button>
        )}
      </div>
    )
  }

  const porIdioma = code => voces.filter(v => v.lang.split('-')[0].toLowerCase() === code)

  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-400">
        Estas son las voces instaladas en <strong>este</strong> dispositivo. En otro
        móvil u ordenador las opciones serán distintas.
      </p>

      {IDIOMAS.map(idioma => {
        const disponibles = porIdioma(idioma.code)
        return (
          <div key={idioma.code}>
            <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-1.5">
              <span>{idioma.flag}</span> {idioma.label}
            </label>

            {!disponibles.length ? (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-slate-500">Sin voces para este idioma</span>
                {IS_MOBILE && (
                  <button onClick={abrirInstalacionDeVoces} className="text-xs text-primary-400 underline">
                    Instalar
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {disponibles.map(v => {
                  const active = ttsVoicesPerLang?.[idioma.code] === v.name
                  return (
                    <div key={v.name} className="flex items-center gap-1">
                      <button
                        onClick={() => setTtsVoiceForLang(idioma.code, v.name)}
                        className={`flex-1 min-w-0 flex items-center gap-2 px-3 py-2 rounded-lg border text-xs text-left transition-all ${
                          active
                            ? 'border-primary-500 bg-primary-900/40 text-primary-200'
                            : 'border-slate-700 bg-slate-800/40 text-slate-300 hover:border-slate-600 hover:bg-slate-700/40'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? 'bg-primary-400' : 'bg-slate-600'}`} />
                        <span className="flex-1 truncate">{v.name}</span>
                        {active && <span className="text-primary-400">✓</span>}
                      </button>
                      <button
                        onClick={() => probar(v, idioma.code)}
                        title="Escuchar esta voz"
                        className="px-2 py-2 rounded-lg border border-slate-700 bg-slate-800/40 text-xs hover:border-slate-600"
                      >
                        {probando === v.name ? '⏳' : '🔊'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
