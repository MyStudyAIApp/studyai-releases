// La IA a veces devuelve LaTeX suelto sin los delimitadores $ ... $ alrededor
// (aunque el prompt se lo pide explícitamente) — sin esto, remark-math no lo
// reconoce como fórmula y se ve el código LaTeX en crudo en pantalla. Red de
// seguridad: si el texto tiene pinta de LaTeX (comandos \algo) pero no lleva
// ningún $ todavía, se envuelve entero. No toca nada si ya viene bien formado.
const LATEX_HINT = /\\(left|right|frac|cdot|div|times|sqrt|left|sum|int|leq|geq|neq|infty|pm)\b|\^\{|_\{/

export function ensureMathDelimiters(text) {
  if (!text || typeof text !== 'string') return text
  if (text.includes('$')) return text
  if (!LATEX_HINT.test(text)) return text
  return `$${text}$`
}
