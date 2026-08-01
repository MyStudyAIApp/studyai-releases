import katex from 'katex'
import 'katex/dist/katex.min.css'

function safeJsonParse(str) {
  try { return JSON.parse(str) } catch {}
  // Fix unescaped backslashes and literal newlines inside strings
  try {
    let fixed = ''
    let inStr = false
    for (let i = 0; i < str.length; i++) {
      const c = str[i]
      if (c === '\\' && inStr) {
        const next = str[i + 1] || ''
        fixed += '\\\\'
        if (next && !'"\\\/bfnrtu'.includes(next)) { i++; fixed += next }
        else { i++; fixed += next }
      } else if (c === '"') { inStr = !inStr; fixed += c }
      else if (c === '\n' && inStr) { fixed += '\\n' }
      else if (c === '\r' && inStr) { fixed += '\\r' }
      else { fixed += c }
    }
    return JSON.parse(fixed)
  } catch {}
  return null
}

export default function FormulasView({ result }) {
  let { formulas = [], content } = result
  if (formulas.length === 0 && content) {
    try {
      const blockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
      const jsonStr = blockMatch ? blockMatch[1].trim() : content
      const objMatch = jsonStr.match(/\{[\s\S]*\}/)
      if (objMatch) {
        const parsed = safeJsonParse(objMatch[0])
        if (parsed?.formulas?.length) formulas = parsed.formulas
      }
    } catch {}
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold text-slate-100">Hoja de fórmulas</h2>
        <span className="badge-blue">{formulas.length} fórmulas</span>
      </div>

      {formulas.length > 0 ? (
        <div className="grid grid-cols-1 gap-3">
          {formulas.map((f, i) => (
            <div key={i} className="card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="font-semibold text-primary-300 text-sm mb-1">
                    {typeof f.name === 'object' ? JSON.stringify(f.name) : f.name}
                  </p>
                  <div className="bg-slate-900 rounded-lg px-4 py-3 text-slate-100 text-sm overflow-x-auto">
                    {f.latex ? (
                      <span dangerouslySetInnerHTML={{ __html: renderLatex(typeof f.latex === 'object' ? Object.values(f.latex)[0] : f.latex) }} />
                    ) : (
                      <span className="font-mono">{typeof f.formula === 'object' ? JSON.stringify(f.formula) : f.formula}</span>
                    )}
                  </div>
                  {f.variables && (
                    <p className="text-xs text-slate-400 mt-1.5">
                      {typeof f.variables === 'object' ? Object.entries(f.variables).map(([k,v])=>`${k}: ${v}`).join(' | ') : f.variables}
                    </p>
                  )}
                  {f.notes && (
                    <p className="text-xs text-slate-500 mt-1 italic">
                      {typeof f.notes === 'object' ? JSON.stringify(f.notes) : f.notes}
                    </p>
                  )}
                </div>
                {f.topic && <span className="badge-purple shrink-0 text-[10px]">{f.topic}</span>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-8 text-slate-400">
          <p>No se encontraron fórmulas en este documento</p>
          {content && <p className="text-sm mt-2 whitespace-pre-wrap text-slate-300">{content}</p>}
        </div>
      )}
    </div>
  )
}

function renderLatex(latex) {
  try {
    return katex.renderToString(latex, { displayMode: true, throwOnError: false })
  } catch {
    return `<span class="font-mono">${latex}</span>`
  }
}
