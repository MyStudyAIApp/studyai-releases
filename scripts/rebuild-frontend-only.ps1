# StudyAI -- Rebuild rapido: solo frontend + empaquetado Electron + instalador
# Salta bundle-resources y la compilacion del backend Python (sin cambios, ya compilados con DLLs NVIDIA)
# Usar tras cambios solo de frontend (React/JSX) para no perder ~10 min recompilando el backend.

$ErrorActionPreference = 'Stop'
$StartTime = Get-Date
$ProjectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $ProjectRoot

function Write-Step($msg) {
    Write-Host ""
    Write-Host "-----------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "  $msg" -ForegroundColor Cyan
    Write-Host "-----------------------------------------------------" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  StudyAI -- Rebuild rapido (frontend + instalador)" -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm')" -ForegroundColor DarkGray
Write-Host "=====================================================" -ForegroundColor Cyan

# Verificar que el backend ya compilado existe (lo reutilizamos tal cual)
$backendExe = "$ProjectRoot\python-service\dist\backend\backend.exe"
if (-not (Test-Path $backendExe)) {
    Write-Host "ERROR: No existe $backendExe -- ejecuta el build completo primero" -ForegroundColor Red
    exit 1
}
Write-Host "OK  Reutilizando backend.exe ya compilado (con DLLs NVIDIA): $backendExe" -ForegroundColor Green

# 1. Frontend (Vite)
Write-Step "PASO 1/4  Build frontend (Vite)"
if (Test-Path "$ProjectRoot\dist") { Remove-Item "$ProjectRoot\dist" -Recurse -Force }
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL  Vite build fallo" -ForegroundColor Red; exit 1 }
if (-not (Test-Path "$ProjectRoot\dist\index.html")) { Write-Host "FAIL  No se genero dist/index.html" -ForegroundColor Red; exit 1 }
Write-Host "OK  Frontend compilado" -ForegroundColor Green

# 2. Empaquetar con electron-builder
Write-Step "PASO 2/4  Empaquetar app (electron-builder --dir)"
if (Test-Path "$ProjectRoot\dist-electron") { Remove-Item "$ProjectRoot\dist-electron" -Recurse -Force }
npm run build:electron
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL  electron-builder fallo" -ForegroundColor Red; exit 1 }
if (-not (Test-Path "$ProjectRoot\dist-electron\win-unpacked\MyStudy AI.exe")) { Write-Host "FAIL  win-unpacked no generado" -ForegroundColor Red; exit 1 }
Write-Host "OK  win-unpacked generado" -ForegroundColor Green

# 3. Validacion
Write-Step "PASO 3/4  Validacion pre-instalador"
& "$PSScriptRoot\validate-build.ps1"
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL  validate-build.ps1 detecto errores" -ForegroundColor Red; exit 1 }

# 4. Inno Setup
Write-Step "PASO 4/4  Compilar instalador (Inno Setup)"
& "$PSScriptRoot\build-installer.ps1"
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL  build-installer.ps1 fallo" -ForegroundColor Red; exit 1 }

$elapsed = [math]::Round(((Get-Date) - $StartTime).TotalMinutes, 1)
$installer = Get-ChildItem "$ProjectRoot\dist-electron\StudyAI-Setup.exe" -ErrorAction SilentlyContinue | Select-Object -First 1

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Green
if ($installer) {
    $sizeMB = [math]::Round($installer.Length / 1MB)
    Write-Host "  INSTALADOR LISTO (rebuild rapido)" -ForegroundColor Green
    Write-Host "  Ruta:   $($installer.FullName)" -ForegroundColor White
    Write-Host "  Tamano: $sizeMB MB" -ForegroundColor White
    Write-Host "  Tiempo: $elapsed min total" -ForegroundColor DarkGray
} else {
    Write-Host "  Build completado -- revisa dist-electron\" -ForegroundColor Yellow
}
Write-Host "=====================================================" -ForegroundColor Green
exit 0
