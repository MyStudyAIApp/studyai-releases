import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { api, apiUpload, useAppStore } from '../store/appStore'
import { marcarDudas, resolverDuda, contarDudas } from '../lib/dudas'
import {
  IconNotebook, IconCamera, IconPlus, IconLoader2, IconFolder,
  IconBooks, IconCalendar, IconChevronDown, IconChevronRight,
  IconPrinter, IconFileTypeDoc, IconCheck, IconX,
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
  const { addToast } = useAppStore()
  const navigate = useNavigate()

  const cargar = async () => {
    try {
      const [nb, subj] = await Promise.all([api('GET', '/notebooks'), api('GET', '/subjects')])
      setCuadernos(nb.items || [])
      setSubjects(subj.items || [])
    } catch {
      addToast('No se pudieron cargar tus cuadernos', 'error')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

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
    if (!file) return
    if (!subjectId) return addToast('Elige la asignatura antes de escanear', 'info')

    setSubiendo(true)
    try {
      const form = new FormData()
      form.append('file', file)
      if (topicId) form.append('topic_id', topicId)
      else form.append('subject_id', subjectId)
      form.append('content_type', 'handwritten')

      const r = await apiUpload('/notebooks/append', form)
      addToast(
        r.created
          ? `Cuaderno "${r.title.replace('[Cuaderno] ', '')}" creado con los apuntes de hoy`
          : `Apuntes añadidos a "${r.title.replace('[Cuaderno] ', '')}"`,
        'success',
      )
      setEntradas(prev => ({ ...prev, [r.notebook_id]: null }))   // forzar recarga
      await cargar()
    } catch (err) {
      // 403 con quota_exceeded lo traduce el interceptor de appStore; aqui solo
      // hace falta que el alumno sepa que sus apuntes NO se guardaron.
      addToast(err?.message || 'No se pudieron guardar los apuntes', 'error', 6000)
    } finally {
      setSubiendo(false)
    }
  }

  const desplegar = async (id) => {
    if (abierto === id) return setAbierto(null)
    setAbierto(id)
    if (entradas[id]) return
    try {
      const d = await api('GET', `/notebooks/${id}`)
      setEntradas(prev => ({ ...prev, [id]: d.entries || [] }))
    } catch {
      addToast('No se pudo abrir el cuaderno', 'error')
    }
  }

  // Confirmar o corregir UNA palabra dudosa. Se manda el texto entero con
  // `esperado` para que el servidor rechace la edicion si el apunte cambio
  // mientras tanto (otra pestana, otro movil, o un escaneo nuevo de hoy).
  const resolver = async (palabraNueva) => {
    if (!duda) return
    const lista = entradas[duda.cuaderno] || []
    const entrada = lista.find(e => e.date === duda.fecha)
    if (!entrada) return setDuda(null)

    const nuevo = resolverDuda(entrada.text, duda.indice, palabraNueva)
    if (nuevo === entrada.text) return setDuda(null)

    setGuardando(true)
    try {
      await api('PATCH', `/notebooks/${duda.cuaderno}/entries/${duda.fecha}`,
                { text: nuevo, esperado: entrada.text })
      setEntradas(prev => ({
        ...prev,
        [duda.cuaderno]: prev[duda.cuaderno].map(
          e => e.date === duda.fecha ? { ...e, text: nuevo } : e),
      }))
      setDuda(null)
    } catch (err) {
      // El 409 es el caso interesante: no es un fallo, es que hay algo mas
      // nuevo. Se recarga para que no siga corrigiendo sobre texto viejo.
      addToast(err?.message || 'No se pudo guardar la corrección', 'error', 5000)
      if (String(err?.message || '').includes('cambiado')) {
        setEntradas(prev => ({ ...prev, [duda.cuaderno]: null }))
        desplegar(duda.cuaderno)
      }
      setDuda(null)
    } finally {
      setGuardando(false)
    }
  }

  const fecha = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  // Los apuntes en un solo documento, para llevarlos al papel o a Word. Se
  // arma aqui y no en el servidor porque el texto ya esta descargado: no hace
  // falta pedir nada ni gastar cupo por imprimir lo que el alumno ya tiene.
  const comoHtml = (c) => {
    const dias = (entradas[c.id] || [])
      .map(e => `<h2>${fecha(e.date)}</h2><p>${e.text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>')}</p>`)
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
    const clave = c.subject_name || 'Sin asignatura'
    ;(acc[clave] = acc[clave] || []).push(c)
    return acc
  }, {})

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2 mb-1">
        <IconNotebook size={24} className="text-primary-400" /> Mi cuaderno
      </h1>
      <p className="text-slate-400 text-sm mb-6">
        Fotografía la página de tu libreta y se suma a tus apuntes de esa asignatura.
        La foto no se guarda, solo el texto.
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
              <option value="" className="bg-slate-900">Elige asignatura…</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id} className="bg-slate-900">{s.name}</option>
              ))}
            </select>
            <button
              onClick={crearAsignatura}
              title="Nueva asignatura"
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
              <option value="" className="bg-slate-900">Sin tema concreto</option>
              {topics.map(t => (
                <option key={t.id} value={t.id} className="bg-slate-900">{t.name}</option>
              ))}
            </select>
            <button
              onClick={crearTema}
              title="Nuevo tema"
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
          onClick={() => fileRef.current?.click()}
          disabled={subiendo || !subjectId}
          className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-500
                     disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold
                     rounded-xl py-3 transition-colors"
        >
          {subiendo
            ? <><IconLoader2 size={18} className="animate-spin" /> Leyendo tus apuntes…</>
            : <><IconCamera size={18} /> Añadir página de la libreta</>}
        </button>
        {subiendo && (
          <p className="text-center text-xs text-slate-500 mt-2">
            Puede tardar unos segundos, no cierres la página
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
          <p className="text-sm">Todavía no tienes apuntes. Escanea tu primera página.</p>
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
                      {c.entries} {c.entries === 1 ? 'día' : 'días'}
                      {c.last_date && <> · último: {fecha(c.last_date)}</>}
                    </p>
                  </button>
                  {abierto === c.id && entradas[c.id]?.length > 0 && (
                    <>
                      <button
                        onClick={() => imprimir(c)}
                        title="Imprimir o guardar en PDF"
                        className="no-print shrink-0 p-1.5 text-slate-500 hover:text-primary-400 transition-colors"
                      >
                        <IconPrinter size={16} />
                      </button>
                      <button
                        onClick={() => descargarWord(c)}
                        title="Descargar para Word"
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
                    Estudiar
                  </button>
                </div>

                {abierto === c.id && (
                  <div className="border-t border-slate-700 px-4 py-3 space-y-4">
                    {entradas[c.id] == null ? (
                      <IconLoader2 size={18} className="animate-spin text-slate-600 mx-auto" />
                    ) : entradas[c.id].map(e => (
                      <div key={e.date}>
                        <p className="text-xs font-semibold text-primary-400 mb-1">{fecha(e.date)}</p>

                        {contarDudas(e.text) > 0 && (
                          <p className="no-print text-xs text-amber-400/90 mb-2 flex items-center gap-1.5">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                            Toca las palabras en ámbar: no se leyeron con seguridad.
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
                            components={{
                              // Las dudas viajan como [palabra](duda:N) — ver
                              // marcarDudas(). Cualquier otro enlace se pinta normal.
                              a: ({ href, children, ...props }) => {
                                if (!String(href || '').startsWith('duda:')) {
                                  return <a href={href} {...props}>{children}</a>
                                }
                                const indice = Number(String(href).slice(5))
                                const palabra = String(children)
                                return (
                                  <button
                                    type="button"
                                    onClick={() => setDuda({ cuaderno: c.id, fecha: e.date, indice, palabra })}
                                    title="No se leyó con seguridad — toca para corregir o confirmar"
                                    className="no-print underline decoration-dotted decoration-amber-400 underline-offset-2 text-amber-300 hover:text-amber-200 hover:bg-amber-400/10 rounded px-0.5 transition-colors"
                                  >
                                    {palabra}
                                  </button>
                                )
                              },
                            }}
                          >
                            {marcarDudas(e.text)}
                          </ReactMarkdown>
                        </div>
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


/** Cuadro para confirmar o corregir UNA palabra que la transcripcion dudo. */
function DudaModal({ duda, guardando, onCerrar, onResolver }) {
  const [valor, setValor] = useState(duda.palabra)
  const inputRef = useRef(null)

  // Foco y texto seleccionado al abrir: lo normal es querer reescribir la
  // palabra entera, no colocar el cursor a mano en un movil.
  useEffect(() => { inputRef.current?.select() }, [])

  const cambiada = valor.trim() && valor.trim() !== duda.palabra

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
         onClick={onCerrar}>
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 w-full max-w-sm"
           onClick={ev => ev.stopPropagation()}>
        <p className="text-sm text-slate-400 mb-1">Esta palabra no se leyó con seguridad</p>
        <p className="text-xs text-slate-500 mb-3">Corrígela si está mal, o confírmala si es correcta.</p>

        <input
          ref={inputRef}
          value={valor}
          onChange={ev => setValor(ev.target.value)}
          onKeyDown={ev => { if (ev.key === 'Enter' && cambiada) onResolver(valor.trim()) }}
          disabled={guardando}
          className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5 text-slate-100
                     focus:border-primary-500 focus:outline-none disabled:opacity-50"
          autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}
        />

        <div className="flex gap-2 mt-4">
          {/* "Correcto" quita la interrogacion sin tocar la palabra; "Editar"
              la sustituye. Se pasa `undefined` en el primer caso justamente
              para dejar la palabra tal cual (ver resolverDuda). */}
          <button
            onClick={() => onResolver(undefined)}
            disabled={guardando}
            className="flex-1 flex items-center justify-center gap-1.5 bg-slate-700 hover:bg-slate-600
                       text-slate-100 rounded-xl py-2.5 text-sm font-medium disabled:opacity-50"
          >
            <IconCheck size={16} /> Correcto
          </button>
          <button
            onClick={() => onResolver(valor.trim())}
            disabled={guardando || !cambiada}
            className="flex-1 flex items-center justify-center gap-1.5 bg-primary-600 hover:bg-primary-500
                       text-white rounded-xl py-2.5 text-sm font-medium
                       disabled:opacity-40 disabled:hover:bg-primary-600"
          >
            {guardando ? <IconLoader2 size={16} className="animate-spin" /> : <IconCheck size={16} />} Editar
          </button>
        </div>

        <button onClick={onCerrar} disabled={guardando}
                className="w-full mt-2 text-xs text-slate-500 hover:text-slate-300 py-1.5
                           flex items-center justify-center gap-1 disabled:opacity-50">
          <IconX size={13} /> Ahora no
        </button>
      </div>
    </div>
  )
}
