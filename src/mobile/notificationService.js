import { Preferences } from '@capacitor/preferences'

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

export async function scheduleExamNotifications(exams) {
  let LocalNotifications
  try {
    const mod = await import('@capacitor/local-notifications')
    LocalNotifications = mod.LocalNotifications
  } catch {
    return
  }

  try {
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
        name: 'Recordatorios de exámenes',
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
          const label = daysBefore === 0 ? '¡es hoy!'
                      : daysBefore === 1 ? 'es mañana'
                      : `es en ${daysBefore} días`
          notifications.push({
            id: idCounter++,
            title: '📅 Recordatorio de examen',
            body: `${exam.title} — ${label}`,
            schedule: { at: notifDate, allowWhileIdle: true },
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
