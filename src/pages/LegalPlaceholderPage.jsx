import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Logo from '../components/UI/Logo'

export default function LegalPlaceholderPage({ docKey }) {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl p-8 max-w-lg w-full shadow-2xl">
        <div className="text-center mb-6">
          <Link to="/"><Logo size="lg" className="justify-center" /></Link>
        </div>

        <h1 className="text-xl font-bold text-slate-100 mb-4 text-center">
          {t(`landing.legal.${docKey}Title`)}
        </h1>

        <p className="text-sm text-slate-300 leading-relaxed text-center mb-4">
          {t('landing.legal.inPreparation')}
        </p>

        <p className="text-sm text-slate-300 text-center">
          <a href="mailto:support@mystudyai.eu"
            className="text-primary-400 hover:text-primary-300 underline font-medium">
            support@mystudyai.eu
          </a>
        </p>

        <div className="text-center mt-6">
          <Link to="/" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
            {t('landing.legal.backHome')}
          </Link>
        </div>
      </div>
    </div>
  )
}
