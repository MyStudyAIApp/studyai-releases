const { app, BrowserWindow, ipcMain, dialog, shell, session, clipboard, Tray, Menu, Notification } = require('electron')
const path = require('path')
const { spawn, execSync } = require('child_process')
const crypto = require('crypto')
const http = require('http')
const https = require('https')
const fs = require('fs')
const os = require('os')
const { autoUpdater } = require('electron-updater')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
const PYTHON_PORT = 8765
let pythonProcess = null
let mainWindow = null
let tray = null
let isQuitting = false

// Token secreto generado en cada arranque — el backend local (main.py) exige
// esta cabecera en toda petición. Sin esto, cualquier página web abierta en
// el navegador del usuario podría hacer fetch() a http://127.0.0.1:8765 y
// leer/generar contenido a través de la sesión ya iniciada en la app
// (ataque CSRF/DNS-rebinding contra un servidor local sin autenticación
// propia). El renderer lo obtiene vía IPC (contextBridge), nunca expuesto a
// una página web arbitraria.
const LOCAL_AUTH_TOKEN = crypto.randomBytes(32).toString('hex')

// Fija la carpeta de datos de usuario (AppData\Roaming\StudyAI\) al nombre técnico
// original aunque el nombre visible de la app cambie a "MyStudy AI" (branding,
// julio 2026). Sin esto, Electron usaría el nuevo nombre para userData y los
// usuarios existentes perderían su base de datos local y el modelo de Whisper
// descargado al actualizar.
app.setName('StudyAI')

// ── Protocolo mystudyai:// — deep link de vuelta tras login con Google ─────────
// El instalador (NSIS, ver "protocols" en package.json) registra el esquema en
// Windows. Cuando el navegador del sistema redirige a mystudyai://auth-callback,
// Windows relanza este exe con la URL como argumento — con el lock de instancia
// única, ese relanzamiento se detecta como "second-instance" y reenviamos la URL
// a la ventana ya abierta en vez de abrir una segunda.
const DEEP_LINK_SCHEME = 'mystudyai'
if (!app.isDefaultProtocolClient(DEEP_LINK_SCHEME)) {
  app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME)
}

function extractDeepLink(argv) {
  return argv.find(a => a.startsWith(DEEP_LINK_SCHEME + '://'))
}

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const url = extractDeepLink(argv)
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
      if (url) mainWindow.webContents.send('deep-link', url)
    }
  })
}

// macOS entrega la URL por este evento en vez de argv
app.on('open-url', (event, url) => {
  event.preventDefault()
  if (mainWindow) mainWindow.webContents.send('deep-link', url)
})

// Desactivar aceleración GPU — evita pantalla azul en equipos con drivers
// problemáticos (NVIDIA, AMD). No afecta funcionalidad, solo usa renderizado
// por software en lugar de GPU hardware.
app.disableHardwareAcceleration()

// ── Rutas de recursos ────────────────────────────────────────────────────────

function getResourcesPath() {
  // En producción: carpeta resources/ junto al ejecutable de Electron
  // En desarrollo: carpeta raíz del proyecto
  return isDev
    ? path.join(__dirname, '..')
    : process.resourcesPath
}

// Carpeta de datos del usuario — PERSISTE entre actualizaciones (no se borra al actualizar)
// AppData\Roaming\StudyAI\  en Windows
function getUserDataPath() {
  return app.getPath('userData')
}

// Carpeta donde se guarda el modelo Whisper descargado.
// DEBE estar en userData para sobrevivir actualizaciones.
function getWhisperUserDataDir() {
  return path.join(getUserDataPath(), 'whisper-models', 'medium')
}

// Carpeta donde se guarda el "CUDA pack" (librerias NVIDIA cublas/cudnn)
// descargado bajo demanda -- el instalador ya NO las incluye (pesaban 1.9GB,
// solo las aprovecha quien tiene GPU NVIDIA compatible). Mismo patron que el
// modelo de Whisper: vive en userData para sobrevivir actualizaciones.
function getCudaPackUserDataDir() {
  return path.join(getUserDataPath(), 'cuda-pack')
}

// Al arrancar la app, copia los archivos pequeños de configuración de Whisper
// (config.json, tokenizer.json, vocabulary.txt) desde resources/ a userData/
// si todavía no están allí. model.bin NO se copia — es enorme y el usuario lo descarga.
function ensureWhisperConfigInUserData() {
  const srcDir  = path.join(getResourcesPath(), 'whisper-models', 'medium')
  const destDir = getWhisperUserDataDir()
  const configFiles = ['config.json', 'tokenizer.json', 'vocabulary.txt']

  fs.mkdirSync(destDir, { recursive: true })

  for (const f of configFiles) {
    const src  = path.join(srcDir, f)
    const dest = path.join(destDir, f)
    if (fs.existsSync(src) && !fs.existsSync(dest)) {
      try {
        fs.copyFileSync(src, dest)
        writeBackendLog(`[Whisper] Config copiado a userData: ${f}`)
      } catch (e) {
        writeBackendLog(`[Whisper] Error al copiar ${f}: ${e.message}`)
      }
    }
  }

  // Migración: si model.bin está en la ruta antigua (resources/), moverlo a userData
  const oldModel  = path.join(getResourcesPath(), 'whisper-models', 'medium', 'model.bin')
  const newModel  = path.join(destDir, 'model.bin')
  if (fs.existsSync(oldModel) && !fs.existsSync(newModel)) {
    try {
      writeBackendLog('[Whisper] Migrando model.bin de resources/ a userData/ …')
      fs.renameSync(oldModel, newModel)
      writeBackendLog('[Whisper] Migración completada')
    } catch (e) {
      writeBackendLog(`[Whisper] Error en migración (se intentará copiar): ${e.message}`)
      // Si rename falla (discos distintos), copiar y borrar
      try {
        fs.copyFileSync(oldModel, newModel)
        fs.unlinkSync(oldModel)
        writeBackendLog('[Whisper] Migración por copia completada')
      } catch (e2) {
        writeBackendLog(`[Whisper] Migración fallida: ${e2.message}`)
      }
    }
  }
}

function getBackendPath() {
  const res = getResourcesPath()
  if (isDev) return null  // en dev usamos Python directamente
  // PyInstaller crea backend/backend.exe dentro de resources/
  return path.join(res, 'backend', 'backend.exe')
}

function getPythonServicePath() {
  return isDev
    ? path.join(__dirname, '..', 'python-service')
    : path.join(getResourcesPath(), 'python-service')
}

function getPythonExecutable() {
  // Solo en desarrollo — en producción usamos backend.exe
  const py312 = 'C:\\Users\\rinco\\AppData\\Local\\Programs\\Python\\Python312\\python.exe'
  if (fs.existsSync(py312)) return py312
  return 'python'
}

// ── Matar procesos zombie en el puerto 8765 ──────────────────────────────────

function killZombiesOnPort(port) {
  try {
    // netstat para encontrar el PID que usa el puerto
    const out = execSync(
      `netstat -ano | findstr :${port}`,
      { encoding: 'utf8', windowsHide: true }
    ).trim()

    const pids = new Set()
    for (const line of out.split('\n')) {
      const parts = line.trim().split(/\s+/)
      const lastPart = parts[parts.length - 1]
      const pid = parseInt(lastPart, 10)
      if (pid && pid > 4) pids.add(pid)   // 0-4 son procesos del sistema
    }

    for (const pid of pids) {
      try {
        execSync(`taskkill /F /PID ${pid}`, { windowsHide: true })
        console.log(`[Electron] Killed zombie PID ${pid} on port ${port}`)
      } catch {}
    }
  } catch {
    // Si no hay nada en el puerto, netstat devuelve vacío → error normal, ignorar
  }
}

// ── Arrancar el servicio Python / backend.exe ────────────────────────────────

// ── Log del backend a archivo (para diagnostico) ────────────────────────────

function getLogPath() {
  return path.join(app.getPath('userData'), 'backend.log')
}

let backendLogStream = null

function openBackendLog() {
  try {
    const logPath = getLogPath()
    backendLogStream = fs.createWriteStream(logPath, { flags: 'a' })
    backendLogStream.write('\n=== StudyAI backend start ' + new Date().toISOString() + ' ===\n')
  } catch (e) {
    console.error('[Electron] Cannot open backend log:', e.message)
  }
}

function writeBackendLog(line) {
  if (backendLogStream) {
    try { backendLogStream.write(line + '\n') } catch {}
  }
}

// ── Copias de seguridad ───────────────────────────────────────────────────────
// Los datos del usuario (BD + uploads) viven en ~/.studyai/.
// Las copias automáticas guardan SOLO la BD (pequeña, rápida).
// La exportación manual hace un ZIP con BD + uploads.

const STUDYAI_DATA_DIR = path.join(os.homedir(), '.studyai')
const BACKUP_DIR       = path.join(STUDYAI_DATA_DIR, 'backups')
const BACKUP_LOG_FILE  = path.join(BACKUP_DIR, 'backup-log.json')
const DB_FILE          = path.join(STUDYAI_DATA_DIR, 'studyai.db')
const UPLOADS_DIR_PATH = path.join(STUDYAI_DATA_DIR, 'uploads')
const MAX_AUTO_BACKUPS = 5   // copias automáticas a conservar

function getLastBackupDate() {
  try {
    if (!fs.existsSync(BACKUP_LOG_FILE)) return null
    const log = JSON.parse(fs.readFileSync(BACKUP_LOG_FILE, 'utf8'))
    return log.lastBackup ? new Date(log.lastBackup) : null
  } catch { return null }
}

function updateBackupLog(entry) {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
    let log = {}
    if (fs.existsSync(BACKUP_LOG_FILE)) {
      try { log = JSON.parse(fs.readFileSync(BACKUP_LOG_FILE, 'utf8')) } catch {}
    }
    log.lastBackup = new Date().toISOString()
    log.history = log.history || []
    log.history.unshift(entry)
    log.history = log.history.slice(0, 20)
    fs.writeFileSync(BACKUP_LOG_FILE, JSON.stringify(log, null, 2))
  } catch (e) {
    writeBackendLog('[Backup] Error actualizando log: ' + e.message)
  }
}

function pruneOldBackups() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return
    const entries = fs.readdirSync(BACKUP_DIR)
      .filter(n => n.startsWith('auto_') || n.startsWith('pre-update_'))
      .map(n => ({ name: n, mtime: fs.statSync(path.join(BACKUP_DIR, n)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)
    for (const e of entries.slice(MAX_AUTO_BACKUPS)) {
      try { fs.rmSync(path.join(BACKUP_DIR, e.name), { recursive: true, force: true }) } catch {}
    }
  } catch {}
}

function createDbBackup(reason) {
  if (!fs.existsSync(DB_FILE)) {
    writeBackendLog('[Backup] No existe BD — omitiendo copia')
    return { ok: false, reason: 'no-db' }
  }
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
    const now    = new Date()
    const stamp  = now.toISOString().slice(0, 19).replace(/:/g, '-')
    const prefix = reason === 'pre-update' ? 'pre-update_' : reason === 'manual' ? 'manual_' : 'auto_'
    const name   = `${prefix}${stamp}`
    const dest   = path.join(BACKUP_DIR, name)
    fs.mkdirSync(dest, { recursive: true })
    fs.copyFileSync(DB_FILE, path.join(dest, 'studyai.db'))
    const sizeMB = Math.round(fs.statSync(DB_FILE).size / 1024 / 1024 * 10) / 10
    writeBackendLog(`[Backup] Copia creada (${reason}): ${name} (${sizeMB} MB)`)
    updateBackupLog({ name, reason, date: now.toISOString(), sizeMB })
    pruneOldBackups()
    return { ok: true, name, date: now.toISOString(), sizeMB }
  } catch (e) {
    writeBackendLog('[Backup] Error al crear copia: ' + e.message)
    return { ok: false, reason: e.message }
  }
}

function maybePeriodicBackup() {
  const last = getLastBackupDate()
  const days = last ? (Date.now() - last.getTime()) / (1000 * 60 * 60 * 24) : Infinity
  if (days >= 7) {
    writeBackendLog('[Backup] Copia periódica (último hace ' + Math.round(days) + ' días)')
    createDbBackup('periodic')
  } else {
    writeBackendLog('[Backup] Copia periódica no necesaria (último hace ' + Math.round(days) + ' días)')
  }
}

ipcMain.handle('backup:create', () => createDbBackup('manual'))

ipcMain.handle('backup:status', () => {
  try {
    let log = {}
    if (fs.existsSync(BACKUP_LOG_FILE)) {
      try { log = JSON.parse(fs.readFileSync(BACKUP_LOG_FILE, 'utf8')) } catch {}
    }
    const dbSizeMB = fs.existsSync(DB_FILE)
      ? Math.round(fs.statSync(DB_FILE).size / 1024 / 1024 * 10) / 10 : 0
    let uploadsMB = 0
    if (fs.existsSync(UPLOADS_DIR_PATH)) {
      const walkDir = (dir) => {
        try {
          for (const f of fs.readdirSync(dir)) {
            const p = path.join(dir, f)
            try { const s = fs.statSync(p); if (s.isDirectory()) walkDir(p); else uploadsMB += s.size / 1048576 } catch {}
          }
        } catch {}
      }
      walkDir(UPLOADS_DIR_PATH)
      uploadsMB = Math.round(uploadsMB * 10) / 10
    }
    return { ok: true, lastBackup: log.lastBackup || null, history: log.history || [], dbSizeMB, uploadsMB }
  } catch (e) {
    return { ok: false, reason: e.message }
  }
})

ipcMain.handle('backup:export', async () => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title:       'Exportar biblioteca MyStudy AI',
    defaultPath: path.join(os.homedir(), `MyStudyAI_Backup_${new Date().toISOString().slice(0,10)}.zip`),
    filters:     [{ name: 'ZIP', extensions: ['zip'] }],
  })
  if (canceled || !filePath) return { ok: false, reason: 'cancelled' }
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)

  const items = [DB_FILE, UPLOADS_DIR_PATH].filter(p => fs.existsSync(p))
  if (items.length === 0) return { ok: false, reason: 'no-data' }

  return new Promise((resolve) => {
    const itemsList = items.map(p => `'${p.replace(/'/g, "''")}'`).join(',')
    const cmd = `Compress-Archive -Path @(${itemsList}) -DestinationPath '${filePath.replace(/'/g, "''")}' -Force`
    writeBackendLog('[Backup] Exportando ZIP a ' + filePath)
    const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd], { windowsHide: true })
    let stderr = ''
    ps.stderr.on('data', d => { stderr += d.toString() })
    ps.on('close', code => {
      if (code === 0 && fs.existsSync(filePath)) {
        const sizeMB = Math.round(fs.statSync(filePath).size / 1024 / 1024 * 10) / 10
        writeBackendLog('[Backup] ZIP exportado: ' + sizeMB + ' MB')
        resolve({ ok: true, filePath, sizeMB })
      } else {
        writeBackendLog('[Backup] Error exportando ZIP: ' + (stderr || `exit ${code}`))
        resolve({ ok: false, reason: stderr || `exit code ${code}` })
      }
    })
  })
})

// ── Arrancar el servicio Python / backend.exe ────────────────────────────────

function startPythonService() {
  const backendExe = getBackendPath()
  const res = getResourcesPath()

  // Variables de entorno para rutas de recursos bundleados
  const resourceEnv = {
    ...process.env,
    PYTHONUNBUFFERED: '1',
    PYTHONIOENCODING: 'utf-8',   // evita crash con emojis en consola Windows (cp1252)
    PYTHONUTF8: '1',
    STUDYAI_WHISPER_MODEL_PATH: getWhisperUserDataDir(),
    STUDYAI_CUDA_PACK_PATH:     getCudaPackUserDataDir(),
    STUDYAI_FFMPEG_PATH:        path.join(res, 'ffmpeg', 'ffmpeg.exe'),
    STUDYAI_TESSERACT_PATH:     path.join(res, 'tesseract', 'tesseract.exe'),
    STUDYAI_LOCAL_TOKEN:        LOCAL_AUTH_TOKEN,
  }

  openBackendLog()

  if (!isDev && backendExe && fs.existsSync(backendExe)) {
    // ── PRODUCCIÓN: ejecutable PyInstaller ──
    console.log('[Electron] Starting backend.exe:', backendExe)
    writeBackendLog('[Electron] Starting backend.exe: ' + backendExe)
    pythonProcess = spawn(backendExe, ['--port', String(PYTHON_PORT), '--host', '127.0.0.1'], {
      cwd: path.dirname(backendExe),
      env: resourceEnv,
      windowsHide: true,
    })
  } else {
    // ── DESARROLLO: Python directo ──
    const servicePath = getPythonServicePath()
    const mainPy = path.join(servicePath, 'main.py')
    if (!fs.existsSync(mainPy)) {
      console.error('[Electron] Python service not found:', mainPy)
      writeBackendLog('[Electron] ERROR: Python service not found: ' + mainPy)
      return
    }
    console.log('[Electron] Starting Python (dev):', mainPy)
    pythonProcess = spawn(getPythonExecutable(), [mainPy, '--port', String(PYTHON_PORT)], {
      cwd: servicePath,
      env: resourceEnv,
    })
  }

  pythonProcess.stdout?.on('data', d => {
    const s = d.toString().trim()
    console.log('[Python]', s)
    writeBackendLog('[stdout] ' + s)
  })
  pythonProcess.stderr?.on('data', d => {
    const s = d.toString().trim()
    console.error('[Python ERR]', s)
    writeBackendLog('[stderr] ' + s)
  })
  pythonProcess.on('close', code => {
    const msg = '[Python] exited with code ' + code
    console.log(msg)
    writeBackendLog(msg)
  })
  pythonProcess.on('error', err => {
    const msg = '[Python] spawn error: ' + err.message
    console.error(msg)
    writeBackendLog(msg)
  })
}

function killPythonService() {
  if (pythonProcess) {
    try { pythonProcess.kill('SIGTERM') } catch {}
    // Forzar cierre del puerto por si acaso
    setTimeout(() => killZombiesOnPort(PYTHON_PORT), 500)
    pythonProcess = null
  }
}

// Espera hasta 3 minutos — PyInstaller puede tardar en el primer arranque
function waitForPython(retries = 180) {
  return new Promise((resolve, reject) => {
    const check = (n) => {
      http.get(`http://127.0.0.1:${PYTHON_PORT}/health`, (res) => {
        if (res.statusCode === 200) resolve()
        else if (n > 0) setTimeout(() => check(n - 1), 1000)
        else reject(new Error('Python service timeout after 3 min'))
      }).on('error', () => {
        if (n > 0) setTimeout(() => check(n - 1), 1000)
        else reject(new Error('Python service not responding after 3 min'))
      })
    }
    check(retries)
  })
}

// ── Ventana principal ────────────────────────────────────────────────────────

async function waitForVite(retries = 20) {
  return new Promise((resolve) => {
    const check = (n) => {
      http.get('http://localhost:5173', (res) => {
        if (res.statusCode < 500) resolve()
        else if (n > 0) setTimeout(() => check(n - 1), 500)
        else resolve()
      }).on('error', () => {
        if (n > 0) setTimeout(() => check(n - 1), 500)
        else resolve()
      })
    }
    check(retries)
  })
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    frame: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
  })

  // ── Diagnóstico: loguear crashes y fallos de carga del renderer ─────────────
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    const msg = '[Renderer] render-process-gone: reason=' + details.reason + ' exitCode=' + details.exitCode
    console.error(msg)
    writeBackendLog(msg)
  })
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    const msg = '[Renderer] did-fail-load: code=' + errorCode + ' desc=' + errorDescription + ' url=' + validatedURL
    console.error(msg)
    writeBackendLog(msg)
  })
  mainWindow.webContents.on('unresponsive', () => {
    writeBackendLog('[Renderer] unresponsive — renderer process hung')
  })
  mainWindow.webContents.on('responsive', () => {
    writeBackendLog('[Renderer] responsive again')
  })

  // Sin esto, Electron deja que cualquier window.open() o navegación de nivel
  // superior herede el preload (con acceso a shell.openExternal, el token
  // local, dialogs, etc.) -- si algún día se cuela script en el renderer, esto
  // evita que herede ese mismo poder en una ventana nueva o al navegar fuera
  // de la app. Los enlaces externos ya pasan por shell:openExternal (ver
  // preload.js), nunca por window.open real.
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const target = (() => { try { return new URL(url) } catch { return null } })()
    const isPackagedIndex = !isDev && target?.protocol === 'file:'
    const isDevServer = isDev && target?.origin === 'http://localhost:5173'
    if (!isPackagedIndex && !isDevServer) {
      event.preventDefault()
      writeBackendLog('[Electron] Navegación bloqueada fuera de la app: ' + url)
    }
  })

  if (isDev) {
    await waitForVite()
    await mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })

  // Si los avisos de examen están activados, cerrar la ventana la minimiza a
  // la bandeja en vez de cerrar la app del todo -- así puede seguir avisando
  // en segundo plano. Si el usuario los tiene desactivados, cerrar funciona
  // como siempre (cierra la app).
  mainWindow.on('close', (event) => {
    const settings = loadNotifSettings()
    if (!isQuitting && settings.notifEnabled) {
      event.preventDefault()
      mainWindow.hide()
    }
  })
}

// ── Avisos de examen en segundo plano + bandeja del sistema ──────────────────

function getNotifSettingsPath() {
  return path.join(app.getPath('userData'), 'notif-settings.json')
}

const DEFAULT_NOTIF_SETTINGS = {
  notifEnabled:    true,
  notifDaysBefore: [7, 3, 1],
  startWithSystem: false,
  startMinimized:  false,
  notifiedKeys:    [],
}

function loadNotifSettings() {
  try {
    const raw = fs.readFileSync(getNotifSettingsPath(), 'utf8')
    return { ...DEFAULT_NOTIF_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_NOTIF_SETTINGS }
  }
}

function saveNotifSettings(settings) {
  try {
    fs.writeFileSync(getNotifSettingsPath(), JSON.stringify(settings, null, 2))
  } catch (e) {
    writeBackendLog('[Notif] Error guardando ajustes: ' + e.message)
  }
}

function applyLoginItemSettings(settings) {
  if (isDev) return  // no registrar el proceso de desarrollo como inicio automático
  try {
    app.setLoginItemSettings({
      openAtLogin: !!settings.startWithSystem,
      openAsHidden: !!settings.startMinimized,
    })
  } catch (e) {
    writeBackendLog('[Notif] Error aplicando ajustes de inicio: ' + e.message)
  }
}

function createTray() {
  if (tray) return
  try {
    tray = new Tray(path.join(__dirname, '..', 'assets', 'icon.ico'))
    tray.setToolTip('MyStudy AI')
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Abrir MyStudy AI', click: () => { mainWindow?.show(); mainWindow?.focus() } },
      { type: 'separator' },
      { label: 'Salir', click: () => { isQuitting = true; app.quit() } },
    ]))
    tray.on('click', () => { mainWindow?.show(); mainWindow?.focus() })
  } catch (e) {
    writeBackendLog('[Tray] Error creando icono de bandeja: ' + e.message)
  }
}

// Consulta al backend local los exámenes próximos y lanza una notificación
// nativa por cada umbral (7/3/1 días por defecto) que no se haya avisado ya.
function checkAndNotifyExams() {
  const settings = loadNotifSettings()
  if (!settings.notifEnabled) return

  http.get(`http://127.0.0.1:${PYTHON_PORT}/notifications/startup`, (res) => {
    let body = ''
    res.on('data', d => { body += d })
    res.on('end', () => {
      try {
        const data = JSON.parse(body)
        const notifiedKeys = new Set(settings.notifiedKeys || [])
        let changed = false
        for (const exam of (data.upcoming_exams || [])) {
          if (!settings.notifDaysBefore.includes(exam.days_left)) continue
          const key = `${exam.id}:${exam.days_left}`
          if (notifiedKeys.has(key)) continue
          const when = exam.days_left === 0 ? '¡hoy!' : exam.days_left === 1 ? 'mañana' : `en ${exam.days_left} días`
          new Notification({
            title: '📅 Recordatorio de examen',
            body: `${exam.title} — ${when}`,
          }).show()
          notifiedKeys.add(key)
          changed = true
        }
        if (changed) {
          settings.notifiedKeys = [...notifiedKeys].slice(-200)
          saveNotifSettings(settings)
        }
      } catch (e) {
        writeBackendLog('[Notif] Error comprobando exámenes: ' + e.message)
      }
    })
  }).on('error', () => { /* backend no listo todavía -- se reintenta en el siguiente intervalo */ })
}

let notifCheckInterval = null

function startBackgroundNotifChecker() {
  setTimeout(checkAndNotifyExams, 15000)  // primera comprobación 15s tras arrancar
  notifCheckInterval = setInterval(checkAndNotifyExams, 30 * 60 * 1000)  // luego cada 30 min
}

ipcMain.handle('notifSettings:get', () => {
  const { notifiedKeys, ...rest } = loadNotifSettings()
  return rest
})

ipcMain.handle('notifSettings:set', (_, partial) => {
  const current = loadNotifSettings()
  const updated = { ...current, ...partial }
  saveNotifSettings(updated)
  applyLoginItemSettings(updated)
  return { ok: true }
})

// ── Ciclo de vida de la app ──────────────────────────────────────────────────

app.whenReady().then(async () => {
  // Permisos de micrófono / cámara
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ['media', 'microphone', 'camera', 'audioCapture', 'videoCapture']
    callback(allowed.includes(permission))
  })
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    const allowed = ['media', 'microphone', 'camera', 'audioCapture', 'videoCapture']
    return allowed.includes(permission)
  })

  // Asegurarse de que los archivos de config de Whisper están en userData
  // y migrar model.bin si todavía está en la ruta antigua (resources/)
  ensureWhisperConfigInUserData()

  // Copia periódica silenciosa cada 7 días
  maybePeriodicBackup()

  // Matar procesos zombie antes de arrancar el servicio nuevo
  console.log('[Electron] Killing any zombie processes on port', PYTHON_PORT)
  killZombiesOnPort(PYTHON_PORT)
  await new Promise(r => setTimeout(r, 300))  // breve pausa tras kill

  startPythonService()

  // Abrir la ventana INMEDIATAMENTE — no esperamos al backend
  // El React app muestra el banner "conectando..." y reintenta cada 3 seg
  await createWindow()

  // Si la app se abrió en frío desde el deep link de Google (mystudyai://...),
  // reenviarlo al renderer en cuanto termine de cargar
  const coldStartDeepLink = extractDeepLink(process.argv)
  if (coldStartDeepLink) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.send('deep-link', coldStartDeepLink)
    })
  }

  // Bandeja del sistema + avisos de examen en segundo plano
  createTray()
  applyLoginItemSettings(loadNotifSettings())
  startBackgroundNotifChecker()

  // Si se abrió automáticamente al iniciar sesión y el usuario eligió
  // "iniciar minimizado", ocultar la ventana en vez de mostrarla.
  if (app.getLoginItemSettings().wasOpenedAtLogin && loadNotifSettings().startMinimized) {
    mainWindow?.hide()
  }

  // Esperar al backend en segundo plano para loguear cuando esté listo
  waitForPython().then(() => {
    console.log('[Electron] Python service ready')
    writeBackendLog('[Electron] Backend ready - notifying renderer')
    // Notificar a la ventana para que no espere más
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('backend:ready')
    }
  }).catch(e => {
    console.warn('[Electron] Python service timeout:', e.message)
    writeBackendLog('[Electron] WARNING: ' + e.message)
  })
})

app.on('window-all-closed', () => {
  killPythonService()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.on('before-quit', () => {
  isQuitting = true
  if (notifCheckInterval) clearInterval(notifCheckInterval)
  killPythonService()
})

// ── IPC handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('window:minimize', () => mainWindow?.minimize())
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.handle('window:close', () => mainWindow?.close())

ipcMain.handle('dialog:openFile', async (_, opts) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'PDF', extensions: ['pdf'] },
      { name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'webp'] },
      { name: 'Todos', extensions: ['*'] },
    ],
    ...opts,
  })
  return result.canceled ? [] : result.filePaths
})

ipcMain.handle('dialog:saveFile', async (_, opts) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'PDF', extensions: ['pdf'] },
      { name: 'Word', extensions: ['docx'] },
    ],
    ...opts,
  })
  return result.canceled ? null : result.filePath
})

// shell.openExternal es, en Windows, un paso directo a ShellExecute: abriría
// ejecutables locales, rutas de red (file:, UNC, smb:) o protocolos del sistema
// (ms-*, search-ms:) fuera del sandbox de Chromium. Como el renderer elige el
// argumento, solo dejamos pasar enlaces web seguros (https). Cualquier otra cosa
// se ignora y se registra; nunca se pasa la cadena original al sistema, sino la
// URL ya normalizada por el parser, para que lo validado y lo abierto coincidan.
const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['https:'])

ipcMain.handle('shell:openExternal', async (_, url) => {
  let parsed
  try {
    parsed = new URL(String(url))
  } catch {
    console.warn('[Electron] openExternal: enlace mal formado, ignorado')
    return false
  }
  if (!ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
    console.warn(`[Electron] openExternal: bloqueado protocolo "${parsed.protocol}"`)
    return false
  }
  await shell.openExternal(parsed.href)
  return true
})
ipcMain.handle('app:getVersion', () => app.getVersion())
ipcMain.handle('app:getPythonPort', () => PYTHON_PORT)
ipcMain.handle('app:getLocalToken', () => LOCAL_AUTH_TOKEN)
ipcMain.handle('app:getPlatform', () => process.platform)
ipcMain.handle('app:getLogPath', () => getLogPath())

// Reintento de conexion: el frontend puede pedir al backend que siga esperando
ipcMain.handle('app:backendCheck', async () => {
  try {
    await waitForPython(5)  // espera max 5 seg en este reintento
    return { ok: true }
  } catch {
    return { ok: false, logPath: getLogPath() }
  }
})

// ── Detección de RAM del sistema ─────────────────────────────────────────────
ipcMain.handle('system:getRAMGb', () => {
  return Math.round(os.totalmem() / (1024 ** 3))
})

// ── Comprobar si Ollama está instalado ───────────────────────────────────────
ipcMain.handle('ollama:isInstalled', async () => {
  try {
    const res = await new Promise((resolve, reject) => {
      http.get('http://localhost:11434', r => resolve(r.statusCode)).on('error', reject)
    })
    return res < 500
  } catch {
    return false
  }
})

// ── Descargar e instalar Ollama silenciosamente ──────────────────────────────
ipcMain.handle('ollama:install', async (event) => {
  const tmpPath = path.join(os.tmpdir(), 'OllamaSetup.exe')
  const url = 'https://ollama.com/download/OllamaSetup.exe'

  // Descarga con progreso
  await new Promise((resolve, reject) => {
    const file = fs.createWriteStream(tmpPath)
    https.get(url, res => {
      const total = parseInt(res.headers['content-length'] || '0', 10)
      let downloaded = 0
      res.on('data', chunk => {
        downloaded += chunk.length
        file.write(chunk)
        if (total > 0) {
          event.sender.send('ollama:progress', Math.round(downloaded / total * 100))
        }
      })
      res.on('end', () => { file.end(); resolve() })
      res.on('error', reject)
    }).on('error', reject)
  })

  // Instalar silenciosamente
  await new Promise((resolve, reject) => {
    const proc = spawn(tmpPath, ['/S'], { windowsHide: true })
    proc.on('close', code => {
      fs.unlink(tmpPath, () => {})
      if (code === 0) resolve()
      else reject(new Error(`OllamaSetup exited with code ${code}`))
    })
    proc.on('error', reject)
  })

  return true
})

// ── Whisper model — comprobación y descarga bajo demanda ─────────────────────

function getWhisperModelPath() {
  // El modelo está en userData para sobrevivir actualizaciones
  return path.join(getWhisperUserDataDir(), 'model.bin')
}

// Petición HTTP activa (para poder cancelarla)
const whisperAbortRef = { aborted: false, req: null }
let whisperDownloading = false  // evita lanzar dos descargas simultáneas

// Descarga un archivo siguiendo redirecciones (HuggingFace redirige al CDN).
// abortRef es un objeto mutable { aborted, req } propio de cada descarga (uno
// para Whisper, otro para el CUDA pack) para poder cancelar cada una por separado.
function downloadWithProgress(url, destPath, onProgress, abortRef, hopsLeft = 8) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    const req = lib.get(url, { headers: { 'User-Agent': 'StudyAI/1.0' } }, (res) => {
      // Seguir redirecciones 301/302/307/308
      if ([301, 302, 307, 308].includes(res.statusCode)) {
        if (hopsLeft <= 0) return reject(new Error('Too many redirects'))
        const location = res.headers.location
        // Resolver URL relativas
        const nextUrl = location.startsWith('http') ? location : new URL(location, url).href
        return downloadWithProgress(nextUrl, destPath, onProgress, abortRef, hopsLeft - 1)
          .then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} al descargar ${path.basename(destPath)}`))
      }

      const total = parseInt(res.headers['content-length'] || '0', 10)
      let downloaded = 0

      // Asegurarse de que la carpeta destino existe
      fs.mkdirSync(path.dirname(destPath), { recursive: true })
      const partPath = destPath + '.part'
      const file = fs.createWriteStream(partPath)

      res.on('data', chunk => {
        if (abortRef.aborted) {
          res.destroy()
          file.destroy()
          fs.unlink(partPath, () => {})
          return reject(new Error('cancelled'))
        }
        downloaded += chunk.length
        file.write(chunk)
        if (total > 0) onProgress(Math.round(downloaded / total * 100))
      })

      res.on('end', () => {
        file.end()
      })

      file.on('finish', () => {
        fs.rename(partPath, destPath, err => {
          if (err) reject(err); else resolve()
        })
      })

      file.on('error', err => {
        fs.unlink(partPath, () => {})
        reject(err)
      })

      res.on('error', err => {
        file.destroy()
        fs.unlink(partPath, () => {})
        reject(err)
      })
    })

    abortRef.req = req
    req.on('error', err => {
      fs.unlink(destPath + '.part', () => {})
      if (abortRef.aborted) reject(new Error('cancelled'))
      else reject(err)
    })
  })
}

// IPC: estado actual de la descarga
ipcMain.handle('whisper:isDownloading', () => whisperDownloading)

// IPC: comprobar si el modelo está ya descargado
ipcMain.handle('whisper:check', () => {
  const modelPath = getWhisperModelPath()
  const exists = fs.existsSync(modelPath)
  writeBackendLog('[Whisper] Model check: ' + modelPath + ' → ' + (exists ? 'present' : 'missing'))
  return { installed: exists, path: modelPath }
})

// URLs de descarga del modelo Whisper medium — en orden de preferencia.
// Si la primera falla (red, servidor caído), se prueba la siguiente automáticamente.
const WHISPER_URLS = [
  // 1º — Fuente oficial (HuggingFace). La más actualizada y rápida.
  'https://huggingface.co/Systran/faster-whisper-medium/resolve/main/model.bin',
  // 2º — Nuestra copia en GitHub Releases. Respaldo propio, siempre disponible.
  'https://github.com/StudyAIUp/studyai-releases/releases/download/v1.0.0/model.bin',
]

// IPC: descargar el modelo con progreso en tiempo real
ipcMain.handle('whisper:download', async (event) => {
  if (whisperDownloading) {
    writeBackendLog('[Whisper] Download already in progress — ignoring duplicate request')
    return { ok: false, error: 'already_in_progress' }
  }

  const modelPath = getWhisperModelPath()

  whisperAbortRef.aborted = false
  whisperAbortRef.req = null
  whisperDownloading = true

  // Intentar cada URL en orden hasta que una funcione
  let lastError = null
  for (let i = 0; i < WHISPER_URLS.length; i++) {
    if (whisperAbortRef.aborted) break
    const url = WHISPER_URLS[i]
    writeBackendLog(`[Whisper] Trying URL ${i + 1}/${WHISPER_URLS.length}: ${url}`)

    try {
      await downloadWithProgress(url, modelPath, (pct) => {
        event.sender.send('whisper:progress', pct)
      }, whisperAbortRef)
      writeBackendLog('[Whisper] Download complete from: ' + url)
      event.sender.send('whisper:done')
      whisperAbortRef.req = null; whisperAbortRef.aborted = false; whisperDownloading = false
      return { ok: true }
    } catch (err) {
      if (err.message === 'cancelled' || whisperAbortRef.aborted) {
        writeBackendLog('[Whisper] Download cancelled by user')
        event.sender.send('whisper:error', 'cancelled')
        whisperAbortRef.req = null; whisperAbortRef.aborted = false; whisperDownloading = false
        return { ok: false, error: 'cancelled' }
      }
      lastError = err
      writeBackendLog(`[Whisper] URL ${i + 1} failed: ${err.message}. ${i + 1 < WHISPER_URLS.length ? 'Trying next...' : 'No more URLs.'}`)
      // Borrar archivo parcial antes de intentar la siguiente URL
      try { fs.unlinkSync(modelPath + '.part') } catch {}
    }
  }

  // Todas las URLs fallaron
  const errMsg = lastError?.message || 'Error desconocido'
  writeBackendLog('[Whisper] All download URLs failed. Last error: ' + errMsg)
  event.sender.send('whisper:error', errMsg)

  whisperAbortRef.req = null
  whisperAbortRef.aborted = false
  whisperDownloading = false
  return { ok: false, error: errMsg }
})

// IPC: cancelar descarga en curso
ipcMain.handle('whisper:cancel', () => {
  whisperAbortRef.aborted = true
  if (whisperAbortRef.req) {
    try { whisperAbortRef.req.destroy() } catch {}
    whisperAbortRef.req = null
  }
  writeBackendLog('[Whisper] Download cancelled by user')
})

// ── CUDA pack (librerias NVIDIA) — comprobacion y descarga bajo demanda ──────
// El instalador ya NO incluye cublas/cudnn (pesaban 1.9GB) -- se descargan
// aparte, y solo se ofrece hacerlo si se detecta una GPU NVIDIA compatible
// (ver /system/gpu-status en el backend). Mismo patron que el modelo Whisper,
// incluida la parte de UI: el usuario lo instala/desinstala el mismo cuando
// quiera desde Ajustes -> Reconocimiento de voz, NO se descarga solo ni en
// segundo plano sin que el usuario lo pida (antes se hacia asi y no deberia:
// son ~1.3GB reales, el usuario tiene que decidirlo, igual que con Whisper).

let cudaDownloading = false
const cudaAbortRef = { aborted: false, req: null }

function getCudaPackMarkerPath() {
  // Un DLL conocido cuya presencia confirma que el paquete ya esta extraido
  return path.join(getCudaPackUserDataDir(), 'nvidia', 'cublas', 'bin', 'cublas64_12.dll')
}

ipcMain.handle('cuda:isDownloading', () => cudaDownloading)

// IPC: comprobar si el CUDA pack ya esta descargado y extraido
ipcMain.handle('cuda:check', () => {
  const installed = fs.existsSync(getCudaPackMarkerPath())
  writeBackendLog('[CUDA] Pack check → ' + (installed ? 'present' : 'missing'))
  return { installed }
})

// IPC: preguntarle al backend si hay GPU NVIDIA compatible (lo comprueba con
// nvcuda.dll, el driver, SIN necesitar las librerias que estamos descargando)
ipcMain.handle('cuda:hasNvidiaGpu', async () => {
  try {
    const r = await httpGetJson(`http://127.0.0.1:${PYTHON_PORT}/system/gpu-status`)
    return { hasGpu: !!r.has_nvidia_gpu }
  } catch (e) {
    writeBackendLog('[CUDA] gpu-status check failed: ' + e.message)
    return { hasGpu: false }
  }
})

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    // El backend local exige X-Local-Auth en TODA ruta salvo /health (ver
    // _require_local_token en main.py) — sin esto, cualquier endpoint propio
    // devuelve 403 (fallo real encontrado probando esto mismo).
    http.get(url, { timeout: 5000, headers: { 'X-Local-Auth': LOCAL_AUTH_TOKEN } }, res => {
      let body = ''
      res.on('data', c => { body += c })
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`))
        }
        try { resolve(JSON.parse(body)) } catch (e) { reject(e) }
      })
    }).on('error', reject).on('timeout', function () { this.destroy(new Error('timeout')) })
  })
}

// URL de descarga del CUDA pack — copia propia en GitHub Releases (mismo
// repo/patron que el modelo de Whisper). Un unico zip, ~1.3GB comprimido.
const CUDA_PACK_URL = 'https://github.com/StudyAIUp/studyai-releases/releases/download/v1.0.0/cuda-pack-cu12.zip'

// IPC: descargar y extraer el CUDA pack (con progreso en tiempo real) --
// SIEMPRE iniciado a mano por el usuario desde Ajustes, nunca automatico.
ipcMain.handle('cuda:download', async (event) => {
  if (cudaDownloading) return { ok: false, error: 'already_in_progress' }
  cudaDownloading = true
  cudaAbortRef.aborted = false
  cudaAbortRef.req = null
  const destDir  = getCudaPackUserDataDir()
  const zipPath  = path.join(destDir, 'cuda-pack-cu12.zip')
  fs.mkdirSync(destDir, { recursive: true })

  try {
    writeBackendLog('[CUDA] Descargando CUDA pack desde ' + CUDA_PACK_URL)
    await downloadWithProgress(CUDA_PACK_URL, zipPath, (pct) => {
      event.sender.send('cuda:progress', pct)
    }, cudaAbortRef)
    writeBackendLog('[CUDA] Descarga completa, extrayendo…')
    event.sender.send('cuda:extracting')

    // Sin dependencia npm de zip -- Expand-Archive viene con Windows.
    await new Promise((resolve, reject) => {
      const ps = spawn('powershell.exe', [
        '-NoProfile', '-NonInteractive', '-Command',
        `Expand-Archive -Path "${zipPath}" -DestinationPath "${destDir}" -Force`,
      ], { windowsHide: true })
      let stderr = ''
      ps.stderr.on('data', d => { stderr += d.toString() })
      ps.on('close', code => {
        if (code === 0) resolve()
        else reject(new Error('Expand-Archive fallo (' + code + '): ' + stderr))
      })
    })

    fs.unlink(zipPath, () => {})

    if (!fs.existsSync(getCudaPackMarkerPath())) {
      throw new Error('Extraccion terminada pero no se encuentra cublas64_12.dll')
    }

    writeBackendLog('[CUDA] Pack instalado correctamente')
    event.sender.send('cuda:done')
    cudaDownloading = false
    return { ok: true }
  } catch (err) {
    if (err.message === 'cancelled' || cudaAbortRef.aborted) {
      writeBackendLog('[CUDA] Descarga cancelada por el usuario')
      fs.unlink(zipPath, () => {})
      event.sender.send('cuda:error', 'cancelled')
      cudaDownloading = false
      return { ok: false, error: 'cancelled' }
    }
    writeBackendLog('[CUDA] Error: ' + err.message)
    event.sender.send('cuda:error', err.message)
    cudaDownloading = false
    return { ok: false, error: err.message }
  }
})

// IPC: cancelar descarga en curso
ipcMain.handle('cuda:cancel', () => {
  cudaAbortRef.aborted = true
  if (cudaAbortRef.req) {
    try { cudaAbortRef.req.destroy() } catch {}
    cudaAbortRef.req = null
  }
  writeBackendLog('[CUDA] Descarga cancelada por el usuario')
})

// IPC: desinstalar el CUDA pack (el usuario ya no lo quiere / quiere liberar
// espacio). Si backend.exe tiene las DLLs cargadas en memoria, Windows puede
// bloquear el borrado -- se avisa para que reinicie la app y se reintente.
ipcMain.handle('cuda:uninstall', () => {
  const dir = getCudaPackUserDataDir()
  try {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
    writeBackendLog('[CUDA] Pack desinstalado')
    return { ok: true }
  } catch (err) {
    writeBackendLog('[CUDA] Error al desinstalar: ' + err.message)
    return { ok: false, error: 'in_use' }
  }
})

// IPC: portapapeles nativo (navigator.clipboard no funciona en Electron sin permisos)
ipcMain.handle('clipboard:write', (_, text) => {
  clipboard.writeText(String(text))
  return true
})

// IPC: el usuario pide comprobar actualizaciones manualmente desde Ajustes
ipcMain.handle('updater:check', async () => {
  if (isDev) return { checked: false, reason: 'dev' }
  try {
    const result = await autoUpdater.checkForUpdates()
    // Si no hay versión nueva, result.updateInfo.version === app.getVersion()
    return { checked: true }
  } catch (err) {
    writeBackendLog('[Updater] Manual check failed: ' + err.message)
    return { checked: false, error: err.message }
  }
})

// ── Auto-updater ─────────────────────────────────────────────────────────────
// Solo activo en producción (no en desarrollo)
if (!isDev) {
  // NO descargar automáticamente — el usuario elige cuándo
  autoUpdater.autoDownload = false
  // NO instalar al cerrar automáticamente — el usuario elige cuándo
  autoUpdater.autoInstallOnAppQuit = false

  // Hay una versión nueva disponible
  autoUpdater.on('update-available', (info) => {
    writeBackendLog('[Updater] Update available: ' + info.version)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes || '',
      })
    }
  })

  // No hay versión nueva
  autoUpdater.on('update-not-available', () => {
    writeBackendLog('[Updater] App is up to date')
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:not-available')
    }
  })

  // Progreso de descarga
  autoUpdater.on('download-progress', (progress) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:progress', {
        percent:     Math.round(progress.percent),
        transferred: progress.transferred,
        total:       progress.total,
        speed:       progress.bytesPerSecond,
      })
    }
  })

  // Descarga completada — lista para instalar
  autoUpdater.on('update-downloaded', (info) => {
    writeBackendLog('[Updater] Update downloaded: ' + info.version)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:downloaded', { version: info.version })
    }
  })

  // Error en el actualizador
  autoUpdater.on('error', (err) => {
    writeBackendLog('[Updater] Error: ' + err.message)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:error', err.message)
    }
  })

  // Comprobar actualizaciones 10 segundos después de arrancar
  // (damos tiempo al backend a inicializarse antes de hacer peticiones de red)
  app.whenReady().then(() => {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(e => {
        writeBackendLog('[Updater] Check failed: ' + e.message)
      })
    }, 10000)
  })
}

// IPC: el renderer pide empezar a descargar la actualización
ipcMain.handle('updater:download', async () => {
  if (isDev) return { ok: false, reason: 'dev-mode' }
  try {
    await autoUpdater.downloadUpdate()
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: e.message }
  }
})

// IPC: el renderer pide instalar (hace copia de seguridad y cierra la app)
ipcMain.handle('updater:install', () => {
  // Copia de seguridad de la BD ANTES de instalar — por si la actualización tiene algún problema
  const result = createDbBackup('pre-update')
  writeBackendLog('[Updater] Copia pre-update: ' + JSON.stringify(result))
  // isSilent=true (antes false): con false, NSIS mostraba el asistente completo
  // en cada actualización -- incluida la pantalla de "elegir carpeta" (activada
  // por allowToChangeInstallationDirectory para la instalación inicial), lo que
  // en algún update acabó creando una carpeta distinta a la de siempre
  // (Programs\StudyAI\MyStudy AI\ en vez de Programs\MyStudy AI\), dejando dos
  // instalaciones sueltas en el disco. En modo silencioso, NSIS detecta la
  // instalación anterior por el registro de Windows y actualiza en el mismo
  // sitio de siempre, sin preguntar nada.
  autoUpdater.quitAndInstall(true, true)
})
