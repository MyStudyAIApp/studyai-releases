import { useTranslation } from 'react-i18next'
import Logo from '../components/UI/Logo'

export default function DeleteAccountInfoPage() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl p-8 max-w-lg w-full shadow-2xl">
        <div className="text-center mb-6">
          <Logo size="lg" className="justify-center" />
        </div>

        <h1 className="text-xl font-bold text-slate-100 mb-4 text-center">{t('deleteAccountInfo.title')}</h1>

        <p className="text-sm text-slate-300 leading-relaxed mb-4">{t('deleteAccountInfo.inApp')}</p>

        <div className="bg-slate-700/40 rounded-xl p-4 mb-4 border border-slate-600/40">
          <p className="text-sm text-slate-300 leading-relaxed mb-2">{t('deleteAccountInfo.noAppIntro')}</p>
          <p className="text-sm text-slate-300">
            {t('deleteAccountInfo.emailLabel')}{' '}
            <a href="mailto:support@mystudyai.eu?subject=Solicitud%20de%20borrado%20de%20cuenta"
              className="text-primary-400 hover:text-primary-300 underline font-medium">
              support@mystudyai.eu
            </a>
          </p>
          <p className="text-xs text-slate-500 mt-2">{t('deleteAccountInfo.emailFromAccount')}</p>
        </div>

        <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wide">{t('deleteAccountInfo.whatGetsDeleted')}</p>
        <ul className="text-xs text-slate-400 list-disc list-inside space-y-1 mb-4">
          <li>{t('deleteAccountInfo.deletedDocs')}</li>
          <li>{t('deleteAccountInfo.deletedFlashcards')}</li>
          <li>{t('deleteAccountInfo.deletedAccount')}</li>
        </ul>

        <p className="text-xs text-slate-600 text-center">{t('deleteAccountInfo.responseTime')}</p>
      </div>
    </div>
  )
}
