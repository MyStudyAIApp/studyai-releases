# StudyAI

Asistente de estudio con IA local. Genera resúmenes, esquemas, flashcards, exámenes y más a partir de tus PDFs.

## Instalación rápida (Windows)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install.ps1
```

## Inicio manual

```bash
# Terminal 1 — servicio Python
cd python-service
pip install -r requirements.txt
python main.py

# Terminal 2 — app Electron
npm install
npm run dev
```

## Requisitos

- Windows 10/11
- Node.js 18+
- Python 3.10+
- [Ollama](https://ollama.com/download)
- RAM: 16 GB recomendado (32 GB óptimo)
- GPU: NVIDIA con CUDA (opcional pero muy recomendado)

## Modelos

| Modelo | Uso | Tamaño |
|--------|-----|--------|
| gemma3:12b | Principal — resúmenes, español | ~7 GB |
| gemma3:4b | Imágenes, geometría | ~3 GB |
| deepseek-r1:8b | Matemáticas, física | ~5 GB |

```bash
node scripts/pull-models.js
```

## Funcionalidades

- Resumen estructurado con puntos clave y vocabulario
- Esquema visual (Mermaid) y mapa conceptual
- Glosario automático y hoja de fórmulas
- Flashcards con repetición espaciada SM-2 (estilo Anki)
- Texto con huecos (Cloze)
- Examen tipo test, desarrollo y simulacro cronometrado
- Examen adaptativo (prioriza tus puntos débiles)
- Problemas resueltos paso a paso y generador de nuevos problemas
- Línea del tiempo y conexiones entre temas
- Plan de estudio por fecha de examen
- Comparar PDFs
- Búsqueda semántica en todos los documentos
- OCR para documentos escaneados y fotos de apuntes
- Voz: habla para hacer preguntas sobre el PDF (Whisper)
- Lectura en voz alta (TTS)
- Estadísticas de progreso con gráficas
- Exportar a Word / PDF
- Imprimir con layout limpio
- Modo nocturno
