import { CURRENT_PLATFORM, platformLabel, diasParaBorrar } from '../../lib/retention'

// Aviso "se borra en X días" para documentos (PDFs en Biblioteca) y
// ejercicios (Resolver) -- desaparece del todo si ya se descargó desde ESTA
// misma plataforma; si se descargó desde otra, se mantiene pero avisando
// dónde está esa copia, para no dar una falsa sensación de seguridad en un
// dispositivo que en realidad no tiene el archivo.
export default function RetentionChip({ createdAt, retentionDays = 10, downloadedAt, downloadedPlatform }) {
  if (downloadedAt && downloadedPlatform === CURRENT_PLATFORM) return null

  const dias = diasParaBorrar(createdAt, retentionDays)
  const base = dias === 0 ? 'se borra hoy' : `se borra en ${dias} día${dias === 1 ? '' : 's'}`
  const text = downloadedAt ? `${base} · ya descargado en ${platformLabel(downloadedPlatform)}` : base

  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap ${dias <= 2 && !downloadedAt ? 'bg-red-500/15 text-red-300' : 'bg-slate-700/60 text-slate-400'}`}>
      {text}
    </span>
  )
}
