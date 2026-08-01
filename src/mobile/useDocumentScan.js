import { useState } from 'react'
import { DocumentScanner } from '@capacitor-mlkit/document-scanner'

// Comprueba/instala el módulo de escaneo de Google (ML Kit, ~10 MB, solo la
// primera vez) y lanza el escáner: detecta bordes, corrige perspectiva y
// mejora el contraste automáticamente — a diferencia de una foto de cámara
// normal, que llega torcida/con sombras y es peor para que la IA la lea.
export function useDocumentScan() {
  const [installing, setInstalling] = useState(false)
  const [installProgress, setInstallProgress] = useState(0)

  const ensureModule = async () => {
    const { available } = await DocumentScanner.isGoogleDocumentScannerModuleAvailable()
    if (available) return

    setInstalling(true)
    setInstallProgress(0)
    await new Promise((resolve, reject) => {
      let listener
      DocumentScanner.addListener(
        'googleDocumentScannerModuleInstallProgress',
        (e) => {
          setInstallProgress(Math.round(e.progress ?? 0))
          if (e.state === 4 /* COMPLETED */) {
            setInstalling(false)
            listener.remove()
            resolve()
          } else if (e.state === 5 /* FAILED */) {
            setInstalling(false)
            listener.remove()
            reject(new Error('No se pudo descargar el escáner'))
          }
        }
      ).then(l => {
        listener = l
        DocumentScanner.installGoogleDocumentScannerModule()
      })
    })
  }

  // Devuelve el resultado del escaneo, o null si el usuario canceló.
  const scan = async (options) => {
    await ensureModule()
    const result = await DocumentScanner.scanDocument(options)
    return result.scannedImages?.length ? result : null
  }

  return { scan, installing, installProgress }
}
