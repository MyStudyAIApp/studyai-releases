import i18n from '../i18n'
import { IS_ELECTRON, IS_MOBILE } from '../store/appStore'

// Plataforma actual, usada para el aviso de borrado automático (PDFs en
// Biblioteca, ejercicios en Resolver) -- el archivo descargado solo vive en
// el dispositivo donde se pulsó "Descargar", así que el aviso solo debe
// ocultarse del todo cuando coincide con la plataforma desde la que se mira.
// Mismos valores que CLIENT_PLATFORM (appStore.js) y current_platform_ctx en
// el backend -- se guarda tal cual en documents.downloaded_platform.
export const CURRENT_PLATFORM = IS_ELECTRON ? 'desktop' : IS_MOBILE ? 'mobile' : 'web'

export function platformLabel(platform) {
  if (platform === 'desktop') return i18n.t('retention.desktop')
  if (platform === 'mobile') return i18n.t('retention.mobile')
  return i18n.t('retention.web')
}

// Días que quedan hasta el borrado automático (10 días desde created_at,
// tanto para el archivo original de un PDF/foto como para un ejercicio
// resuelto -- mismo esquema en el backend, ver EXERCISE_RETENTION_DAYS y
// DELETE_AFTER_DAYS en web_main.py).
export function diasParaBorrar(createdAt, retentionDays = 10) {
  const expiresAt = new Date(createdAt).getTime() + retentionDays * 24 * 60 * 60 * 1000
  const ms = expiresAt - Date.now()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}
