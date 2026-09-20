import { useState, useEffect, useRef } from 'react'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Preferences } from '@capacitor/preferences'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { verFuncion } from '../lib/betaFlags'
import { api, useAppStore } from '../store/appStore'
import { useDocumentScan } from './useDocumentScan'
import { subirEscaneo, suscribir, pasarASegundoPlano, olvidarTrabajo } from './scanUpload'
import { useTranslation } from 'react-i18next'
import {
  IconArrowLeft, IconCamera, IconPackage, IconCircleCheck, IconPencil, IconBooks,
  IconFolder, IconLoader2, IconRefresh, IconFileText, IconAlertTriangle,
  IconWriting, IconNotebook, IconBell,
} from '@tabler/icons-react'

// Dónde se persiste el escaneo ANTES de intentar subirlo, en almacenamiento
// propio de la app (Directory.Data) — no en la caché de ML Kit, que Android
// puede borrar en cualquier momento, ni solo en memoria de React, que se
// pierde si el usuario navega fuera de la pantalla o la app se cierra.
const PENDING_META_KEY      = 'pending_scan_meta'
const PENDING_PREVIEW_PATH  = 'pending_scan_preview.jpg'
const PENDING_PDF_PATH      = 'pending_scan.pdf'
// Una por pagina escaneada. Antes solo se guardaba la PRIMERA (la vista previa)
// y el resto vivia dentro del PDF de ML Kit; ahora se suben de una en una, asi
// que hay que poder recuperarlas todas.
const PENDING_PAGE_PREFIX   = 'pending_scan_page_'
const MAX_PAGINAS           = 25   // el mismo pageLimit que se le pide al escaner

async function limpiarPendiente() {
  await Preferences.remove({ key: PENDING_META_KEY })
  try { await Filesystem.deleteFile({ path: PENDING_PREVIEW_PATH, directory: Directory.Data }) } catch { /* no existía */ }
  try { await Filesystem.deleteFile({ path: PENDING_PDF_PATH, directory: Directory.Data }) } catch { /* no existía */ }
  for (let i = 0; i < MAX_PAGINAS; i++) {
    try { await Filesystem.deleteFile({ path: `${PENDING_PAGE_PREFIX}${i}.jpg`, directory: Directory.Data }) } catch { /* no existía */ }
  }
}

export default function MobileScannerPage() {
  const [previewB64, setPreviewB64] = useState(null)  // JPEG en base64 para mostrar
  const [paginasB64, setPaginasB64] = useState([])    // TODAS las paginas, en orden
  const [progreso, setProgreso]     = useState(null)  // lo que reporta scanUpload
  // Ya no se elige: todo pasa por el mismo OCR ('handwritten'), sea impreso o a mano
  const [contentType, setContentType] = useState(
    new URLSearchParams(window.location.hash.split('?')[1] || '').get('modo') === 'cuaderno'
      ? 'handwritten' : null,
  )  // null hasta que elige; 'handwritten' es el unico valor real que queda
  const [docName, setDocName]       = useState('')
  const [loading, setLoading]       = useState(false)
  const [subjects, setSubjects]     = useState([])
  const [subjectId, setSubjectId]   = useState('')
  const [topics, setTopics]         = useState([])
  const [topicId, setTopicId]       = useState('')
  const [pendienteRevisado, setPendienteRevisado] = useState(false)
  const { scan: docScan, installing, installProgress } = useDocumentScan()
  const { addToast }                = useAppStore()
  const { user }                    = useAuth()
  const [params]                    = useSearchParams()
  // 'cuaderno': en vez de crear un documento suelto, la transcripcion se SUMA
  // al cuaderno de esa asignatura bajo la fecha de hoy. Se puede llegar aqui
  // desde el acceso rapido del inicio (?modo=cuaderno) o eligiendolo abajo.
  const [modoCuaderno, setModoCuaderno] = useState(params.get('modo') === 'cuaderno')
  const verCuaderno                 = verFuncion('cuaderno', user)
  const navigate                    = useNavigate()
  const { t, i18n }                 = useTranslation()

  // Cargar asignaturas solo una vez, no bloquea el escaneo si falla
  useEffect(() => {
    api('GET', '/subjects').then(res => setSubjects(res.items || [])).catch(() => {})
  }, [])

  // Al elegir asignatura, cargar sus temas (si tiene alguno)
  useEffect(() => {
    setTopicId('')
    if (!subjectId) { setTopics([]); return }
    api('GET', `/subjects/${subjectId}/topics`)
      .then(res => setTopics(res.items || []))
      .catch(() => setTopics([]))
  }, [subjectId])

  // Para no cerrar dos veces el mismo trabajo: el efecto que lo cierra se
  // dispara con cada aviso de scanUpload, y navegar dos veces da un parpadeo.
  const cerrado = useRef(true)

  // Desde el inicio el alumno ya ha dicho lo que quiere ("Escanear apuntes" o
  // "Mi cuaderno"), asi que aqui no se le vuelve a preguntar: se abre la camara
  // directamente. Solo se espera a saber si hay un escaneo a medias, para no
  // pisarlo. Si cancela la camara, queda la pantalla con el boton de reintentar.
  const yaAbierto = useRef(false)
  useEffect(() => {
    if (yaAbierto.current || pendienteRevisado === false) return
    if (previewB64 || installing) return
    yaAbierto.current = true
    scan()
  }, [pendienteRevisado, previewB64, installing])

  // Al abrir la pantalla, comprobar si quedó un escaneo sin guardar de una
  // sesión anterior (subida fallida, cierre inesperado de la app, etc.) y
  // recuperarlo en vez de perderlo silenciosamente.
  useEffect(() => {
    (async () => {
      try {
        const { value } = await Preferences.get({ key: PENDING_META_KEY })
        if (!value) return   // el `finally` marca que ya se ha revisado
        const meta = JSON.parse(value)

        const preview = await Filesystem.readFile({ path: PENDING_PREVIEW_PATH, directory: Directory.Data })
        setPreviewB64(preview.data)
        setDocName(meta.docName || '')
        setContentType(meta.contentType || 'handwritten')

        // Recuperar todas las paginas. Si una no esta (escaneo de una version
        // anterior, que solo guardaba la primera), se sigue con las que haya:
        // mejor recuperar media libreta que ninguna.
        const b64s = []
        for (let i = 0; i < (meta.paginas || 1); i++) {
          try {
            const f = await Filesystem.readFile({ path: `${PENDING_PAGE_PREFIX}${i}.jpg`, directory: Directory.Data })
            b64s.push(f.data)
          } catch { /* esa pagina ya no esta */ }
        }
        setPaginasB64(b64s.length ? b64s : [preview.data])
        addToast(t('mobile.scanner.recovered'), 'info', 5000)
      } catch {
        // Metadata huérfana sin archivos detrás — limpiar por si acaso
        await limpiarPendiente().catch(() => {})
      } finally {
        setPendienteRevisado(true)
      }
    })()
  }, [])

  const scan = async () => {
    try {
      const result = await docScan({
        pageLimit: 25,
        galleryImportAllowed: true,
        // Solo JPEG: el PDF ya no se usa (cada pagina se sube por separado y
        // reescalada). Pedirlo era hacerle generar y guardar un archivo mas
        // que nadie lee.
        resultFormats: 'JPEG',
        scannerMode: 'FULL',
      })
      if (result) await handleScanResult(result)
    } catch (err) {
      if (!err.message?.includes('cancel') && !err.message?.includes('Cancel')) {
        addToast(t('mobile.scanner.openFailed'), 'error')
      }
    }
  }

  const handleScanResult = async (result) => {
    // TODAS las paginas, no solo la primera. Antes solo se guardaba la vista
    // previa y el resto viajaba dentro del PDF de ML Kit; ahora cada pagina se
    // sube por separado (ver scanUpload.subirEscaneo), asi que hacen falta
    // todas, y persistidas antes de intentar nada: si la subida falla o la app
    // se cierra, el escaneo sigue recuperable.
    const imagenes = result.scannedImages || []
    const b64s = []
    for (let i = 0; i < imagenes.length && i < MAX_PAGINAS; i++) {
      const { data } = await Filesystem.readFile({ path: imagenes[i] })
      await Filesystem.writeFile({ path: `${PENDING_PAGE_PREFIX}${i}.jpg`, data, directory: Directory.Data })
      b64s.push(data)
    }
    if (!b64s.length) return

    // La primera hace de vista previa, igual que antes.
    await Filesystem.writeFile({ path: PENDING_PREVIEW_PATH, data: b64s[0], directory: Directory.Data })

    await Preferences.set({
      key: PENDING_META_KEY,
      value: JSON.stringify({ docName: '', paginas: b64s.length, contentType, savedAt: Date.now() }),
    })

    setPaginasB64(b64s)
    setPreviewB64(b64s[0])
  }

  const chooseAndScan = (type) => {
    setContentType(type)
    scan()
  }

  // Mientras haya un trabajo vivo (o recien acabado) la pantalla lo refleja,
  // aunque el alumno haya salido y vuelto: el estado vive en scanUpload, no
  // aqui. Eso es lo que hace posible "Avisame".
  useEffect(() => suscribir(setProgreso), [])

  // Cuando el trabajo termina estando la pantalla abierta, se cierra aqui:
  // avisar, limpiar lo pendiente y salir. Si estaba en segundo plano, de eso
  // ya se encarga la notificacion.
  useEffect(() => {
    if (!progreso?.terminado || cerrado.current) return
    cerrado.current = true
    ;(async () => {
      if (progreso.guardadas > 0) await limpiarPendiente().catch(() => {})
      if (progreso.error) {
        addToast(
          progreso.guardadas > 0
            ? t('mobile.scanner.partial', { done: progreso.guardadas, total: progreso.total })
            : t('mobile.scanner.uploadFailed'),
          progreso.guardadas > 0 ? 'warning' : 'error', 7000,
        )
      } else {
        addToast(modoCuaderno
          ? t('mobile.scanner.addedNotebook')
          : t('mobile.scanner.savedLibrary'), 'success')
        const cal = progreso.primerResultado?.calidad
        if (cal?.pobre) addToast(cal.motivo, 'warning', 7000)
      }
      setLoading(false)
      olvidarTrabajo()
      if (progreso.guardadas > 0) navigate('/')
    })()
  }, [progreso?.terminado])

  const guardar = async () => {
    if (!paginasB64.length) return
    // En modo cuaderno la asignatura no es opcional: es donde se suman los
    // apuntes. Sin ella el backend responderia 400 y el alumno perderia el
    // escaneo sin entender por que.
    if (modoCuaderno && !subjectId && !topicId) {
      return addToast(t('mobile.scanner.pickSubject'), 'info', 4000)
    }
    setLoading(true)
    cerrado.current = false
    const now = new Date()
    const fecha = now.toLocaleDateString(i18n.language)
    const hora  = now.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })
    const nombre = docName.trim() || `${t('mobile.scanner.defaultName')} ${fecha} ${hora}`

    // Guardar el nombre elegido en la metadata persistida — si la subida
    // falla, el proximo intento recupera tambien el nombre que escribio.
    try {
      await Preferences.set({
        key: PENDING_META_KEY,
        value: JSON.stringify({ docName, paginas: paginasB64.length, contentType, savedAt: Date.now() }),
      })
    } catch { /* no critico */ }

    // No se espera aqui a proposito: si el alumno pulsa "Avisame" y navega
    // fuera, este componente se desmonta pero el trabajo sigue vivo en
    // scanUpload y acaba igual.
    subirEscaneo(paginasB64, {
      topicId, subjectId, modoCuaderno, nombre,
      contentType: contentType || 'handwritten',
    })
  }

  const avisarme = () => {
    pasarASegundoPlano()
    addToast(t('mobile.scanner.willNotify'), 'info', 5000)
    navigate('/')
  }


  const descartar = async () => {
    await limpiarPendiente().catch(() => {})
    setPreviewB64(null)
    setPaginasB64([])
    setDocName('')
    setSubjectId('')
    setTopicId('')
    setContentType(null)
  }

  const salir = async () => {
    if (previewB64 && !window.confirm(t('mobile.scanner.confirmExit'))) return
    // Si ha confirmado, se borra de verdad. Antes solo se navegaba fuera y el
    // escaneo seguia guardado en Directory.Data, asi que reaparecia cada vez
    // que volvia a entrar. La recuperacion es para cuando la app se cierra
    // sola o falla la subida, no para cuando el alumno dice que lo descarta.
    if (previewB64) await limpiarPendiente().catch(() => {})
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Cabecera */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-5">
        <button onClick={salir} className="text-slate-400 p-1"><IconArrowLeft size={22} /></button>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2"><IconCamera size={20} /> {t('mobile.home.scanTitle')}</h1>
      </div>

      <div className="flex-1 flex flex-col px-5 gap-5">

        {/* Descargando módulo ML Kit */}
        {installing && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5">
            <IconPackage size={36} className="text-slate-500 animate-bounce" />
            <p className="text-slate-300 font-semibold text-center">
              {t('mobile.scanner.preparing')}
            </p>
            <p className="text-slate-500 text-sm text-center">{t('mobile.scanner.firstTimeOnly')}</p>
            <div className="w-full bg-slate-700 rounded-full h-3">
              <div
                className="bg-primary-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${installProgress}%` }}
              />
            </div>
            <p className="text-slate-400 text-sm">{installProgress}%</p>
          </div>
        )}

        {/* Vista previa del documento escaneado */}
        {!installing && previewB64 && (
          <>
            <div className="rounded-2xl overflow-hidden border border-slate-700 shadow-lg bg-slate-800">
              <img
                src={`data:image/jpeg;base64,${previewB64}`}
                alt={t('mobile.scanner.scannedDoc')}
                className="w-full object-contain max-h-[50vh]"
              />
            </div>

            <div className="bg-slate-800 rounded-2xl px-4 py-3 flex items-center gap-3 border border-slate-700">
              <IconPencil size={16} className="text-slate-400 shrink-0" />
              <input
                type="text"
                value={docName}
                onChange={e => setDocName(e.target.value)}
                placeholder={(() => { const n = new Date(); return `${t('mobile.scanner.defaultName')} ${n.toLocaleDateString(i18n.language)} ${n.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}` })()}
                disabled={loading}
                className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 outline-none text-sm"
              />
            </div>

            {subjects.length > 0 && (
              <div className="bg-slate-800 rounded-2xl px-4 py-3 flex items-center gap-3 border border-slate-700">
                <IconBooks size={16} className="text-slate-400 shrink-0" />
                <select
                  value={subjectId}
                  onChange={e => setSubjectId(e.target.value)}
                  disabled={loading}
                  className="flex-1 bg-transparent text-slate-100 outline-none text-sm"
                >
                  <option value="" className="bg-slate-800">{t('common.noSubject')}</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id} className="bg-slate-800">{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            {subjectId && topics.length > 0 && (
              <div className="bg-slate-800 rounded-2xl px-4 py-3 flex items-center gap-3 border border-slate-700">
                <IconFolder size={16} className="text-slate-400 shrink-0" />
                <select
                  value={topicId}
                  onChange={e => setTopicId(e.target.value)}
                  disabled={loading}
                  className="flex-1 bg-transparent text-slate-100 outline-none text-sm"
                >
                  <option value="" className="bg-slate-800">{t('home.uploadModal.topicLoose')}</option>
                  {topics.map(topic => (
                    <option key={topic.id} value={topic.id} className="bg-slate-800">{topic.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Por donde va. La queja de fondo del usuario que reporto esto no
                era solo que tardase, sino que no sabia CUANTO faltaba. */}
            {loading && progreso && !progreso.terminado && (
              <div className="bg-slate-800 rounded-2xl px-4 py-4 border border-slate-700 space-y-3">
                <p className="text-sm text-slate-200 font-medium flex items-center gap-2">
                  <IconLoader2 size={16} className="animate-spin text-primary-400 shrink-0" />
                  {t(progreso.fase === 'reescalando'
                    ? 'mobile.scanner.progressResizing'
                    : 'mobile.scanner.progressUploading',
                    { actual: progreso.actual, total: progreso.total })}
                </p>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                    style={{
                      // Dos fases en una sola barra: reescalar es la primera
                      // mitad y subir la segunda. Dos barras separadas darian
                      // la sensacion de empezar de cero a mitad de camino.
                      width: `${((progreso.fase === 'subiendo' ? 0.5 : 0) +
                                 (progreso.actual / Math.max(progreso.total, 1)) * 0.5) * 100}%`,
                    }}
                  />
                </div>
                <button
                  onClick={avisarme}
                  className="w-full py-3 rounded-xl bg-slate-700 text-slate-200 text-sm font-medium
                             active:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                >
                  <IconBell size={16} /> {t('mobile.scanner.notifyMe')}
                </button>
                <p className="text-xs text-slate-500 text-center">{t('mobile.scanner.notifyMeHint')}</p>
              </div>
            )}

            {!loading && (
              <>
                <button
                  onClick={guardar}
                  className="w-full py-5 rounded-2xl bg-primary-600 text-white font-bold text-lg
                             active:bg-primary-700 transition-colors"
                >
                  <span className="flex items-center justify-center gap-2">
                    <IconCircleCheck size={18} /> {modoCuaderno ? t('mobile.scanner.addToNotebook') : t('mobile.scanner.saveToLibrary')}
                    {paginasB64.length > 1 && (
                      <span className="text-primary-200 text-sm font-normal">
                        ({t('mobile.scanner.pageCount', { count: paginasB64.length })})
                      </span>
                    )}
                  </span>
                </button>
                <button
                  onClick={descartar}
                  className="w-full py-4 rounded-2xl bg-slate-700 text-slate-300 font-medium
                             active:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                >
                  <IconRefresh size={16} /> {t('mobile.scanner.scanAgain')}
                </button>
              </>
            )}
          </>
        )}

        {/* Respaldo: solo se ve si cancela la camara o quiere repetir */}
        {!installing && !previewB64 && (
          <>
            <div className="flex-1 flex items-center justify-center">
              <div className="w-full h-52 rounded-2xl border-2 border-dashed border-slate-600
                              flex flex-col items-center justify-center gap-3 text-slate-500">
                <IconFileText size={44} />
                <span className="text-sm text-center px-4">
                  {t('mobile.scanner.placeSheet')}
                </span>
              </div>
            </div>

            <p className="flex items-center justify-center gap-1.5 text-xs text-amber-500/80 text-center px-4">
              <IconAlertTriangle size={14} className="shrink-0" /> {t('mobile.scanner.sensitive')}
            </p>

            <button
              onClick={scan}
              className="w-full py-6 rounded-2xl bg-primary-600 text-white font-bold text-xl
                         active:bg-primary-700 transition-colors flex items-center justify-center gap-3 shadow-lg"
            >
              <IconCamera size={28} /> {t('mobile.scanner.scanDocument')}
            </button>
          </>
        )}
      </div>

      <p className="text-center text-xs text-slate-600 py-5 px-6">
        {t('mobile.scanner.edgesInfo')}
      </p>
    </div>
  )
}
