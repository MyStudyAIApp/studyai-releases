import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import katex from 'katex'
import { api, apiUpload, useAppStore, UPLOAD_TIMEOUT_OCR_MS } from '../store/appStore'
import { escanearPaginas } from '../lib/escanerDocumentos'
import { prepararTexto, resolverDuda, contarDudas, transformarUrl } from '../lib/dudas'
import { textoAHtml, htmlATexto } from '../lib/formato'
import DudaModal from '../components/DudaModal'
import {
  IconNotebook, IconCamera, IconPlus, IconLoader2, IconFolder,
  IconBooks, IconCalendar, IconChevronDown, IconChevronRight,
  IconPrinter, IconFileTypeDoc, IconCheck, IconX,
  IconPencil, IconBold, IconItalic, IconUnderline, IconStrikethrough,
  IconH1, IconH2, IconList, IconDeviceFloppy,
} from '@tabler/icons-react'

/**
 * Cuaderno de apuntes: el alumno fotografia la pagina de su libreta y se SUMA
 * al cuaderno de esa asignatura, bajo la fecha del dia.
 *
 * La foto no se guarda: se transcribe y se tira. Lo que queda es el texto, y
 * al abrir el cuaderno se abre como un documento normal (/document/:id), asi
 * que el resumen, las flashcards y el examen ya funcionan sobre el sin tener
 * que reimplementar nada.
 *
 * La asignatura y el tema los elige SIEMPRE el alumno, nunca se deducen: una
 * asignatura mal adivinada le desordena el curso entero.
 */
export default function NotebookPage() {
  useTranslation() // re-render al cambiar de idioma
  const [cuadernos, setCuadernos]   = useState([])
  const [subjects, setSubjects]     = useState([])
  const [topics, setTopics]         = useState([])
  const [subjectId, setSubjectId]   = useState('')
  const [topicId, setTopicId]       = useState('')
  const [cargando, setCargando]     = useState(true)
  const [subiendo, setSubiendo]     = useState(false)
  const [abierto, setAbierto]       = useState(null)   // id del cuaderno desplegado
  const [entradas, setEntradas]     = useState({})     // id -> [{date, text}]
  const fileRef = useRef(null)
  // Duda abierta: {cuaderno, fecha, indice, palabra}. Solo puede haber una.
  const [duda, setDuda] = useState(null)
  const [guardando, setGuardando] = useState(false)
  // Apunte que se esta editando: {cuaderno, fecha}. Tambien uno solo a la vez.
  const [editando, setEditando] = useState(null)
  const { addToast } = useAppStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [creandoEjemplo, setCreandoEjemplo] = useState(false)

  const cargar = async () => {
    try {
      const [nb, subj] = await Promise.all([api('GET', '/notebooks'), api('GET', '/subjects')])
      setCuadernos(nb.items || [])
      let lista = subj.items || []
      // Usuario nuevo sin asignaturas: se le crea "General" para que pueda
      // hacer la foto ya, sin tener que descubrir antes el "+".
      if (lista.length === 0) {
        try {
          lista = [await api('POST', '/subjects', { name: i18n.t('notebook.generalSubject'), color: '#6366f1' })]
        } catch { /* sin asignatura se queda como antes: la crea a mano */ }
      }
      setSubjects(lista)
      if (lista.length === 1) setSubjectId(lista[0].id)
    } catch {
      addToast('No se pudieron cargar tus cuadernos', 'error')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  // Copia en su cuenta el cuaderno de ejemplo y lo abre. Llega aqui desde el
  // cartel de bienvenida (state.ejemplo) o desde el cuaderno vacio.
  const probarEjemplo = async () => {
    setCreandoEjemplo(true)
    try {
      const r = await api('POST', '/notebooks/sample')
      navigate(`/document/${r.notebook_id}`)
    } catch {
      addToast(i18n.t('notebook.sampleError'), 'error')
      setCreandoEjemplo(false)
    }
  }
  useEffect(() => {
    if (location.state?.ejemplo) probarEjemplo()
  }, [])

  // Los temas dependen de la asignatura elegida — mismo comportamiento que en
  // la Biblioteca y en el escaner del movil.
  useEffect(() => {
    setTopicId('')
    if (!subjectId) { setTopics([]); return }
    api('GET', `/subjects/${subjectId}/topics`)
      .then(r => setTopics(r.items || []))
      .catch(() => setTopics([]))
  }, [subjectId])

  const crearAsignatura = async () => {
    const nombre = window.prompt('Nombre de la asignatura nueva')
    if (!nombre?.trim()) return
    try {
      const s = await api('POST', '/subjects', { name: nombre.trim(), color: '#6366f1' })
      setSubjects(prev => [...prev, s])
      setSubjectId(s.id)
    } catch {
      addToast('No se pudo crear la asignatura', 'error')
    }
  }

  const crearTema = async () => {
    if (!subjectId) return addToast('Elige antes la asignatura', 'info')
    const nombre = window.prompt('Nombre del tema nuevo')
    if (!nombre?.trim()) return
    try {
      const t = await api('POST', `/subjects/${subjectId}/topics`, { name: nombre.trim() })
      setTopics(prev => [...prev, t])
      setTopicId(t.id)
    } catch {
      addToast('No se pudo crear el tema', 'error')
    }
  }

  const subir = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''                       // permite repetir la misma foto
    if (file) await subirPaginas([file])
  }

  // En MyStudy App se usa el escáner de documentos de Google (el mismo de
  // Scan); en la web, el selector/cámara del navegador.
  const hacerFoto = async () => {
    try {
      const paginas = await escanearPaginas()
      if (paginas === null) return fileRef.current?.click()
      if (paginas.length) await subirPaginas(paginas)
    } catch {
      fileRef.current?.click()
    }
  }

  // Cada página se suma al cuaderno de hoy (el servidor las junta por fecha).
  const subirPaginas = async (files) => {
    if (!subjectId) return addToast('Elige la asignatura antes de escanear', 'info')

    setSubiendo(true)
    try {
      for (const file of files) await subirUna(file)
      setEntradas({})   // forzar recarga
      await cargar()
    } catch (err) {
      // 403 con quota_exceeded lo traduce el interceptor de appStore; aqui solo
      // hace falta que el alumno sepa que sus apuntes NO se guardaron.
      addToast(err?.message || i18n.t('notebook.saveError'), 'error', 6000)
    } finally {
      setSubiendo(false)
    }
  }

  const subirUna = async (file) => {
    const form = new FormData()
    form.append('file', file)
    if (topicId) form.append('topic_id', topicId)
    else form.append('subject_id', subjectId)
    form.append('content_type', 'handwritten')

    const r = await apiUpload('/notebooks/append', form, null, UPLOAD_TIMEOUT_OCR_MS)
    addToast(
      r.created
        ? i18n.t('notebook.created', { name: r.title.replace('[Cuaderno] ', '') })
        : i18n.t('notebook.added', { name: r.title.replace('[Cuaderno] ', '') }),
      'success',
    )
  }

  const recargarEntradas = async (id) => {
    try {
      const d = await api('GET', `/notebooks/${id}`)
      setEntradas(prev => ({ ...prev, [id]: d.entries || [] }))
    } catch {
      addToast('No se pudo abrir el cuaderno', 'error')
    }
  }

  const desplegar = async (id) => {
    if (abierto === id) return setAbierto(null)
    setAbierto(id)
    if (entradas[id]) return
    await recargarEntradas(id)
  }

  // Guarda el texto de UN dia. Lo usan las DOS formas de editar que hay:
  // corregir una palabra dudosa y reescribir el apunte entero en el editor.
  // Estar en un solo sitio es lo que evita que una de las dos se quede sin la
  // proteccion del 409 al cambiar algo aqui.
  //
  // `esperado` es el texto que el alumno tenia delante. Si en el servidor ya
  // no es ese —entro un escaneo nuevo del mismo dia, u otra pestana— el
  // servidor rechaza la edicion en vez de pisar lo que hubiera, y aqui se
  // recarga para que no siga escribiendo sobre una version vieja.
  const guardarTexto = async (cuaderno, fechaEntrada, nuevo, esperado) => {
    setGuardando(true)
    try {
      await api('PATCH', `/notebooks/${cuaderno}/entries/${fechaEntrada}`,
                { text: nuevo, esperado })
      setEntradas(prev => ({
        ...prev,
        [cuaderno]: prev[cuaderno].map(
          e => e.date === fechaEntrada ? { ...e, text: nuevo } : e),
      }))
      return true
    } catch (err) {
      addToast(err?.message || i18n.t('notebook.saveChangesError'), 'error', 5000)
      if (String(err?.message || '').includes('cambiado')) await recargarEntradas(cuaderno)
      return false
    } finally {
      setGuardando(false)
    }
  }

  // Confirmar o corregir UNA palabra dudosa.
  const resolver = async (palabraNueva) => {
    if (!duda) return
    const entrada = (entradas[duda.cuaderno] || []).find(e => e.date === duda.fecha)
    if (!entrada) return setDuda(null)

    const nuevo = resolverDuda(entrada.text, duda.indice, palabraNueva)
    if (nuevo === entrada.text) return setDuda(null)

    await guardarTexto(duda.cuaderno, duda.fecha, nuevo, entrada.text)
    setDuda(null)
  }

  // Guardar el apunte reescrito en el editor. Se cierra solo si se guardo:
  // si el servidor lo rechazo, el alumno se queda con su texto delante.
  const guardarEdicion = async (texto, original) => {
    if (!editando) return
    if (texto.trim() === original.trim()) return setEditando(null)
    const ok = await guardarTexto(editando.cuaderno, editando.fecha, texto.trim(), original)
    if (ok) {
      setEditando(null)
      addToast(i18n.t('notebook.saved'), 'success')
    }
  }

  const fecha = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString(i18n.language, {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  // Los apuntes en un solo documento, para llevarlos al papel o a Word. Se
  // arma aqui y no en el servidor porque el texto ya esta descargado: no hace
  // falta pedir nada ni gastar cupo por imprimir lo que el alumno ya tiene.
  // El fichero de Word usa la MISMA conversion que el editor (lib/formato):
  // sin ella el alumno abria su apunte en Word y veia los asteriscos en crudo,
  // y teniendo dos conversiones distintas acabarian pintando cosas distintas.
  const comoHtml = (c) => {
    const dias = (entradas[c.id] || [])
      .map(e => `<h2>${fecha(e.date)}</h2>${textoAHtml(e.text)}`)
      .join('')
    return `<html><head><meta charset="utf-8"><title>${c.title}</title></head>
      <body style="font-family:Georgia,serif;line-height:1.6;max-width:800px;margin:auto">
      <h1>${c.title}</h1>
      <p style="color:#666">${c.subject_name}${c.topic_name ? ' — ' + c.topic_name : ''}</p>
      ${dias}</body></html>`
  }

  // Un solo boton para imprimir Y para guardar en PDF: el dialogo de
  // impresion del navegador ya trae "Guardar como PDF" en los tres sistemas.
  // Montar un generador de PDF propio seria mucho codigo para lo mismo.
  const imprimir = (c) => {
    // `print-target` y `no-print` salen de src/styles/print.css, que ya carga
    // main.jsx para toda la app: oculta lo demas, pone A4 con margenes, la
    // tipografia y los colores en claro sobre el tema oscuro. Reutilizarlo
    // evita tener dos hojas de impresion distintas que se van separando.
    const el = document.getElementById(`cuaderno-${c.id}`)
    el?.classList.add('print-target')
    const limpiar = () => {
      el?.classList.remove('print-target')
      window.removeEventListener('afterprint', limpiar)
    }
    window.addEventListener('afterprint', limpiar)
    window.print()
  }

  // Word abre HTML sin rechistar si el fichero se llama .doc; es la via mas
  // corta que conserva titulos y saltos de pagina, sin meter una libreria.
  const descargarWord = (c) => {
    const blob = new Blob(['\ufeff', comoHtml(c)], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${c.title}.doc`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  // Agrupar por asignatura para que se lea como su horario, no como una lista
  const porAsignatura = cuadernos.reduce((acc, c) => {
    const clave = c.subject_name || i18n.t('common.noSubject')
    ;(acc[clave] = acc[clave] || []).push(c)
    return acc
  }, {})

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2 mb-1">
        <IconNotebook size={24} className="text-primary-400" /> {i18n.t('sidebar.notebook')}
      </h1>
      <p className="text-slate-400 text-sm mb-6">
        {i18n.t('notebook.intro')}
      </p>

      {/* Añadir apuntes */}
      <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700 mb-8">
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <div className="flex items-center gap-2 bg-slate-900 rounded-xl px-3 py-2.5 border border-slate-700">
            <IconBooks size={16} className="text-slate-400 shrink-0" />
            {subjectId && (
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: subjects.find(s => s.id === subjectId)?.color }}
              />
            )}
            <select
              value={subjectId}
              onChange={e => setSubjectId(e.target.value)}
              disabled={subiendo}
              className="flex-1 bg-transparent text-slate-100 outline-none text-sm"
            >
              <option value="" className="bg-slate-900">{i18n.t('notebook.pickSubject')}</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id} className="bg-slate-900">{s.name}</option>
              ))}
            </select>
            <button
              onClick={crearAsignatura}
              title={i18n.t('notebook.newSubject')}
              className="text-slate-500 hover:text-primary-400 shrink-0"
            >
              <IconPlus size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2 bg-slate-900 rounded-xl px-3 py-2.5 border border-slate-700">
            <IconFolder size={16} className="text-slate-400 shrink-0" />
            <select
              value={topicId}
              onChange={e => setTopicId(e.target.value)}
              disabled={subiendo || !subjectId}
              className="flex-1 bg-transparent text-slate-100 outline-none text-sm disabled:opacity-40"
            >
              <option value="" className="bg-slate-900">{i18n.t('notebook.noTopic')}</option>
              {topics.map(t => (
                <option key={t.id} value={t.id} className="bg-slate-900">{t.name}</option>
              ))}
            </select>
            <button
              onClick={crearTema}
              title={i18n.t('notebook.newTopic')}
              className="text-slate-500 hover:text-primary-400 shrink-0 disabled:opacity-30"
              disabled={!subjectId}
            >
              <IconPlus size={16} />
            </button>
          </div>
        </div>

        {/* capture="environment" abre la camara directamente en el movil y el
            explorador de archivos en el ordenador — sin librerias ni permisos. */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          onChange={subir}
          className="hidden"
        />
        <button
          onClick={hacerFoto}
          disabled={subiendo || !subjectId}
          className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-500
                     disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold
                     rounded-xl py-3 transition-colors"
        >
          {subiendo
            ? <><IconLoader2 size={18} className="animate-spin" /> {i18n.t('notebook.reading')}</>
            : <><IconCamera size={18} /> {i18n.t('notebook.addPage')}</>}
        </button>
        {subiendo && (
          <p className="text-center text-xs text-slate-500 mt-2">
            {i18n.t('notebook.wait')}
          </p>
        )}
      </div>

      {/* Lista de cuadernos */}
      {cargando ? (
        <div className="flex justify-center py-12">
          <IconLoader2 size={28} className="animate-spin text-slate-600" />
        </div>
      ) : cuadernos.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <IconNotebook size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{i18n.t('notebook.empty')}</p>
          <button onClick={probarEjemplo} disabled={creandoEjemplo}
            className="mt-4 px-4 py-2 rounded-xl bg-slate-800 border border-slate-600 hover:border-primary-500 text-slate-200 text-sm font-semibold disabled:opacity-50">
            {creandoEjemplo ? <IconLoader2 size={16} className="inline animate-spin" /> : i18n.t('welcome.sampleCta')}
          </button>
        </div>
      ) : (
        Object.entries(porAsignatura).map(([asignatura, lista]) => (
          <div key={asignatura} className="mb-6">
            <div className="flex items-center gap-2 mb-2 px-1">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: lista[0].color || '#64748b' }}
              />
              <h2 className="text-sm font-semibold text-slate-300">{asignatura}</h2>
            </div>

            {lista.map(c => (
              <div key={c.id} id={`cuaderno-${c.id}`}
                   className="bg-slate-800 rounded-xl border border-slate-700 mb-2 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => desplegar(c.id)} className="no-print text-slate-500 shrink-0">
                    {abierto === c.id ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                  </button>
                  <button onClick={() => desplegar(c.id)} className="flex-1 text-left min-w-0">
                    <p className="text-slate-100 text-sm font-medium truncate">{c.title}</p>
                    <p className="text-slate-500 text-xs flex items-center gap-1.5 mt-0.5">
                      <IconCalendar size={12} />
                      {i18n.t('mobile.settings.days', { count: c.entries })}
                      {c.last_date && <> · {i18n.t('notebook.last')}: {fecha(c.last_date)}</>}
                    </p>
                  </button>
                  {abierto === c.id && entradas[c.id]?.length > 0 && (
                    <>
                      <button
                        onClick={() => imprimir(c)}
                        title={i18n.t('notebook.print')}
                        className="no-print shrink-0 p-1.5 text-slate-500 hover:text-primary-400 transition-colors"
                      >
                        <IconPrinter size={16} />
                      </button>
                      <button
                        onClick={() => descargarWord(c)}
                        title={i18n.t('notebook.word')}
                        className="no-print shrink-0 p-1.5 text-slate-500 hover:text-primary-400 transition-colors"
                      >
                        <IconFileTypeDoc size={16} />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => navigate(`/document/${c.id}`)}
                    className="no-print shrink-0 text-xs text-primary-400 hover:text-primary-300 px-2 py-1"
                  >
                    {i18n.t('notebook.study')}
                  </button>
                </div>

                {abierto === c.id && (
                  <div className="border-t border-slate-700 px-4 py-3 space-y-4">
                    {entradas[c.id] == null ? (
                      <IconLoader2 size={18} className="animate-spin text-slate-600 mx-auto" />
                    ) : entradas[c.id].map(e => (
                      <div key={e.date}>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs font-semibold text-primary-400">{fecha(e.date)}</p>
                          {!(editando?.cuaderno === c.id && editando?.fecha === e.date) && (
                            <button
                              onClick={() => setEditando({ cuaderno: c.id, fecha: e.date })}
                              title={i18n.t('notebook.edit')}
                              className="no-print text-slate-500 hover:text-primary-400 p-0.5 transition-colors"
                            >
                              <IconPencil size={14} />
                            </button>
                          )}
                        </div>

                        {editando?.cuaderno === c.id && editando?.fecha === e.date ? (
                          <EditorApunte
                            texto={e.text}
                            guardando={guardando}
                            onGuardar={t => guardarEdicion(t, e.text)}
                            onCancelar={() => setEditando(null)}
                          />
                        ) : (
                        <>
                        {contarDudas(e.text) > 0 && (
                          <p className="no-print text-xs text-amber-400/90 mb-2 flex items-center gap-1.5">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                            {i18n.t('notebook.amberHint')}
                          </p>
                        )}

                        {/* Las formulas llegan del OCR en LaTeX entre $...$ (lo pide
                            HANDWRITING_SYSTEM). Sin esto se veian crudas:
                            "$\sqrt[3]{8}$" en pantalla. Mismo trio de plugins que
                            DocumentPage. */}
                        <div className="text-sm text-slate-300 leading-relaxed prose-studyai">
                          <ReactMarkdown
                            remarkPlugins={[remarkMath, remarkGfm]}
                            rehypePlugins={[rehypeKatex]}
                            urlTransform={u => transformarUrl(u, defaultUrlTransform)}
                            components={{
                              // Las dudas viajan como [palabra](duda:N) y lo
                              // subrayado como [texto](u:) — ver dudas.js.
                              // Cualquier otro enlace se pinta normal.
                              a: ({ href, children, ...props }) => {
                                if (String(href || '') === 'u:') {
                                  return <u>{children}</u>
                                }
                                if (!String(href || '').startsWith('duda:')) {
                                  return <a href={href} {...props}>{children}</a>
                                }
                                const indice = Number(String(href).slice(5))
                                const palabra = String(children)
                                return (
                                  <button
                                    type="button"
                                    onClick={() => setDuda({ cuaderno: c.id, fecha: e.date, indice, palabra })}
                                    title={i18n.t('notebook.amberTitle')}
                                    className="no-print underline decoration-dotted decoration-amber-400 underline-offset-2 text-amber-300 hover:text-amber-200 hover:bg-amber-400/10 rounded px-0.5 transition-colors"
                                  >
                                    {palabra}
                                  </button>
                                )
                              },
                            }}
                          >
                            {prepararTexto(e.text)}
                          </ReactMarkdown>
                        </div>
                        </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))
      )}

      {/* Corregir una palabra dudosa. Modal centrado y no un globito junto a la
          palabra a proposito: en el movil un popover flotante acaba tapado por
          el teclado justo cuando el alumno va a escribir. */}
      {duda && <DudaModal duda={duda} guardando={guardando}
                          onCerrar={() => setDuda(null)} onResolver={resolver} />}
    </div>
  )
}


/**
 * Editor de UN dia de apuntes.
 *
 * Lo que el alumno ve es el resultado: al pulsar Negrita, la palabra se pone
 * en negrita. Antes se le metian los asteriscos en el texto y eso despistaba
 * -- es la queja que lo cambio.
 *
 * Por dentro sigue guardandose el MISMO texto con marcas de siempre. La ida y
 * la vuelta viven en src/lib/formato.js, con su prueba de que editar sin tocar
 * nada devuelve el apunte identico.
 *
 * Se usa `contentEditable` con `document.execCommand`, que es lo que trae el
 * navegador: sin librerias de editor y funciona igual dentro de las apps.
 *
 * Las formulas ($...$) se ven dibujadas; doble clic las pasa a texto para
 * corregirlas. Las palabras dudosas ((?)) siguen como texto y vuelven a salir
 * en ambar al guardar. (Habia un boton de vista previa; se quito el 21/9 al
 * dibujar las formulas, ya no aportaba casi nada.)
 */
function EditorApunte({ texto, guardando, onGuardar, onCancelar }) {
  const ref = useRef(null)
  // Solo para saber si hay algo que guardar. El texto
  // que manda es SIEMPRE el que se lee del editor al pulsar Guardar: llevar el
  // contenido en un estado de React y devolverselo al div en cada tecla le
  // mueve el cursor al alumno mientras escribe.
  const [valor, setValor] = useState(texto)

  // Solo al montar. Si el HTML se reescribiera en cada render, se perderia el
  // sitio del cursor.
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = textoAHtml(texto, (tex, bloque) =>
      katex.renderToString(tex, { displayMode: bloque, throwOnError: false }))
  }, [])

  const leer = () => (ref.current ? htmlATexto(ref.current) : valor)

  const mandar = (orden, arg) => {
    ref.current?.focus()
    document.execCommand(orden, false, arg)
    setValor(leer())
  }

  const botones = [
    { Icono: IconBold,          titulo: i18n.t('notebook.fmt.bold'),        accion: () => mandar('bold') },
    { Icono: IconItalic,        titulo: i18n.t('notebook.fmt.italic'),        accion: () => mandar('italic') },
    { Icono: IconUnderline,     titulo: i18n.t('notebook.fmt.underline'),      accion: () => mandar('underline') },
    { Icono: IconStrikethrough, titulo: i18n.t('notebook.fmt.strike'),        accion: () => mandar('strikeThrough') },
    { Icono: IconH1,            titulo: i18n.t('notebook.fmt.h1'),  accion: () => mandar('formatBlock', 'h2') },
    { Icono: IconH2,            titulo: i18n.t('notebook.fmt.h2'), accion: () => mandar('formatBlock', 'h3') },
    { Icono: IconList,          titulo: i18n.t('notebook.fmt.list'),          accion: () => mandar('insertUnorderedList') },
  ]

  // Pegar SIEMPRE como texto plano. Sin esto, pegar de una web mete su HTML
  // dentro del apunte y el alumno acaba con letras de otro color y otro
  // tamano que no puede quitar.
  const pegar = (ev) => {
    ev.preventDefault()
    const plano = (ev.clipboardData || window.clipboardData).getData('text/plain')
    document.execCommand('insertText', false, plano)
    setValor(leer())
  }

  return (
    <div className="no-print">
      <div className="flex flex-wrap items-center gap-1 mb-2">
        {botones.map(({ Icono, titulo, accion }) => (
          <button
            key={titulo}
            type="button"
            // onMouseDown y no onClick: al hacer clic en el boton, el editor
            // pierde el foco y con el la seleccion, y el formato se aplicaria
            // a la nada. Con preventDefault el foco no se mueve.
            onMouseDown={ev => { ev.preventDefault(); accion() }}
            title={titulo}
            disabled={guardando}
            className="p-1.5 rounded-lg text-slate-400 hover:text-primary-300 hover:bg-slate-700
                       disabled:opacity-30 transition-colors"
          >
            <Icono size={16} />
          </button>
        ))}
      </div>

      <div
        ref={ref}
        contentEditable={!guardando}
        suppressContentEditableWarning
        onInput={() => setValor(leer())}
        onPaste={pegar}
        // Doble clic en una formula dibujada la devuelve a texto ($...$) para
        // poder corregirla a mano.
        onDoubleClick={ev => {
          const f = ev.target.closest?.('[data-tex]')
          if (f) { f.replaceWith(document.createTextNode(f.dataset.tex)); setValor(leer()) }
        }}
        className="w-full min-h-[10rem] max-h-[70vh] overflow-y-auto bg-slate-900 border
                   border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-100
                   leading-relaxed focus:border-primary-500 focus:outline-none
                   prose-studyai [&_h2]:text-lg [&_h3]:text-base [&_ul]:list-disc
                   [&_ul]:pl-5 disabled:opacity-50"
      />

      <p className="text-xs text-slate-500 mt-2">
        {i18n.t('notebook.editorHint1')} <strong className="text-slate-400">{i18n.t('notebook.editorBelow')}</strong>{i18n.t('notebook.editorHint2')}
      </p>

      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onGuardar(leer())}
          disabled={guardando || !valor.trim()}
          className="flex items-center justify-center gap-1.5 bg-primary-600 hover:bg-primary-500
                     text-white rounded-xl px-4 py-2 text-sm font-medium
                     disabled:opacity-40 disabled:hover:bg-primary-600"
        >
          {guardando ? <IconLoader2 size={16} className="animate-spin" /> : <IconDeviceFloppy size={16} />}
          {i18n.t('common.save')}
        </button>
        <button
          onClick={onCancelar}
          disabled={guardando}
          className="flex items-center justify-center gap-1.5 bg-slate-700 hover:bg-slate-600
                     text-slate-100 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          <IconX size={16} /> {i18n.t('common.cancel')}
        </button>
      </div>
    </div>
  )
}
