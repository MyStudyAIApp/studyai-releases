# StudyAI -- Build completo del instalador
# Orquesta todo el proceso: recursos -> backend -> frontend -> installer
#
# Uso:
#   npm run build:all          (desde la raiz del proyecto)
#   .\scripts\build-all.ps1   (directo)

$ErrorActionPreference = 'Stop'
$StartTime = Get-Date
$ProjectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $ProjectRoot

function Write-Step($num, $total, $msg) {
    Write-Host ""
    Write-Host "-----------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "  PASO $num/$total  $msg" -ForegroundColor Cyan
    Write-Host "-----------------------------------------------------" -ForegroundColor DarkGray
}

function Write-Ok($msg)   { Write-Host "  OK  $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "  FAIL  $msg" -ForegroundColor Red }
function Write-Info($msg) { Write-Host "  INFO  $msg" -ForegroundColor DarkGray }

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  StudyAI -- Build instalador completo" -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm')" -ForegroundColor DarkGray
Write-Host "=====================================================" -ForegroundColor Cyan

# ----------------------------------------------------------------------------
# PASO 1: Verificar icono
# ----------------------------------------------------------------------------
Write-Step 1 5 "Verificar icono de la app"

$iconPath = "$ProjectRoot\assets\icon.ico"
if (-not (Test-Path $iconPath)) {
    Write-Host "  WARN  No se encontro assets\icon.ico" -ForegroundColor Yellow
    $pngPath = "$ProjectRoot\assets\icon.png"
    if (Test-Path $pngPath) {
        Write-Info "Detectado icon.png -- copiando como icon.ico"
        Copy-Item $pngPath $iconPath -Force
        Write-Host "  WARN  Usando icon.png renombrado (mejor usar un .ico real)" -ForegroundColor Yellow
    } else {
        Write-Fail "No hay icono en assets\. Crea assets\icon.ico o assets\icon.png"
        Write-Info "Continuando sin icono (el build puede fallar en NSIS)"
    }
} else {
    Write-Ok "Icono encontrado: assets\icon.ico"
}

# ----------------------------------------------------------------------------
# PASO 2: Copiar recursos (Whisper, ffmpeg, Tesseract)
# ----------------------------------------------------------------------------
Write-Step 2 5 "Preparar recursos binarios"

& "$PSScriptRoot\bundle-resources.ps1"
if ($LASTEXITCODE -ne 0) {
    Write-Fail "bundle-resources.ps1 fallo"
    exit 1
}

# ----------------------------------------------------------------------------
# PASO 3: Compilar backend Python
# ----------------------------------------------------------------------------
Write-Step 3 5 "Compilar backend Python (PyInstaller)"

& "$PSScriptRoot\build-backend.ps1"
if ($LASTEXITCODE -ne 0) {
    Write-Fail "build-backend.ps1 fallo"
    exit 1
}

$backendExe = "$ProjectRoot\python-service\dist\backend\backend.exe"
if (-not (Test-Path $backendExe)) {
    Write-Fail "No se encontro backend.exe tras PyInstaller"
    exit 1
}
Write-Ok "backend.exe generado"

# ----------------------------------------------------------------------------
# PASO 4: Build del frontend (Vite)
# ----------------------------------------------------------------------------
Write-Step 4 5 "Build frontend (Vite)"

if (Test-Path "$ProjectRoot\dist") {
    Remove-Item "$ProjectRoot\dist" -Recurse -Force
}

Write-Info "Ejecutando: npm run build"
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Vite build fallo"
    exit 1
}

if (-not (Test-Path "$ProjectRoot\dist\index.html")) {
    Write-Fail "No se genero dist/index.html"
    exit 1
}
Write-Ok "Frontend compilado en dist/"

# ----------------------------------------------------------------------------
# PASO 5a: electron-builder --dir (genera win-unpacked, sin installer)
# ----------------------------------------------------------------------------
Write-Step 5 6 "Empaquetar app con electron-builder (--dir)"

if (Test-Path "$ProjectRoot\dist-electron") {
    Remove-Item "$ProjectRoot\dist-electron" -Recurse -Force
}

Write-Info "Ejecutando: npm run build:electron"
npm run build:electron
if ($LASTEXITCODE -ne 0) {
    Write-Fail "electron-builder fallo"
    exit 1
}

if (-not (Test-Path "$ProjectRoot\dist-electron\win-unpacked\MyStudy AI.exe")) {
    Write-Fail "win-unpacked no generado correctamente"
    exit 1
}
Write-Ok "win-unpacked generado"

# ----------------------------------------------------------------------------
# PASO 5b: Validar todo antes de lanzar Inno Setup (evita 20 min perdidos)
# ----------------------------------------------------------------------------
Write-Step 6 7 "Validacion pre-build (detectar errores antes de compilar)"

& "$PSScriptRoot\validate-build.ps1"
if ($LASTEXITCODE -ne 0) {
    Write-Fail "validate-build.ps1 detecto errores -- corrigelos antes de continuar"
    Write-Host "  NO se lanzara Inno Setup para no perder tiempo en un build que fallara" -ForegroundColor Yellow
    exit 1
}

# ----------------------------------------------------------------------------
# PASO 5c: Inno Setup -> StudyAI-Setup.exe
# ----------------------------------------------------------------------------
Write-Step 7 7 "Compilar instalador final (Inno Setup)"

& "$PSScriptRoot\build-installer.ps1"
if ($LASTEXITCODE -ne 0) {
    Write-Fail "build-installer.ps1 fallo"
    exit 1
}

# ----------------------------------------------------------------------------
# Resultado final
# ----------------------------------------------------------------------------
$elapsed = [math]::Round(((Get-Date) - $StartTime).TotalMinutes, 1)

$installer = Get-ChildItem "$ProjectRoot\dist-electron\StudyAI-Setup.exe" -ErrorAction SilentlyContinue |
    Select-Object -First 1

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Green
if ($installer) {
    $sizeMB = [math]::Round($installer.Length / 1MB)
    Write-Host "  INSTALADOR LISTO" -ForegroundColor Green
    Write-Host "  Ruta:   $($installer.FullName)" -ForegroundColor White
    Write-Host "  Tamano: $sizeMB MB" -ForegroundColor White
    Write-Host "  Tiempo: $elapsed min total" -ForegroundColor DarkGray
} else {
    Write-Host "  Build completado -- revisa dist-electron\" -ForegroundColor Yellow
}
Write-Host "=====================================================" -ForegroundColor Green
Write-Host ""
exit 0
