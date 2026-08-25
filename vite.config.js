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

// Plugin: saca los source maps de dist/ despues del build.
// Cloudflare Pages publica TODO lo que hay en dist/, asi que dejar los .map
// ahi equivale a publicar el codigo fuente completo del frontend en
// mystudyai.eu/assets/*.map (comprobado, devolvia 200). Se siguen generando
// porque Sentry los necesita para mostrar nombres reales en los errores, pero
// se mueven a sourcemaps/ para subirlos a Sentry aparte, no a la web.
function moveSourcemapsOutOfDistPlugin() {
  return {
    name: 'move-sourcemaps-out-of-dist',
    apply: 'build',
    closeBundle() {
      const distAssets = path.resolve(__dirname, 'dist', 'assets')
      const destino = path.resolve(__dirname, 'sourcemaps')
      if (!fs.existsSync(distAssets)) return

      const mapas = fs.readdirSync(distAssets).filter(f => f.endsWith('.map'))
      if (mapas.length === 0) return

      fs.rmSync(destino, { recursive: true, force: true })
      fs.mkdirSync(destino, { recursive: true })
      for (const m of mapas) {
        fs.renameSync(path.join(distAssets, m), path.join(destino, m))
      }
      console.log(`[sourcemaps] ${mapas.length} .map movidos a sourcemaps/ (fuera de dist/, no se publican)`)
    },
  }
}

export default defineConfig({
  // El orden importa: moveSourcemaps va el ultimo para que el parche de pdfjs
  // ya haya terminado de tocar dist/assets antes de vaciar los .map.
  plugins: [react(), patchPdfjsWorkerPlugin(), moveSourcemapsOutOfDistPlugin()],
  base: './',
  root: 'src',
  envDir: '..',  // los .env viven en la raíz del proyecto, no dentro de src/
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    // 'hidden' = se generan los .map pero SIN el comentario //# sourceMappingURL
    // al final del bundle, asi que nada apunta a ellos desde la web. Sentry los
    // sigue necesitando: ver moveSourcemapsOutOfDistPlugin, que los saca de dist/.
    sourcemap: 'hidden',
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
