// Lockup de marca: "MyStudy" + marca gráfica (gorro de graduación) + "AI".
// El SVG es el mismo diseño que assets/icon.svg pero sin el fondo cuadrado —
// solo el gorro, para usarlo en línea junto al texto.
// `subtitle` opcional: texto debajo del lockup, mismo tamaño y color blanco que "AI" (ej. "Scan" para la app móvil de escaneo).
import { useId } from 'react'

export default function Logo({ size = 'md', className = '', subtitle = '' }) {
  const uid = useId()
  const sizes = {
    sm: { text: 'text-sm',   icon: 20, gap: 'gap-1'   },
    md: { text: 'text-xl',   icon: 28, gap: 'gap-1.5' },
    lg: { text: 'text-3xl',  icon: 40, gap: 'gap-2'   },
    xl: { text: 'text-4xl',  icon: 50, gap: 'gap-2.5' },
  }
  const s = sizes[size] || sizes.md

  if (subtitle) {
    return (
      <span className={`inline-flex flex-col items-center ${className}`}>
        <Logo size={size} />
        <span className={`text-slate-100 font-bold ${s.text} tracking-wide`}>{subtitle}</span>
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center ${s.gap} font-bold ${s.text} ${className}`}>
      <span className="text-primary-400">MyStudy</span>
      <svg width={s.icon} height={s.icon} viewBox="0 0 256 256" className="shrink-0" aria-hidden="true">
        <defs>
          <linearGradient id={`logoBoardTop-${uid}`} x1="38" y1="78" x2="218" y2="122" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#c4b5fd"/>
            <stop offset="100%" stopColor="#7c3aed"/>
          </linearGradient>
          <linearGradient id={`logoBoardSide-${uid}`} x1="0" y1="120" x2="0" y2="144" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6d28d9"/>
            <stop offset="100%" stopColor="#4c1d95"/>
          </linearGradient>
          <linearGradient id={`logoCapBody-${uid}`} x1="0" y1="140" x2="0" y2="180" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7c3aed"/>
            <stop offset="100%" stopColor="#4c1d95"/>
          </linearGradient>
        </defs>

        <g transform="translate(0,-18)">
          <path d="M 90,143 C 87,160 88,176 94,190 Q 100,203 128,203 Q 156,203 162,190 C 168,176 169,160 166,143 Z"
                fill={`url(#logoCapBody-${uid})`}/>
          <path d="M 94,190 Q 100,203 128,203 Q 156,203 162,190"
                fill="none" stroke="#3b0764" strokeWidth="7" strokeLinecap="round" opacity="0.7"/>
          <ellipse cx="128" cy="143" rx="40" ry="11" fill="#6d28d9"/>
        </g>

        <polygon points="38,100 128,136 128,144 38,108" fill={`url(#logoBoardSide-${uid})`}/>
        <polygon points="218,100 128,136 128,144 218,108" fill="#5b21b6"/>
        <polygon points="128,64 218,100 128,136 38,100" fill={`url(#logoBoardTop-${uid})`}/>
        <polygon points="128,64 218,100 128,108 38,100" fill="#ddd6fe" opacity="0.30"/>

        <circle cx="128" cy="100" r="9" fill="white" opacity="0.95"/>
        <circle cx="128" cy="100" r="5" fill="#a78bfa"/>

        <path d="M 136,100 L 196,100 L 196,162" stroke="#fbbf24" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="196" cy="162" r="10" fill="#f59e0b"/>
        <circle cx="196" cy="162" r="6" fill="#fbbf24"/>
        <line x1="184" y1="168" x2="180" y2="190" stroke="#f59e0b" strokeWidth="3.5" strokeLinecap="round"/>
        <line x1="189" y1="170" x2="186" y2="193" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round"/>
        <line x1="195" y1="171" x2="193" y2="194" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round"/>
        <line x1="201" y1="170" x2="202" y2="193" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round"/>
        <line x1="207" y1="168" x2="211" y2="190" stroke="#f59e0b" strokeWidth="3.5" strokeLinecap="round"/>
      </svg>
      <span className="text-slate-100">AI</span>
    </span>
  )
}
