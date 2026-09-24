import { reescalar } from '../mobile/scanUpload'

// El mismo escáner de documentos de Google (ML Kit) que usa MyStudy Scan:
// detecta los bordes de la hoja, endereza la perspectiva y mejora el
// contraste. Para "Hacer foto" en Inicio y el Cuaderno de MyStudy App.
//
// Devuelve:
//   null → no hay escáner (web, o app sin el plugin): usar <input capture>.
//   []   → el alumno canceló.
//   [File, ...] → una por página, ya reescaladas (como en Scan).
export async function escanearPaginas({ pageLimit = 25 } = {}) {
  if (!window.Capacitor?.isPluginAvailable?.('DocumentScanner')) return null
  const { DocumentScanner } = await import('@capacitor-mlkit/document-scanner')
  const { Filesystem } = await import('@capacitor/filesystem')

  // El módulo (~10 MB) es de Google Play y compartido por todo el móvil: si
  // Scan ya lo usó, está. Si no, se descarga la primera vez.
  const { available } = await DocumentScanner.isGoogleDocumentScannerModuleAvailable()
  if (!available) {
    await new Promise((resolve, reject) => {
      DocumentScanner.addListener('googleDocumentScannerModuleInstallProgress', (e) => {
        if (e.state === 4) resolve()          // COMPLETED
        else if (e.state === 5) reject(new Error('module install failed'))
      }).then(() => DocumentScanner.installGoogleDocumentScannerModule())
    })
  }

  let result
  try {
    result = await DocumentScanner.scanDocument({
      pageLimit, galleryImportAllowed: true, resultFormats: 'JPEG', scannerMode: 'FULL',
    })
  } catch (e) {
    if (/cancel/i.test(e?.message || '')) return []
    throw e
  }

  const files = []
  for (const [i, path] of (result.scannedImages || []).entries()) {
    const { data } = await Filesystem.readFile({ path })
    const blob = await reescalar(data)
    files.push(new File([blob], `pagina-${i + 1}.jpg`, { type: 'image/jpeg' }))
  }
  return files
}
