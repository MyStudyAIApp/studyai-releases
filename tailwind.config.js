/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,jsx,ts,tsx,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // primary y slate se resuelven mediante variables CSS (ver src/styles/index.css)
        // para poder cambiar de plantilla visual (Ajustes → Apariencia) sin tocar clases.
        primary: {
          50:  'rgb(var(--primary-50) / <alpha-value>)',
          100: 'rgb(var(--primary-100) / <alpha-value>)',
          200: 'rgb(var(--primary-200) / <alpha-value>)',
          300: 'rgb(var(--primary-300) / <alpha-value>)',
          400: 'rgb(var(--primary-400) / <alpha-value>)',
          500: 'rgb(var(--primary-500) / <alpha-value>)',
          600: 'rgb(var(--primary-600) / <alpha-value>)',
          700: 'rgb(var(--primary-700) / <alpha-value>)',
          800: 'rgb(var(--primary-800) / <alpha-value>)',
          900: 'rgb(var(--primary-900) / <alpha-value>)',
        },
        slate: {
          50:  'rgb(var(--slate-50) / <alpha-value>)',
          100: 'rgb(var(--slate-100) / <alpha-value>)',
          200: 'rgb(var(--slate-200) / <alpha-value>)',
          300: 'rgb(var(--slate-300) / <alpha-value>)',
          400: 'rgb(var(--slate-400) / <alpha-value>)',
          500: 'rgb(var(--slate-500) / <alpha-value>)',
          600: 'rgb(var(--slate-600) / <alpha-value>)',
          700: 'rgb(var(--slate-700) / <alpha-value>)',
          800: 'rgb(var(--slate-800) / <alpha-value>)',
          900: 'rgb(var(--slate-900) / <alpha-value>)',
          950: 'rgb(var(--slate-950) / <alpha-value>)',
        },
        surface: {
          light: '#ffffff',
          dark:  '#0f172a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'flip-in':  'flipIn 0.4s ease-in-out',
        'flip-out': 'flipOut 0.4s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-in':  'fadeIn 0.2s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
      },
      keyframes: {
        flipIn:  { '0%': { transform: 'rotateY(90deg)', opacity: '0' }, '100%': { transform: 'rotateY(0deg)', opacity: '1' } },
        flipOut: { '0%': { transform: 'rotateY(0deg)', opacity: '1' }, '100%': { transform: 'rotateY(-90deg)', opacity: '0' } },
        slideIn: { '0%': { transform: 'translateX(-10px)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
        fadeIn:  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        // ── Landing page: demo animada del hero (drag & drop + clic) ──────────
        dragIn:     { '0%': { transform: 'translate(70px, -50px) rotate(10deg)', opacity: '0' }, '40%': { opacity: '1' }, '100%': { transform: 'translate(0,0) rotate(0deg)', opacity: '1' } },
        cursorMove: { '0%': { transform: 'translate(26px, 26px)', opacity: '0' }, '20%': { opacity: '1' }, '100%': { transform: 'translate(0,0)', opacity: '1' } },
        swipeDown:  { '0%': { transform: 'translateY(-30px)', opacity: '0' }, '20%': { opacity: '1' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        clickPulse: { '0%, 100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(0.92)' } },
        popIn:      { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        // ── Landing page: fondo con manchas de color a la deriva ──────────────
        drift:      { '0%, 100%': { transform: 'translate(0,0) scale(1)' }, '50%': { transform: 'translate(30px, 50px) scale(1.12)' } },
      },
    },
  },
  plugins: [],
}
