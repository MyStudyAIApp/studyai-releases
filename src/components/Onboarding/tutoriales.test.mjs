// Los tutoriales viven repartidos en TRES sitios que tienen que decir lo mismo:
// la lista de secciones de Ajustes, los pasos de OnboardingTutorial y las
// etiquetas de los 4 idiomas. Una seccion en la lista SIN pasos no es un
// detalle: el tour abre con STEPS[0] vacio y revienta la pantalla.
//
// Ejecutar:  node src/components/Onboarding/tutoriales.test.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const aqui = dirname(fileURLToPath(import.meta.url))
const src = join(aqui, '..', '..')
const leer = (...p) => readFileSync(join(src, ...p), 'utf8')

const ajustes = leer('pages', 'SettingsPage.jsx')
const tour = leer('components', 'Onboarding', 'OnboardingTutorial.jsx')

const claves = [...ajustes
  .match(/const TUTORIAL_SECTION_KEYS = \[([\s\S]*?)\]/)[1]
  .matchAll(/'([\w-]+)'/g)].map(m => m[1])

const conPasos = new Set([...tour.matchAll(/section:\s*'([\w-]+)'/g)].map(m => m[1]))
const conIcono = new Set([...tour
  .match(/const SECTION_ICONS = \{([\s\S]*?)\n\}/)[1]
  .matchAll(/^\s{2}([\w-]+):/gm)].map(m => m[1]))

const casos = {
  'hay secciones'() {
    assert.ok(claves.length >= 12, 'se leyeron ' + claves.length)
  },

  'cada seccion de Ajustes tiene pasos'() {
    const sin = claves.filter(k => !conPasos.has(k))
    assert.deepEqual(sin, [], 'secciones sin ningun paso: ' + sin.join(', '))
  },

  'cada seccion tiene icono'() {
    const sin = claves.filter(k => !conIcono.has(k))
    assert.deepEqual(sin, [], 'secciones sin icono: ' + sin.join(', '))
  },

  'no hay pasos huerfanos'() {
    const sobran = [...conPasos].filter(s => !claves.includes(s))
    assert.deepEqual(sobran, [], 'pasos de una seccion que no esta en Ajustes: ' + sobran.join(', '))
  },

  'cada seccion tiene etiqueta en los 4 idiomas'() {
    for (const lang of ['es', 'en', 'de', 'fr']) {
      const secs = JSON.parse(leer('i18n', 'locales', `${lang}.json`)).settings.tutorials.sections
      const sin = claves.filter(k => !secs[k]?.label)
      assert.deepEqual(sin, [], `${lang}: sin etiqueta -> ${sin.join(', ')}`)
    }
  },
}

let fallos = 0
for (const [nombre, prueba] of Object.entries(casos)) {
  try { prueba(); console.log('ok  -', nombre) }
  catch (e) { fallos++; console.error('FALLA -', nombre, '\n   ', e.message) }
}
process.exit(fallos ? 1 : 0)
