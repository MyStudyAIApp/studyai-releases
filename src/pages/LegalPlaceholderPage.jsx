import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import Logo from '../components/UI/Logo'

// Texto legal auto-alojado (ya no depende de iubenda). Extraido el 2026-08-17
// desde los documentos que teniamos publicados en iubenda para conservar el
// contenido exacto ya redactado para mystudyai.eu. Si cambia un proveedor,
// una funcion que trate datos, o cualquier otro dato relevante, hay que
// editar el .md correspondiente en src/legal/<doc>/<idioma>.md a mano.
const DOCS = {
  terms: {
    files: import.meta.glob('../legal/terms/*.md', { as: 'raw', eager: true }),
    titleKey: 'landing.legal.termsTitle',
  },
  privacy: {
    files: import.meta.glob('../legal/privacy/*.md', { as: 'raw', eager: true }),
    titleKey: 'landing.legal.privacyTitle',
  },
  cookies: {
    files: import.meta.glob('../legal/cookies/*.md', { as: 'raw', eager: true }),
    titleKey: 'landing.legal.cookiesTitle',
  },
}

export default function LegalPlaceholderPage({ docKey }) {
  const { t, i18n } = useTranslation()
  const doc = DOCS[docKey]

  const lang = i18n.language?.split('-')[0] || 'es'
  const path = Object.keys(doc.files).find((p) => p.endsWith(`/${lang}.md`))
    ?? Object.keys(doc.files).find((p) => p.endsWith('/es.md'))
  const content = doc.files[path]

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center p-4">
      <div className="w-full max-w-3xl">
        <div className="text-center my-6">
          <Link to="/"><Logo size="lg" className="justify-center" /></Link>
        </div>

        <div className="bg-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl prose prose-invert prose-slate max-w-none prose-headings:text-white prose-a:text-primary-400">
          <h1 className="!mt-0">{t(doc.titleKey)}</h1>
          <ReactMarkdown>{content}</ReactMarkdown>
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
