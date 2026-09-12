// La IA a veces devuelve LaTeX suelto sin los delimitadores $ ... $ alrededor
// (aunque el prompt se lo pide explícitamente) — sin esto, remark-math no lo
// reconoce como fórmula y se ve el código LaTeX en crudo en pantalla. Red de
// seguridad: si el texto tiene pinta de LaTeX (comandos \algo) pero no lleva
// ningún $ todavía, se envuelve entero. No toca nada si ya viene bien formado.
const LATEX_HINT = /\\(left|right|frac|cdot|div|times|sqrt|left|sum|int|leq|geq|neq|infty|pm)\b|\^\{|_\{/

export function ensureMathDelimiters(text) {
  if (!text || typeof text !== 'string') return text
  if (!text.includes('$') && LATEX_HINT.test(text)) return `$${text}$`
  return marcarExponentes(text)
}

// ── Exponentes sueltos ────────────────────────────────────────────────────
// El apunte llega muchas veces con el exponente escrito con el acento
// circunflejo y FUERA de fórmula: "x · 10^n". remark-math no toca eso, así que
// el alumno veía "10^n" en crudo cuando en su libreta la n va pequeñita
// arriba. Se convierte en fórmula ($10^{n}$) y ya lo pinta KaTeX, el mismo
// motor que dibuja bien las raíces.
const EXPONENTE_RE = /([A-Za-z0-9]+|\)|\])\^(\{[^{}\n]{1,24}\}|[+-]?[A-Za-z0-9]{1,4})/g

// Las fórmulas que YA vienen entre $...$ (o $$...$$) se saltan enteras: ahí
// dentro el ^ ya es un exponente de verdad y volver a envolverlo la rompería.
const FORMULA_RE = /(\$\$[\s\S]*?\$\$|\$[^$\n]*\$)/g

export function marcarExponentes(texto) {
  return String(texto ?? '')
    .split(FORMULA_RE)
    .map((trozo, i) => (i % 2
      ? trozo
      : trozo.replace(EXPONENTE_RE, (_, base, exp) =>
          `$${base}^{${exp.replace(/^\{|\}$/g, '')}}$`)))
    .join('')
}
