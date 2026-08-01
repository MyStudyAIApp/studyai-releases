#!/usr/bin/env node
/**
 * Pull all required Ollama models.
 * Usage: node scripts/pull-models.js
 */
const { execSync } = require('child_process')

const MODELS = [
  { id: 'gemma3:4b',       label: 'Gemma 3 4B (multimodal)' },
  { id: 'gemma3:12b',      label: 'Gemma 3 12B (principal)' },
  { id: 'deepseek-r1:8b',  label: 'DeepSeek R1 8B (razonamiento)' },
]

console.log('\n📥 Descargando modelos de IA para StudyAI...\n')

for (const model of MODELS) {
  console.log(`⟳  ${model.label} (${model.id})`)
  try {
    execSync(`ollama pull ${model.id}`, { stdio: 'inherit' })
    console.log(`✓  ${model.id} listo\n`)
  } catch (e) {
    console.error(`✗  Error descargando ${model.id}:`, e.message)
  }
}

console.log('✅ Modelos listos. Puedes iniciar StudyAI con: npm run dev\n')
