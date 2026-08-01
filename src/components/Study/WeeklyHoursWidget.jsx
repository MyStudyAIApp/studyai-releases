import { IconChevronUp, IconChevronDown } from '@tabler/icons-react'

const DAYS = [
  { key: 'mon', label: 'L' , full: 'Lunes'     },
  { key: 'tue', label: 'M' , full: 'Martes'    },
  { key: 'wed', label: 'X' , full: 'Miércoles' },
  { key: 'thu', label: 'J' , full: 'Jueves'    },
  { key: 'fri', label: 'V' , full: 'Viernes'   },
  { key: 'sat', label: 'S' , full: 'Sábado'    },
  { key: 'sun', label: 'D' , full: 'Domingo'   },
]

export const DEFAULT_WEEKLY_HOURS = { mon: 2, tue: 2, wed: 2, thu: 2, fri: 2, sat: 3, sun: 3 }
export const LS_KEY = 'studyai_weekly_study_hours'

export function loadWeeklyHours() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { ...DEFAULT_WEEKLY_HOURS }
    return { ...DEFAULT_WEEKLY_HOURS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_WEEKLY_HOURS }
  }
}

export function saveWeeklyHours(hours) {
  localStorage.setItem(LS_KEY, JSON.stringify(hours))
}

export function weeklyHoursTotal(hours) {
  return Object.values(hours).reduce((s, h) => s + h, 0)
}

export function weeklyHoursToPromptText(hours) {
  const parts = DAYS
    .map(d => `${d.full} ${hours[d.key]}h`)
    .join(', ')
  return `${parts}. Total semanal: ${weeklyHoursTotal(hours)}h`
}

/**
 * Widget compacto reutilizable.
 * compact=true  → versión pequeña para ActionPanel / modales
 * compact=false → versión más grande para Ajustes
 */
export default function WeeklyHoursWidget({ hours, onChange, compact = false }) {
  function adjust(key, delta) {
    const next = Math.min(12, Math.max(0, (hours[key] ?? 0) + delta))
    onChange({ ...hours, [key]: next })
  }

  const total = weeklyHoursTotal(hours)

  if (compact) {
    return (
      <div>
        <div className="flex gap-1">
          {DAYS.map(d => {
            const h = hours[d.key] ?? 0
            const isRest = h === 0
            return (
              <div key={d.key} className="flex-1 flex flex-col items-center gap-0.5">
                <span className={`text-[9px] font-medium uppercase tracking-wide
                  ${isRest ? 'text-slate-600' : 'text-slate-400'}`}>
                  {d.label}
                </span>
                <button
                  type="button"
                  onClick={() => adjust(d.key, 1)}
                  className="w-full text-[10px] text-slate-500 hover:text-slate-300 leading-none py-0.5"
                ><IconChevronUp size={12} className="mx-auto" /></button>
                <span className={`text-sm font-bold tabular-nums leading-none
                  ${isRest ? 'text-slate-600' : 'text-slate-100'}`}>
                  {h}
                </span>
                <button
                  type="button"
                  onClick={() => adjust(d.key, -1)}
                  disabled={h === 0}
                  className="w-full text-[10px] text-slate-500 hover:text-slate-300 leading-none py-0.5 disabled:opacity-30"
                ><IconChevronDown size={12} className="mx-auto" /></button>
              </div>
            )
          })}
        </div>
        <p className="text-[10px] text-slate-500 text-center mt-1">
          {total}h/semana · 0 = día libre
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-7 gap-2">
        {DAYS.map(d => {
          const h = hours[d.key] ?? 0
          const isRest = h === 0
          return (
            <div key={d.key}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-colors
                ${isRest
                  ? 'bg-slate-800/40 border-slate-700/40'
                  : 'bg-slate-800 border-slate-600'}`}
            >
              <span className={`text-[10px] font-semibold uppercase tracking-wide
                ${isRest ? 'text-slate-600' : 'text-slate-300'}`}>
                {d.label}
              </span>
              <button
                type="button"
                onClick={() => adjust(d.key, 1)}
                className="text-slate-500 hover:text-primary-400 transition-colors text-xs leading-none px-2 py-1"
              >▲</button>
              <div className="text-center">
                <span className={`text-xl font-bold tabular-nums
                  ${isRest ? 'text-slate-600' : 'text-slate-100'}`}>
                  {h}
                </span>
                <p className={`text-[9px] ${isRest ? 'text-slate-700' : 'text-slate-500'}`}>h</p>
              </div>
              <button
                type="button"
                onClick={() => adjust(d.key, -1)}
                disabled={h === 0}
                className="text-slate-500 hover:text-red-400 transition-colors text-xs leading-none px-2 py-1 disabled:opacity-25"
              >▼</button>
              {isRest && (
                <span className="text-[8px] text-slate-700 font-medium">libre</span>
              )}
            </div>
          )
        })}
      </div>
      <p className="text-xs text-slate-500 mt-3 text-center">
        <span className="text-slate-300 font-semibold">{total}h</span> disponibles esta semana ·
        Pon 0 en los días que no puedes estudiar
      </p>
    </div>
  )
}
