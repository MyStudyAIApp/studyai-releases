import { useState } from 'react'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { api, useAppStore } from '../store/appStore'
import { prepararTexto, resolverDuda, contarDudas, transformarUrl } from '../lib/dudas'
import { ensureMathDelimiters } from '../utils/mathText'
import DudaModal from './DudaModal'

/**
 * La transcripcion de un documento escaneado, tal y como la ve el alumno.
 *
 * Hace tres cosas que antes no hacia:
 *  - pinta SUBRAYADO lo que el alumno subrayo en su libreta (llega como
 *    <u>...</u>); antes se veian las etiquetas en crudo,
 *  - pinta en ambar las palabras que la transcripcion no leyo con seguridad y
 *    deja tocarlas para corregirlas o confirmarlas,
 *  - deja pasar nuestros dos esquemas de enlace por el filtro de
 *    react-markdown, que si no los vacia (ver lib/dudas.js).
 *
 * Vive aqui y no dentro de cada pantalla porque lo usan la vista de escritorio
 * y la del movil. Copiado en las dos, arreglar una dejaba la otra rota.
 *
 * La correccion viaja como "corrige la duda numero N", NO como el texto
 * entero: la pantalla de escritorio tiene el texto partido en trozos por
 * /documents/{id}/text, con los saltos de linea normalizados, y devolver eso
 * reescribiria el documento del alumno con los espacios cambiados.
 */
export default function TextoApunte({ docId, texto, onTextoCambiado, className = '' }) {
  const [duda, setDuda] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const { addToast } = useAppStore()

  const editable = Boolean(docId && onTextoCambiado)
  const dudas = contarDudas(texto)

  const resolver = async (palabraNueva) => {
    if (!duda) return
    setGuardando(true)
    try {
      await api('PATCH', `/documents/${docId}/duda`, {
        indice: duda.indice,
        palabra_esperada: duda.palabra,
        palabra_nueva: palabraNueva ?? null,
      })
      // Se aplica el MISMO cambio en local en vez de recargar: el servidor ya
      // ha confirmado, y recargar aqui haria parpadear el documento entero.
      onTextoCambiado(resolverDuda(texto, duda.indice, palabraNueva))
    } catch (err) {
      addToast(err?.message || 'No se pudo guardar la corrección', 'error', 5000)
    } finally {
      setGuardando(false)
      setDuda(null)
    }
  }

  return (
    <>
      {editable && dudas > 0 && (
        <p className="no-print text-xs text-amber-400/90 mb-2 flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
          Toca las palabras en ámbar: no se leyeron con seguridad.
        </p>
      )}

      <div className={className}>
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
          rehypePlugins={[rehypeKatex]}
          urlTransform={u => transformarUrl(u, defaultUrlTransform)}
          components={{
            a: ({ href, children, ...props }) => {
              if (String(href || '') === 'u:') return <u>{children}</u>
              if (!String(href || '').startsWith('duda:')) {
                return <a href={href} {...props}>{children}</a>
              }
              const indice = Number(String(href).slice(5))
              const palabra = String(children)
              if (!editable) return <span className="text-amber-300">{palabra}</span>
              return (
                <button
                  type="button"
                  onClick={() => setDuda({ indice, palabra })}
                  title="No se leyó con seguridad — toca para corregir o confirmar"
                  className="no-print underline decoration-dotted decoration-amber-400
                             underline-offset-2 text-amber-300 hover:text-amber-200
                             hover:bg-amber-400/10 rounded px-0.5 transition-colors"
                >
                  {palabra}
                </button>
              )
            },
          }}
        >
          {/* Cada linea como su propio parrafo, para conservar los saltos
              (los pasos de un ejercicio, por ejemplo). Las marcas de duda y de
              subrayado se ponen DESPUES, sobre el texto ya preparado. */}
          {prepararTexto(ensureMathDelimiters(texto).replace(/\n/g, '\n\n'))}
        </ReactMarkdown>
      </div>

      {duda && <DudaModal duda={duda} guardando={guardando}
                          onCerrar={() => setDuda(null)} onResolver={resolver} />}
    </>
  )
}
