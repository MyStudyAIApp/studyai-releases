import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Logo from '../components/UI/Logo'

// Incrusta el documento real de iubenda en NUESTRO dominio (en vez de enlazar
// directo a iubenda.com) para que la URL que damos a Play Store / la app
// nunca dependa de que sigamos pagando iubenda: si algún día se deja el
// servicio, solo hay que sustituir el <a class="iubenda-embed"> de abajo por
// texto estático, sin tocar ningún enlace externo (Play Console, footer, etc.).
const DOCS = {
  terms: {
    url: 'https://www.iubenda.com/condiciones-de-uso/88689564',
    titleKey: 'landing.legal.termsTitle',
  },
  privacy: {
    url: 'https://www.iubenda.com/privacy-policy/88689564',
    titleKey: 'landing.legal.privacyTitle',
  },
}

export default function LegalPlaceholderPage({ docKey }) {
  const { t } = useTranslation()
  const doc = DOCS[docKey]

  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://cdn.iubenda.com/iubenda.js'
    script.async = true
    document.body.appendChild(script)
    return () => { document.body.removeChild(script) }
  }, [])

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center p-4">
      <div className="w-full max-w-3xl">
        <div className="text-center my-6">
          <Link to="/"><Logo size="lg" className="justify-center" /></Link>
        </div>

        <div className="bg-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl">
          <a href={doc.url} className="iubenda-embed" title={t(doc.titleKey)}>
            {t(doc.titleKey)}
          </a>
        </div>

        <div className="text-center my-6">
          <Link to="/" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
            {t('landing.legal.backHome')}
          </Link>
        </div>
      </div>
    </div>
  )
}
