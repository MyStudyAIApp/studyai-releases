const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  window: {
    minimize:  () => ipcRenderer.invoke('window:minimize'),
    maximize:  () => ipcRenderer.invoke('window:maximize'),
    close:     () => ipcRenderer.invoke('window:close'),
  },
  dialog: {
    openFile:  (opts) => ipcRenderer.invoke('dialog:openFile', opts),
    saveFile:  (opts) => ipcRenderer.invoke('dialog:saveFile', opts),
  },
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  },
  app: {
    getVersion:    () => ipcRenderer.invoke('app:getVersion'),
    getPythonPort: () => ipcRenderer.invoke('app:getPythonPort'),
    getLocalToken: () => ipcRenderer.invoke('app:getLocalToken'),
    getPlatform:   () => ipcRenderer.invoke('app:getPlatform'),
    getLogPath:    () => ipcRenderer.invoke('app:getLogPath'),
  },
  system: {
    getRAMGb: () => ipcRenderer.invoke('system:getRAMGb'),
  },
  ollama: {
    isInstalled: () => ipcRenderer.invoke('ollama:isInstalled'),
    install:     () => ipcRenderer.invoke('ollama:install'),
    onProgress:  (cb) => {
      ipcRenderer.on('ollama:progress', (_, pct) => cb(pct))
      return () => ipcRenderer.removeAllListeners('ollama:progress')
    },
  },
  // Evento: el proceso principal avisa cuando el backend ya está listo
  onBackendReady: (cb) => {
    ipcRenderer.once('backend:ready', cb)
    return () => ipcRenderer.removeAllListeners('backend:ready')
  },

  // Evento: deep link mystudyai://auth-callback tras el login con Google
  onDeepLink: (cb) => {
    ipcRenderer.on('deep-link', (_, url) => cb(url))
    return () => ipcRenderer.removeAllListeners('deep-link')
  },

  // ── Portapapeles nativo ─────────────────────────────────────────────────────
  clipboard: {
    write: (text) => ipcRenderer.invoke('clipboard:write', text),
  },

  // ── Whisper model ───────────────────────────────────────────────────────────
  whisper: {
    check:         () => ipcRenderer.invoke('whisper:check'),
    isDownloading: () => ipcRenderer.invoke('whisper:isDownloading'),
    download:      () => ipcRenderer.invoke('whisper:download'),
    cancel:        () => ipcRenderer.invoke('whisper:cancel'),
    onProgress: (cb) => {
      ipcRenderer.on('whisper:progress', (_, pct) => cb(pct))
      return () => ipcRenderer.removeAllListeners('whisper:progress')
    },
    onDone:  (cb) => {
      ipcRenderer.on('whisper:done', () => cb())
      return () => ipcRenderer.removeAllListeners('whisper:done')
    },
    onError: (cb) => {
      ipcRenderer.on('whisper:error', (_, msg) => cb(msg))
      return () => ipcRenderer.removeAllListeners('whisper:error')
    },
  },

  // ── CUDA pack (aceleracion GPU para Whisper) ────────────────────────────────
  // Mismo patron que whisper: el usuario lo instala/desinstala el mismo desde
  // Ajustes -> Reconocimiento de voz, nunca se dispara solo. Es opcional (la
  // transcripcion funciona igual en CPU si no esta instalado).
  cuda: {
    hasNvidiaGpu:  () => ipcRenderer.invoke('cuda:hasNvidiaGpu'),
    check:         () => ipcRenderer.invoke('cuda:check'),
    isDownloading: () => ipcRenderer.invoke('cuda:isDownloading'),
    download:      () => ipcRenderer.invoke('cuda:download'),
    cancel:        () => ipcRenderer.invoke('cuda:cancel'),
    uninstall:     () => ipcRenderer.invoke('cuda:uninstall'),
    onProgress: (cb) => {
      ipcRenderer.on('cuda:progress', (_, pct) => cb(pct))
      return () => ipcRenderer.removeAllListeners('cuda:progress')
    },
    onExtracting: (cb) => {
      ipcRenderer.on('cuda:extracting', () => cb())
      return () => ipcRenderer.removeAllListeners('cuda:extracting')
    },
    onDone: (cb) => {
      ipcRenderer.on('cuda:done', () => cb())
      return () => ipcRenderer.removeAllListeners('cuda:done')
    },
    onError: (cb) => {
      ipcRenderer.on('cuda:error', (_, msg) => cb(msg))
      return () => ipcRenderer.removeAllListeners('cuda:error')
    },
  },

  // ── Copias de seguridad ─────────────────────────────────────────────────────
  backup: {
    status: () => ipcRenderer.invoke('backup:status'),
    create: () => ipcRenderer.invoke('backup:create'),
    export: () => ipcRenderer.invoke('backup:export'),
  },

  // ── Avisos de examen en segundo plano + inicio con el sistema ──────────────
  notifSettings: {
    get: ()          => ipcRenderer.invoke('notifSettings:get'),
    set: (settings)  => ipcRenderer.invoke('notifSettings:set', settings),
  },

  // ── Auto-updater ────────────────────────────────────────────────────────────
  updater: {
    // Eventos del proceso principal → renderer
    onAvailable:     (cb) => { ipcRenderer.on('updater:available',     (_, info) => cb(info)); return () => ipcRenderer.removeAllListeners('updater:available')     },
    onNotAvailable:  (cb) => { ipcRenderer.on('updater:not-available', ()       => cb());    return () => ipcRenderer.removeAllListeners('updater:not-available')  },
    onProgress:    (cb) => { ipcRenderer.on('updater:progress',   (_, info) => cb(info));  return () => ipcRenderer.removeAllListeners('updater:progress')    },
    onDownloaded:  (cb) => { ipcRenderer.on('updater:downloaded', (_, info) => cb(info));  return () => ipcRenderer.removeAllListeners('updater:downloaded')  },
    onError:       (cb) => { ipcRenderer.on('updater:error',      (_, msg)  => cb(msg));   return () => ipcRenderer.removeAllListeners('updater:error')       },
    // Acciones del renderer → proceso principal
    check:    () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    install:  () => ipcRenderer.invoke('updater:install'),
  },
})

// Alias para compatibilidad (App.jsx usa window.electronAPI)
contextBridge.exposeInMainWorld('electronAPI', {
  onBackendReady: (cb) => {
    ipcRenderer.once('backend:ready', cb)
    return () => ipcRenderer.removeAllListeners('backend:ready')
  },
})
