import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { glob } from 'glob'

// Plugin: inyecta polyfill de URL.parse al principio del worker de pdfjs.
// Necesario para Electron 28 (Chrome 120), que no tiene URL.parse() pero
// pdfjs-dist 5.x lo usa internamente en el Web Worker.
// El polyfill se añade DENTRO del archivo del worker (contexto aislado del main thread).
function patchPdfjsWorkerPlugin() {
  return {
    name: 'patch-pdfjs-worker-url-parse',
    apply: 'build',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist', 'assets')
      if (!fs.existsSync(distDir)) return

      // Buscar el archivo worker copiado por Vite (puede tener hash en el nombre)
      const files = fs.readdirSync(distDir)
      const workerFile = files.find(f => f.startsWith('pdf.worker') && f.endsWith('.mjs'))
      if (!workerFile) {
        console.warn('[patch-pdfjs-worker] No se encontró pdf.worker*.mjs en dist/assets/')
        return
      }

      const workerPath = path.join(distDir, workerFile)
      const content = fs.readFileSync(workerPath, 'utf8')

      const polyfill =
        '/* polyfill URL.parse — Electron 28 / Chrome 120 */\n' +
        'if(typeof URL!=="undefined"&&typeof URL.parse==="undefined"){' +
        'URL.parse=function(u,b){try{return new URL(u,b)}catch(e){return null}};}\n'

      // Solo parchear si aún no tiene el polyfill (idempotente)
      if (!content.startsWith('/* polyfill URL.parse')) {
        fs.writeFileSync(workerPath, polyfill + content)
        console.log(`[patch-pdfjs-worker] Polyfill inyectado en ${workerFile}`)
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), patchPdfjsWorkerPlugin()],
  base: './',
  root: 'src',
  envDir: '..',  // los .env viven en la raíz del proyecto, no dentro de src/
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: true,  // Source maps para Sentry — muestra nombres reales de componentes en los errores
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 5173,
    strictPort: true,
  },
})
