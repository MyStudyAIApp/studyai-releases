import { useTranslation } from 'react-i18next'
import { IS_MOBILE } from '../../store/appStore'

// Icono de una app de MyStudy en la cabecera. Dentro de una app (Scan ⇄ App):
// si la otra está instalada la abre; si no, abre su ficha de Play (AppLauncher
// con el enlace https de Play resuelve a la app Play Store). En la web abre la
// ficha en una pestaña.
const APPS = {
  scan: { pkg: 'eu.mystudyai.scan', icono: '/icono-scan.png', nombre: 'MyStudy Scan' },
  app:  { pkg: 'eu.mystudyai.twa',  icono: '/icono-app.png',  nombre: 'MyStudy App' },
}

export default function OtraAppBoton({ destino, grande }) {
  const { t } = useTranslation()
  const { pkg, icono, nombre } = APPS[destino]
  const play = `https://play.google.com/store/apps/details?id=${pkg}`
  const titulo = IS_MOBILE ? nombre : t('otraApp.descargar', { nombre })

  const abrir = async () => {
    if (IS_MOBILE) {
      try {
        const { AppLauncher } = await import('@capacitor/app-launcher')
        if ((await AppLauncher.openUrl({ url: pkg })).completed) return
        await AppLauncher.openUrl({ url: play })
        return
      } catch {}
    }
    window.open(play, '_blank', 'noopener')
  }

  return (
    <button onClick={abrir} aria-label={titulo} title={titulo} className="shrink-0 p-1 active:scale-95">
      <img src={icono} alt="" className={grande ? 'w-10 h-10 rounded-xl' : 'w-7 h-7 rounded-lg'} />
    </button>
  )
}
