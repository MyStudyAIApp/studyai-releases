import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'

// ── Custom markdown components ─────────────────────────────────────────────
const mdComponents = {
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold text-slate-100 mt-6 mb-3 pb-2 border-b-2 border-primary-500">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-bold text-slate-100 mt-6 mb-3 flex items-center gap-2">
      <span className="w-1 h-6 bg-primary-500 rounded-full shrink-0" />
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold text-primary-300 mt-4 mb-2">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-slate-200 leading-relaxed mb-3 text-sm">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="text-slate-100 font-semibold">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="text-primary-300 not-italic font-medium">{children}</em>
  ),
  ul: ({ children }) => (
    <ul className="space-y-1.5 mb-3 ml-4">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="space-y-1.5 mb-3 ml-4 list-decimal">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-slate-200 text-sm flex items-start gap-2">
      <span className="text-primary-400 mt-1 shrink-0 text-xs">▸</span>
      <span>{children}</span>
    </li>
  ),
  blockquote: ({ children }) => (
    <div className="my-3 border-l-4 border-amber-400 bg-amber-900/20 rounded-r-lg px-4 py-3">
      <div className="text-amber-300 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1">
        <span>⚠️</span> Importante
      </div>
      <div className="text-amber-100 text-sm">{children}</div>
    </div>
  ),
  code: ({ inline, children }) => inline
    ? <code className="bg-slate-700 text-primary-300 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
    : <pre className="bg-slate-800 border border-slate-700 rounded-lg p-4 overflow-x-auto my-3 text-xs font-mono text-slate-200">{children}</pre>,
  table: ({ children }) => (
    <div className="overflow-x-auto my-4">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-primary-900/50">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="border border-slate-600 px-3 py-2 text-left text-xs font-semibold text-primary-300 uppercase tracking-wider">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-slate-700 px-3 py-2 text-slate-200 text-sm">{children}</td>
  ),
  tr: ({ children }) => (
    <tr className="odd:bg-slate-800/40 even:bg-slate-800/10">{children}</tr>
  ),
  hr: () => <hr className="border-slate-700 my-4" />,
}

// ── Markdown cleaner ──────────────────────────────────────────────────────
// Fixes AI-generated artifacts before passing to ReactMarkdown or the printer

// ── Superscript / subscript Unicode maps ─────────────────────────────────
const SUP = {'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹',
             '+':'⁺','-':'⁻','=':'⁼','(':'⁽',')':'⁾',
             'n':'ⁿ','a':'ᵃ','b':'ᵇ','c':'ᶜ','d':'ᵈ','e':'ᵉ','g':'ᵍ','h':'ʰ',
             'i':'ⁱ','j':'ʲ','k':'ᵏ','l':'ˡ','m':'ᵐ','o':'ᵒ','p':'ᵖ',
             'r':'ʳ','s':'ˢ','t':'ᵗ','u':'ᵘ','v':'ᵛ','w':'ʷ','x':'ˣ','y':'ʸ','z':'ᶻ'}
const SUB = {'0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉',
             '+':'₊','-':'₋','=':'₌','(':'₍',')':'₎',
             'a':'ₐ','e':'ₑ','o':'ₒ','x':'ₓ','h':'ₕ','k':'ₖ','l':'ₗ','m':'ₘ',
             'n':'ₙ','p':'ₚ','s':'ₛ','t':'ₜ','i':'ᵢ','j':'ⱼ','r':'ᵣ','u':'ᵤ','v':'ᵥ'}

const toSup = s => [...s].map(c => SUP[c] ?? c).join('')
const toSub = s => [...s].map(c => SUB[c] ?? c).join('')

const LATEX_CMDS = new Set([
  'times','div','frac','dfrac','tfrac','cfrac','sqrt','sum','int','oint','prod',
  'alpha','beta','gamma','delta','epsilon','varepsilon','zeta','eta','theta','vartheta',
  'iota','kappa','lambda','mu','nu','xi','pi','varpi','rho','varrho','sigma','varsigma',
  'tau','upsilon','phi','varphi','chi','psi','omega',
  'Gamma','Delta','Theta','Lambda','Xi','Pi','Sigma','Phi','Psi','Omega',
  'sin','cos','tan','cot','sec','csc','arcsin','arccos','arctan','log','ln','exp',
  'lim','max','min','sup','inf','det','dim','ker','deg',
  'le','ge','leq','geq','neq','approx','equiv','sim','simeq','propto','cong',
  'in','notin','subset','subseteq','supset','cup','cap','emptyset','varnothing',
  'forall','exists','neg','wedge','vee','oplus','otimes','odot',
  'infty','partial','nabla','pm','mp','cdot','cdots','ldots','vdots','ddots',
  'vec','hat','bar','tilde','dot','ddot','widehat','overline','underline',
  'left','right','big','Big','bigg','Bigg',
  'text','mathrm','mathbf','mathit','mathbb','mathcal','mathsf','operatorname',
  'quad','qquad','begin','end','over','under','stackrel','overset','underset',
  'overrightarrow','overleftarrow','rightarrow','leftarrow','Rightarrow','Leftarrow',
  'to','gets','iff','implies','land','lor','lnot',
])

function cleanMarkdown(content) {
  if (!content) return ''
  let s = content
  // 1. Fix doubled/mixed heading markers like "## ## Title", "##### ###### Title", "## ### #### Title"
  //    Matches: line-start + N hashes, then one-or-more groups of (space + M hashes), then final space
  //    Keeps only the first group of hashes (preserves heading level)
  s = s.replace(/^(#{1,6})( #{1,6})+ /gm, '$1 ')
  // Downgrade h4–h6 → h3 (only h1/h2/h3 have custom styled components)
  s = s.replace(/^#{4,6} /gm, '### ')

  // 2. Restore backslash commands mangled by JSON escape parsing:
  //    JSON \t (TAB, char 9) ate the 't' from \times, \theta, \to…
  //    JSON \f (FF,  char 12) ate the 'f' from \frac, \forall…
  //    JSON \b (BS,  char 8)  ate the 'b' from \begin, \beta…
  s = s.replace(/\t([A-Za-z]+)/g, (m, r) => LATEX_CMDS.has('t' + r) ? '\\t' + r : m)
  s = s.replace(/\f([A-Za-z]+)/g, (m, r) => LATEX_CMDS.has('f' + r) ? '\\f' + r : m)
  s = s.replace(/\x08([A-Za-z]+)/g, (m, r) => LATEX_CMDS.has('b' + r) ? '\\b' + r : m)

  // 3. Strip display math delimiters \[...\] → plain text
  //    (AI often puts °F/°C inside LaTeX which KaTeX can't render → shows [error brackets])
  s = s.replace(/\\\[([\s\S]*?)\\\]/g, (_, m) => m.trim())
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, (_, m) => m.trim())
  s = s.replace(/\$([^$\n]+?)\$/g, (_, m) => m.trim())

  // 4. Replace common LaTeX commands with Unicode so formulas read naturally
  s = s
    .replace(/\\times\b/g, '×')
    .replace(/\\div\b/g, '÷')
    .replace(/\\cdot\b/g, '·')
    .replace(/\\pm\b/g, '±')
    .replace(/\\mp\b/g, '∓')
    .replace(/\\leq?\b/g, '≤')
    .replace(/\\geq?\b/g, '≥')
    .replace(/\\neq\b/g, '≠')
    .replace(/\\approx\b/g, '≈')
    .replace(/\\equiv\b/g, '≡')
    .replace(/\\infty\b/g, '∞')
    .replace(/\\rightarrow\b/g, '→')
    .replace(/\\leftarrow\b/g, '←')
    .replace(/\\Rightarrow\b/g, '⇒')
    .replace(/\\alpha\b/g, 'α').replace(/\\beta\b/g, 'β')
    .replace(/\\gamma\b/g, 'γ').replace(/\\delta\b/g, 'δ')
    .replace(/\\epsilon\b/g, 'ε').replace(/\\varepsilon\b/g, 'ε')
    .replace(/\\theta\b/g, 'θ').replace(/\\lambda\b/g, 'λ')
    .replace(/\\mu\b/g, 'μ').replace(/\\nu\b/g, 'ν')
    .replace(/\\pi\b/g, 'π').replace(/\\rho\b/g, 'ρ')
    .replace(/\\sigma\b/g, 'σ').replace(/\\tau\b/g, 'τ')
    .replace(/\\phi\b/g, 'φ').replace(/\\omega\b/g, 'ω')
    .replace(/\\Omega\b/g, 'Ω').replace(/\\Sigma\b/g, 'Σ')
    .replace(/\\Delta\b/g, 'Δ').replace(/\\Gamma\b/g, 'Γ')
    // \frac{a}{b} → (a)/(b)
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
    // \sqrt{x} → √(x), \sqrt x → √x
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\sqrt\s+(\S+)/g, '√$1')
    // \text{...} → just the text
    .replace(/\\text\{([^}]*)\}/g, '$1')
    // superscripts: ^{...} and ^digit(s) → Unicode ²³⁴…
    .replace(/\^\{([^}]+)\}/g,  (_, e) => toSup(e))
    .replace(/\^(-?[\d]+)/g,    (_, e) => toSup(e))
    // single-letter superscripts only if we have a Unicode char for it
    .replace(/\^([A-Za-z])\b/g, (m, e) => { const r = toSup(e); return r !== e ? r : m })
    // subscripts: _{...} and _digit(s) → Unicode ₀₁₂…
    .replace(/\_\{([^}]+)\}/g,  (_, e) => toSub(e))
    .replace(/_(-?[\d]+)/g,     (_, e) => toSub(e))
    // single-letter subscripts only if we have a Unicode char for it
    .replace(/_([A-Za-z])\b/g,  (m, e) => { const r = toSub(e); return r !== e ? r : m })

  return s
}

// ── Print helpers ──────────────────────────────────────────────────────────

// El contenido de esta ventana de impresión viene de un resumen generado por
// el modelo a partir de un documento subido por el usuario -- sin escapar,
// un documento manipulado a propósito puede hacer que el resumen incluya
// HTML/JS que se ejecuta al imprimir (se escribe con document.write en una
// ventana que hereda el origen de la app).
export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Convert inline markdown (bold, italic, code) to HTML */
function inlineMd(text) {
  return escapeHtml(text)
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:#f3f4f6;padding:1px 4px;border-radius:3px;font-size:9pt;font-family:monospace">$1</code>')
}

/** Convert a markdown string to clean print HTML, line by line */
function mdToHtml(md) {
  const lines = (md || '').split('\n')
  const out = []
  let inUl = false
  let inOl = false

  const closeList = () => {
    if (inUl) { out.push('</ul>'); inUl = false }
    if (inOl) { out.push('</ol>'); inOl = false }
  }

  for (const raw of lines) {
    const line = raw.trimEnd()

    if (/^### /.test(line)) {
      closeList()
      out.push(`<h3>${inlineMd(line.slice(4))}</h3>`)
    } else if (/^## /.test(line)) {
      closeList()
      out.push(`<h2>${inlineMd(line.slice(3))}</h2>`)
    } else if (/^# /.test(line)) {
      closeList()
      out.push(`<h1>${inlineMd(line.slice(2))}</h1>`)
    } else if (/^> /.test(line)) {
      closeList()
      out.push(`<blockquote>${inlineMd(line.slice(2))}</blockquote>`)
    } else if (/^\d+\. /.test(line)) {
      if (inUl) { out.push('</ul>'); inUl = false }
      if (!inOl) { out.push('<ol>'); inOl = true }
      out.push(`<li>${inlineMd(line.replace(/^\d+\. /, ''))}</li>`)
    } else if (/^[-*] /.test(line)) {
      if (inOl) { out.push('</ol>'); inOl = false }
      if (!inUl) { out.push('<ul>'); inUl = true }
      out.push(`<li>${inlineMd(line.slice(2))}</li>`)
    } else if (line.trim() === '') {
      closeList()
    } else {
      closeList()
      out.push(`<p>${inlineMd(line)}</p>`)
    }
  }
  closeList()
  return out.join('\n')
}

export function buildPrintHtml(result, docTitle = '') {
  const { content, key_points, vocabulary, connections, callouts, tables } = result

  const calloutsHtml = callouts?.length
    ? `<div class="section callout-box">
        <h2>⚡ Fórmulas y reglas clave</h2>
        ${callouts.map((c, i) => `<div class="callout-item"><span class="callout-num">${String(i+1).padStart(2,'0')}</span><code>${inlineMd(c)}</code></div>`).join('')}
       </div>`
    : ''

  const tablesHtml = tables?.length
    ? tables.map(t => `
        <div class="section">
          ${t.title ? `<h2>📊 ${escapeHtml(t.title)}</h2>` : ''}
          <table>
            ${t.headers?.length ? `<thead><tr>${t.headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>` : ''}
            <tbody>${(t.rows || []).map((row, ri) =>
              `<tr>${(Array.isArray(row) ? row : [row]).map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`
            ).join('')}</tbody>
          </table>
        </div>`).join('')
    : ''

  const kpHtml = key_points?.length
    ? `<div class="section kp-box">
        <h2>⭐ Puntos clave</h2>
        <ul>${key_points.map(p => `<li>${inlineMd(p)}</li>`).join('')}</ul>
       </div>`
    : ''

  const connHtml = connections?.length
    ? `<div class="section conn-box">
        <h2>🔗 Conexiones entre temas</h2>
        <ul>${connections.map(c => `<li>↔ ${inlineMd(c)}</li>`).join('')}</ul>
       </div>`
    : ''

  const vocHtml = vocabulary?.length
    ? `<div class="section">
        <h2>📚 Vocabulario clave</h2>
        <table>
          <thead><tr><th>Término</th><th>Definición</th></tr></thead>
          <tbody>${vocabulary.map(v =>
            `<tr><td><strong>${escapeHtml(v.term)}</strong></td><td>${escapeHtml(v.definition)}</td></tr>`
          ).join('')}</tbody>
        </table>
       </div>`
    : ''

  const contentHtml = mdToHtml(cleanMarkdown(content))

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(docTitle || 'Resumen')}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, 'Times New Roman', serif; font-size: 11pt; line-height: 1.7;
           color: #1a1a1a; background: white; padding: 2cm; max-width: 21cm; margin: 0 auto; }
    h1 { font-size: 20pt; font-weight: bold; color: #1e3a5f; margin: 0 0 8pt;
         border-bottom: 2pt solid #3b6fbf; padding-bottom: 6pt; }
    h2 { font-size: 14pt; font-weight: bold; color: #1e3a5f; margin: 20pt 0 6pt;
         border-left: 4pt solid #3b6fbf; padding-left: 8pt; }
    h3 { font-size: 12pt; font-weight: bold; color: #2d5a9e; margin: 12pt 0 4pt; }
    p  { margin-bottom: 8pt; }
    ul, ol { margin: 6pt 0 10pt 20pt; }
    li { margin-bottom: 4pt; }
    blockquote { background: #fffbeb; border-left: 4pt solid #d97706; padding: 10pt 14pt;
                 margin: 12pt 0; border-radius: 0 4pt 4pt 0; }
    blockquote::before { content: "⚠ Importante: "; font-weight: bold; color: #b45309; }
    table { border-collapse: collapse; width: 100%; margin: 10pt 0; font-size: 10pt; }
    th { background: #1e3a5f; color: white; padding: 6pt 10pt; text-align: left; }
    td { border: 0.5pt solid #ccc; padding: 5pt 10pt; }
    tr:nth-child(even) td { background: #f5f8ff; }
    strong { color: #1e3a5f; }
    .section { margin: 20pt 0; padding: 14pt; border-radius: 6pt; }
    .callout-box { background: #fffbeb; border: 1pt solid #d97706; }
    .callout-box h2 { color: #b45309; border-color: #d97706; }
    .callout-item { display: flex; gap: 10pt; align-items: baseline; margin: 6pt 0; border-left: 3pt solid #f59e0b; padding-left: 8pt; }
    .callout-num { font-weight: bold; color: #b45309; font-size: 9pt; min-width: 18pt; }
    .callout-item code { font-family: monospace; font-size: 10pt; color: #1e3a5f; background: #fef3c7; padding: 2pt 4pt; border-radius: 2pt; }
    .kp-box  { background: #f0f4ff; border: 1pt solid #93c5fd; }
    .kp-box h2 { color: #1d4ed8; border-color: #1d4ed8; }
    .kp-box li { list-style: none; padding-left: 12pt; }
    .kp-box li::before { content: "→ "; color: #2563eb; font-weight: bold; }
    .conn-box { background: #f0fdf4; border: 1pt solid #86efac; }
    .conn-box h2 { color: #15803d; border-color: #15803d; }
    .header { margin-bottom: 20pt; border-bottom: 1pt solid #ddd; padding-bottom: 10pt; }
    .meta { color: #666; font-size: 9pt; margin-top: 4pt; }
    @media print {
      body { padding: 1.5cm; }
      h2 { page-break-after: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${docTitle || 'Resumen'}</h1>
    <div class="meta">Generado por MyStudy AI · ${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
  </div>
  ${contentHtml}
  ${calloutsHtml}
  ${tablesHtml}
  ${kpHtml}
  ${connHtml}
  ${vocHtml}
</body>
</html>`
}

// ── Component ──────────────────────────────────────────────────────────────
export default function SummaryView({ result }) {
  const { content, key_points, vocabulary, connections, callouts, tables } = result
  const isExtended = result.type === 'extended_summary'

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-8">

      {/* Aviso resumen ampliado */}
      {isExtended && (
        <div className="flex items-start gap-3 bg-blue-900/30 border border-blue-500/40 rounded-xl px-4 py-3">
          <span className="text-xl shrink-0">🔍</span>
          <div>
            <p className="text-blue-300 font-semibold text-sm">Resumen ampliado</p>
            <p className="text-blue-200/80 text-xs mt-0.5 leading-relaxed">
              Este resumen incluye información adicional más allá del documento original.
              Los párrafos marcados con <span className="font-bold text-amber-300">📚</span> contienen
              contexto externo añadido para ayudarte a entender mejor el tema.
            </p>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="space-y-1">
        <ReactMarkdown
          remarkPlugins={[remarkMath, remarkGfm]}
          rehypePlugins={[rehypeKatex]}
          components={mdComponents}
        >
          {cleanMarkdown(content || '')}
        </ReactMarkdown>
      </div>

      {/* Callouts — fórmulas y reglas clave */}
      {callouts?.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-bold text-amber-400 text-xs uppercase tracking-wider flex items-center gap-2">
            <span>⚡</span> Fórmulas y reglas clave
          </h3>
          {callouts.map((c, i) => (
            <div key={i} className="flex items-start gap-3 border-l-4 border-amber-400 bg-amber-900/20 rounded-r-lg px-4 py-2.5">
              <span className="text-amber-400 font-bold text-xs mt-0.5 shrink-0">{String(i+1).padStart(2,'0')}</span>
              <span className="text-amber-100 text-sm leading-snug font-mono">{cleanMarkdown(c)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tables — comparativas */}
      {tables?.length > 0 && tables.map((t, ti) => (
        <div key={ti} className="rounded-xl border border-slate-700 bg-slate-800/40 overflow-hidden">
          {t.title && (
            <div className="px-4 py-2.5 border-b border-slate-700 bg-primary-900/40 flex items-center gap-2">
              <span className="text-lg">📊</span>
              <h3 className="font-bold text-primary-300 text-sm">{t.title}</h3>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              {t.headers?.length > 0 && (
                <thead>
                  <tr>
                    {t.headers.map((h, hi) => (
                      <th key={hi} className="bg-primary-900/60 border border-slate-700 px-3 py-2 text-left text-xs font-semibold text-primary-300 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {(t.rows || []).map((row, ri) => (
                  <tr key={ri} className="odd:bg-slate-800/40 even:bg-slate-800/10 hover:bg-slate-700/30 transition-colors">
                    {(Array.isArray(row) ? row : [row]).map((cell, ci) => (
                      <td key={ci} className="border border-slate-700/50 px-3 py-2 text-slate-200">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Key points */}
      {key_points?.length > 0 && (
        <div className="rounded-xl border border-primary-700/50 bg-primary-900/20 p-5">
          <h3 className="font-bold text-primary-300 mb-3 flex items-center gap-2 text-sm uppercase tracking-wider">
            <span className="text-lg">⭐</span> Puntos clave
          </h3>
          <div className="grid grid-cols-1 gap-2">
            {key_points.map((p, i) => (
              <div key={i} className="flex items-start gap-3 bg-primary-900/30 rounded-lg px-3 py-2">
                <span className="text-primary-400 font-bold text-sm shrink-0 mt-0.5">{String(i+1).padStart(2,'0')}</span>
                <span className="text-slate-200 text-sm leading-snug">{p}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connections */}
      {connections?.length > 0 && (
        <div className="rounded-xl border border-emerald-700/50 bg-emerald-900/20 p-5">
          <h3 className="font-bold text-emerald-300 mb-3 flex items-center gap-2 text-sm uppercase tracking-wider">
            <span className="text-lg">🔗</span> Conexiones entre temas
          </h3>
          <div className="space-y-2">
            {connections.map((c, i) => (
              <div key={i} className="flex items-start gap-3 bg-emerald-900/30 rounded-lg px-3 py-2">
                <span className="text-emerald-400 shrink-0 mt-0.5">↔</span>
                <span className="text-slate-200 text-sm leading-snug">{c}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vocabulary */}
      {vocabulary?.length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/40 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-700 bg-slate-800/60 flex items-center gap-2">
            <span className="text-lg">📚</span>
            <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wider">Vocabulario clave</h3>
            <span className="ml-auto text-xs text-slate-500">{vocabulary.length} términos</span>
          </div>
          <div className="divide-y divide-slate-700/50">
            {vocabulary.map((v, i) => (
              <div key={i} className="flex items-baseline gap-4 px-5 py-2.5 hover:bg-slate-700/20 transition-colors">
                <span className="font-semibold text-primary-300 text-sm w-40 shrink-0">{v.term}</span>
                <span className="text-slate-300 text-sm leading-snug">{v.definition}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
