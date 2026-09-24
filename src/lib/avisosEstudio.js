import i18n from '../i18n'
import { api } from '../store/appStore'

// Avisos de estudio de MyStudy App (locales: se programan en el propio móvil,
// sin servidor). Reglas acordadas el 23/9/2026:
//  - repaso:   la asignatura con más fichas por repasar (siempre UNA)
//  - examen:   un examen de práctica que se dejó a medias (una sola vez)
//  - inactivo: uno solo si pasa una semana sin abrir la app
//  - máx. 1 al día y 2 por semana, nunca de 21:00 a 9:00,
//    y se para del todo tras 2 avisos ignorados (volver a activar un tipo en
//    Ajustes lo reanuda).
// Se reprograma todo cada vez que se abre o se vuelve a la app: lo pendiente se
// cancela y se decide de nuevo con los datos del momento.

const CLAVE = 'avisos_estudio'
const CLAVE_EXAMEN = 'avisos_examen_a_medias'
const CLAVE_TOCADO = 'avisos_tocado'
const CANAL = 'study-reminders'
// Los recordatorios de fecha de examen del escáner usan 1000-8999.
const ID_BASE = 9100
export const TIPOS = ['repaso', 'examen', 'inactivo']
const RUTA = { repaso: '/study', examen: '/exam', inactivo: '/home' }
const DIA = 24 * 60 * 60 * 1000

const leer = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def } catch { return def } }
const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

function estado() {
  const s = leer(CLAVE, {})
  return {
    tipos: { repaso: true, examen: true, inactivo: true, ...(s.tipos || {}) },
    programados: s.programados || [],   // [{id, at, tipo}]
    disparados: s.disparados || [],     // marcas de tiempo de los que ya saltaron
    ignorados: s.ignorados || 0,
  }
}

export const leerTipos = () => estado().tipos

export function guardarTipo(tipo, activo) {
  const s = estado()
  s.tipos[tipo] = activo
  if (activo) s.ignorados = 0          // volver a activarlo reanuda los avisos
  escribir(CLAVE, s)
  programarAvisos()
}

// Lo llama el examen tipo test: al contestar la primera pregunta y al terminar.
export function marcarExamenAMedias(doc) {
  // Sin el prefijo interno de los cuadernos ("[Cuaderno] "), que no es para el alumno
  if (doc?.id) escribir(CLAVE_EXAMEN, { id: doc.id, titulo: (doc.title || '').replace(/^\[[^\]]+\]\s*/, '') })
}
export function limpiarExamenAMedias() {
  try { localStorage.removeItem(CLAVE_EXAMEN) } catch {}
}

async function plugin() {
  if (!window.Capacitor?.isNativePlatform?.()) return null
  // Envuelto en un objeto: devolver el plugin tal cual desde una async hace que
  // JS le llame a .then() y Capacitor lanza "not implemented".
  try { return { LN: (await import('@capacitor/local-notifications')).LocalNotifications } } catch { return null }
}

// Una sola vez por arranque: saber si abrieron la app tocando un aviso y
// llevarles a su pantalla. El plugin guarda el evento hasta que alguien
// escucha, así que llega aunque el aviso haya arrancado la app.
let escuchando = false
async function escuchar(LN) {
  if (escuchando) return
  escuchando = true
  await LN.addListener('localNotificationActionPerformed', ({ notification }) => {
    const n = notification?.id
    if (n < ID_BASE || n >= ID_BASE + 100) return
    try { localStorage.setItem(CLAVE_TOCADO, '1') } catch {}
    const ruta = notification.extra?.ruta
    if (ruta) window.location.hash = '#' + ruta
    programarAvisos()
  })
}

// Hora del día a la que sale un aviso (siempre dentro de 9:00-21:00).
function aLas(base, dias, hora) {
  const d = new Date(base.getTime() + dias * DIA)
  d.setHours(hora, 0, 0, 0)
  return d
}
const mismoDia = (a, b) => new Date(a).toDateString() === new Date(b).toDateString()

// Pura, para poder probarla: con los candidatos por prioridad y lo que ya
// saltó, decide cuáles se programan respetando 1 al día y 2 por semana.
export function elegir(candidatos, disparados, ahora) {
  const semana = disparados.filter(t => ahora - t < 7 * DIA)
  const elegidos = []
  for (const c of candidatos) {
    if (semana.length + elegidos.length >= 2) break
    let at = c.at
    // Mismo día que otro: se pasa al siguiente, a la misma hora.
    while ([...semana, ...elegidos.map(e => e.at)].some(t => mismoDia(t, at))) at = at + DIA
    elegidos.push({ ...c, at })
  }
  return elegidos
}

export async function programarAvisos() {
  const { LN } = (await plugin()) || {}
  if (!LN) return
  try {
    await escuchar(LN)
    const s = estado()
    const ahora = Date.now()

    // Lo que ya saltó desde la última vez: ¿lo tocaron o lo ignoraron?
    const saltados = s.programados.filter(p => p.at <= ahora)
    if (saltados.length) {
      const tocado = localStorage.getItem(CLAVE_TOCADO) === '1'
      s.ignorados = tocado ? 0 : s.ignorados + saltados.length
      s.disparados = [...s.disparados, ...saltados.map(p => p.at)]
      if (saltados.some(p => p.tipo === 'examen')) limpiarExamenAMedias()   // una sola vez
    }
    try { localStorage.removeItem(CLAVE_TOCADO) } catch {}
    s.disparados = s.disparados.filter(t => ahora - t < 7 * DIA)

    const pendientes = (await LN.getPending()).notifications || []
    const nuestros = pendientes.filter(n => n.id >= ID_BASE && n.id < ID_BASE + 100)
    if (nuestros.length) await LN.cancel({ notifications: nuestros.map(n => ({ id: n.id })) })
    s.programados = []

    const algunoActivo = TIPOS.some(t => s.tipos[t])
    if (!algunoActivo || s.ignorados >= 2) return escribir(CLAVE, s)

    let permiso = (await LN.checkPermissions()).display
    if (permiso === 'prompt' || permiso === 'prompt-with-rationale') {
      permiso = (await LN.requestPermissions()).display
    }
    if (permiso !== 'granted') return escribir(CLAVE, s)

    await LN.createChannel?.({
      id: CANAL, name: i18n.t('avisos.canal'), importance: 3, vibration: true,
    }).catch(() => {})

    // Candidatos, de más a menos importante.
    const hoy = new Date(ahora)
    const candidatos = []
    const examen = leer(CLAVE_EXAMEN, null)
    if (s.tipos.examen && examen) {
      // /exam/:id lleva al documento de ese examen, listo para hacerlo de nuevo
      candidatos.push({ tipo: 'examen', ruta: `/exam/${examen.id}`, at: aLas(hoy, 1, 17).getTime(),
        title: i18n.t('avisos.examenTitulo'), body: i18n.t('avisos.examenTexto', { titulo: examen.titulo }) })
    }
    if (s.tipos.repaso) {
      const r = await api('GET', '/flashcards/due').catch(() => null)
      const porAsignatura = {}
      for (const c of r?.cards || []) {
        const a = c.subject_name || c.document_title || ''
        if (a) porAsignatura[a] = (porAsignatura[a] || 0) + 1
      }
      const [asignatura, n] = Object.entries(porAsignatura).sort((a, b) => b[1] - a[1])[0] || []
      if (asignatura) {
        candidatos.push({ tipo: 'repaso', at: aLas(hoy, 1, 18).getTime(),
          title: i18n.t('avisos.repasoTitulo'), body: i18n.t('avisos.repasoTexto', { count: n, asignatura }) })
      }
    }
    if (s.tipos.inactivo) {
      candidatos.push({ tipo: 'inactivo', at: aLas(hoy, 7, 18).getTime(),
        title: i18n.t('avisos.inactivoTitulo'), body: i18n.t('avisos.inactivoTexto') })
    }

    const elegidos = elegir(candidatos, s.disparados, ahora)
    // Solo para probar en un móvil (se pone a mano por depuración): los avisos
    // elegidos saltan dentro de 1, 2... minutos en vez de mañana.
    if (localStorage.getItem('avisos_prueba') === '1') elegidos.forEach((e, i) => { e.at = ahora + (i + 1) * 60000 })
    if (elegidos.length) {
      await LN.schedule({ notifications: elegidos.map((e, i) => ({
        id: ID_BASE + i,
        title: e.title,
        body: e.body,
        schedule: { at: new Date(e.at), allowWhileIdle: true },
        // Sin alarma exacta: si no, Android abre la pantalla "Alarmas y
        // recordatorios" para pedir el permiso. Unos minutos de margen dan igual.
        isExactNotification: false,
        channelId: CANAL,
        extra: { ruta: e.ruta || RUTA[e.tipo] },
      })) })
    }
    s.programados = elegidos.map((e, i) => ({ id: ID_BASE + i, at: e.at, tipo: e.tipo }))
    escribir(CLAVE, s)
  } catch (e) {
    console.warn('[avisos] no se pudieron programar:', e)
  }
}
