import i18n from '../i18n'
import { Preferences } from '@capacitor/preferences'
import { api } from '../store/appStore'

const SETTINGS_KEY = 'studyai-mobile-notif-settings'

export const DEFAULT_SETTINGS = {
  enabled: true,
  daysBeforeList: [1, 3, 7],
  notifHour: 9,
}

export async function getNotifSettings() {
  try {
    const { value } = await Preferences.get({ key: SETTINGS_KEY })
    if (!value) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(value) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export async function saveNotifSettings(settings) {
  await Preferences.set({ key: SETTINGS_KEY, value: JSON.stringify(settings) })
}

// Con las dos apps instaladas, los avisos de examen los lleva MyStudy App:
// Scan (desdeApp=false) pregunta al servidor y, si la App se ha usado hace
// poco, cancela los suyos para que el mismo examen no avise dos veces.
export async function scheduleExamNotifications(exams, { desdeApp = false } = {}) {
  let LocalNotifications
  try {
    const mod = await import('@capacitor/local-notifications')
    LocalNotifications = mod.LocalNotifications
  } catch {
    return
  }

  try {
    if (!desdeApp) {
      const me = await api('GET', '/me').catch(() => null)
      if (me?.avisos_en_app) { await _cancelExamNotifs(LocalNotifications); return }
    }
    const settings = await getNotifSettings()
    if (!settings.enabled) {
      await _cancelExamNotifs(LocalNotifications)
      return
    }

    const perm = await LocalNotifications.requestPermissions()
    if (perm.display !== 'granted') return

    // Canal de Android
    if (LocalNotifications.createChannel) {
      await LocalNotifications.createChannel({
        id: 'exam-reminders',
        name: i18n.t('mobile.exams.channel'),
        importance: 4,
        sound: 'default',
        vibration: true,
      }).catch(() => {})
    }

    await _cancelExamNotifs(LocalNotifications)

    const now = new Date()
    const notifications = []
    let idCounter = 1000

    for (const exam of exams) {
      const examDate = new Date(exam.exam_date)
      for (const daysBefore of settings.daysBeforeList) {
        const notifDate = new Date(examDate)
        notifDate.setDate(notifDate.getDate() - daysBefore)
        notifDate.setHours(settings.notifHour, 0, 0, 0)
        if (notifDate > now) {
          const label = daysBefore === 0 ? i18n.t('mobile.exams.notifToday')
                      : daysBefore === 1 ? i18n.t('mobile.exams.notifTomorrow')
                      : i18n.t('mobile.exams.notifInDays', { count: daysBefore })
          notifications.push({
            id: idCounter++,
            title: '📅 ' + i18n.t('mobile.exams.notifTitle'),
            body: `${exam.title} — ${label}`,
            schedule: { at: notifDate, allowWhileIdle: true },
            // Sin alarma exacta: si no, Android abre "Alarmas y recordatorios"
            // para pedir un permiso que estos avisos no necesitan.
            isExactNotification: false,
            channelId: 'exam-reminders',
          })
        }
      }
    }

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications })
    }
  } catch (e) {
    console.warn('[notif] Error scheduling:', e)
  }
}

export async function cancelAllExamNotifications() {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await _cancelExamNotifs(LocalNotifications)
  } catch {}
}

async function _cancelExamNotifs(LocalNotifications) {
  const pending = await LocalNotifications.getPending()
  const toCancel = (pending.notifications || []).filter(n => n.id >= 1000 && n.id < 9000)
  if (toCancel.length > 0) {
    await LocalNotifications.cancel({ notifications: toCancel })
  }
}
