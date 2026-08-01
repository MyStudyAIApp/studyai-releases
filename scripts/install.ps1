# StudyAI — Instalador para Windows
# Ejecutar con: powershell -ExecutionPolicy Bypass -File install.ps1

$ErrorActionPreference = "Continue"
$Host.UI.RawUI.WindowTitle = "StudyAI Instalador"

function Write-Step($msg) { Write-Host "`n>>> $msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "    [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    [!]  $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "    [X]  $msg" -ForegroundColor Red }

Write-Host @"
  ____  _             _         _    ___
 / ___|| |_ _   _  __| |_   _  / \  |_ _|
 \___ \| __| | | |/ _' | | | |/ _ \  | |
  ___) | |_| |_| | (_| | |_| / ___ \ | |
 |____/ \__|\__,_|\__,_|\__, /_/   \_\___|
                        |___/
 Instalador de StudyAI v1.0
"@ -ForegroundColor Blue

# ── Verificar Node.js ────────────────────────────────────────────────────────

Write-Step "Verificando Node.js..."
try {
    $nodeVer = (node --version 2>$null)
    if ($nodeVer) {
        Write-OK "Node.js $nodeVer ya instalado"
    } else {
        throw "No encontrado"
    }
} catch {
    Write-Warn "Node.js no encontrado. Descargando..."
    $nodeUrl = "https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi"
    $nodeMsi = "$env:TEMP\node-installer.msi"
    Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeMsi
    Start-Process msiexec -ArgumentList "/i `"$nodeMsi`" /quiet /norestart" -Wait
    Write-OK "Node.js instalado"
}

# ── Verificar Python ─────────────────────────────────────────────────────────

Write-Step "Verificando Python..."
$python = $null
foreach ($cmd in @("python", "python3", "py")) {
    try {
        $ver = (& $cmd --version 2>$null)
        if ($ver -match "Python 3") {
            $python = $cmd
            Write-OK "Python $ver ya instalado ($cmd)"
            break
        }
    } catch {}
}
if (-not $python) {
    Write-Warn "Python no encontrado. Descargando Python 3.11..."
    $pyUrl = "https://www.python.org/ftp/python/3.11.7/python-3.11.7-amd64.exe"
    $pyExe = "$env:TEMP\python-installer.exe"
    Invoke-WebRequest -Uri $pyUrl -OutFile $pyExe
    Start-Process $pyExe -ArgumentList "/quiet InstallAllUsers=1 PrependPath=1" -Wait
    $python = "python"
    Write-OK "Python instalado"
}

# ── Verificar Ollama ─────────────────────────────────────────────────────────

Write-Step "Verificando Ollama..."
try {
    $ollamaVer = (ollama --version 2>$null)
    if ($ollamaVer) {
        Write-OK "Ollama $ollamaVer ya instalado"
    } else { throw }
} catch {
    Write-Warn "Ollama no encontrado. Descargando..."
    $ollamaUrl = "https://ollama.com/download/OllamaSetup.exe"
    $ollamaExe = "$env:TEMP\OllamaSetup.exe"
    Invoke-WebRequest -Uri $ollamaUrl -OutFile $ollamaExe
    Start-Process $ollamaExe -ArgumentList "/S" -Wait
    Write-OK "Ollama instalado"
}

# ── Instalar dependencias Python ─────────────────────────────────────────────

Write-Step "Instalando dependencias Python..."
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$requirementsPath = Join-Path $scriptDir "..\python-service\requirements.txt"
& $python -m pip install --upgrade pip --quiet
& $python -m pip install -r $requirementsPath --quiet
if ($LASTEXITCODE -eq 0) {
    Write-OK "Dependencias Python instaladas"
} else {
    Write-Warn "Algunas dependencias fallaron — la app puede funcionar parcialmente"
}

# ── Instalar dependencias Node ───────────────────────────────────────────────

Write-Step "Instalando dependencias Node.js..."
$projectDir = Join-Path $scriptDir ".."
Push-Location $projectDir
npm install --silent
if ($LASTEXITCODE -eq 0) {
    Write-OK "Dependencias Node.js instaladas"
} else {
    Write-Fail "Error instalando dependencias Node.js"
}
Pop-Location

# ── Tesseract (OCR) ──────────────────────────────────────────────────────────

Write-Step "Verificando Tesseract OCR..."
try {
    $tessVer = (tesseract --version 2>$null | Select-Object -First 1)
    Write-OK "Tesseract ya instalado: $tessVer"
} catch {
    Write-Warn "Tesseract no encontrado (opcional para PDFs escaneados)"
    Write-Warn "Instalar desde: https://github.com/UB-Mannheim/tesseract/wiki"
    Write-Warn "Luego volver a ejecutar este instalador"
}

# ── Descargar modelos Ollama ─────────────────────────────────────────────────

Write-Step "Iniciando Ollama..."
Start-Process "ollama" -ArgumentList "serve" -WindowStyle Hidden
Start-Sleep -Seconds 3

Write-Step "Descargando modelos de IA (puede tardar 10-20 min la primera vez)..."
Write-Host "    Total aproximado: ~15 GB" -ForegroundColor Gray

$models = @(
    @{id="gemma3:4b";  label="Gemma 3 4B  (multimodal, ~3 GB)"},
    @{id="gemma3:12b"; label="Gemma 3 12B (principal, ~7 GB)"},
    @{id="deepseek-r1:8b"; label="DeepSeek R1 8B (razonamiento, ~5 GB)"}
)

foreach ($m in $models) {
    Write-Host "    Descargando $($m.label)..." -ForegroundColor Gray
    ollama pull $m.id
    if ($LASTEXITCODE -eq 0) {
        Write-OK "Modelo $($m.id) listo"
    } else {
        Write-Warn "Error descargando $($m.id) — puedes descargarlo después desde Ajustes"
    }
}

# ── Crear acceso directo ──────────────────────────────────────────────────────

Write-Step "Creando acceso directo en el escritorio..."
$desktopPath = [System.Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktopPath "StudyAI.lnk"
$WScriptShell = New-Object -comObject WScript.Shell
$shortcut = $WScriptShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "npm"
$shortcut.Arguments = "run dev"
$shortcut.WorkingDirectory = $projectDir
$shortcut.IconLocation = Join-Path $projectDir "assets\icon.png"
$shortcut.Save()
Write-OK "Acceso directo creado en el escritorio"

# ── Listo ────────────────────────────────────────────────────────────────────

Write-Host "`n"
Write-Host "============================================" -ForegroundColor Green
Write-Host "  StudyAI instalado correctamente!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Para iniciar: npm run dev" -ForegroundColor White
Write-Host "  Directorio:   $projectDir" -ForegroundColor Gray
Write-Host ""
Read-Host "Pulsa Enter para cerrar"
