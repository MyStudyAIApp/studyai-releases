# StudyAI -- Compilar instalador con Inno Setup
# Genera dist-electron\StudyAI-Setup.exe sin limite de tamano

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$IssFile     = Join-Path $ProjectRoot "build\installer.iss"
$IsccPaths   = @(
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    "C:\Program Files\Inno Setup 6\ISCC.exe",
    "C:\Program Files (x86)\Inno Setup 5\ISCC.exe",
    "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe",
    "$env:LOCALAPPDATA\Programs\Inno Setup 5\ISCC.exe"
)

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  StudyAI -- Compilar instalador (Inno Setup)" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# ---- 1. Buscar o instalar Inno Setup ----
$iscc = $null
foreach ($p in $IsccPaths) {
    if (Test-Path $p) { $iscc = $p; break }
}

if (-not $iscc) {
    Write-Host "Inno Setup no encontrado. Instalando via winget..." -ForegroundColor Yellow
    winget install JRSoftware.InnoSetup --silent --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: No se pudo instalar Inno Setup con winget" -ForegroundColor Red
        Write-Host "Descargalo manualmente desde https://jrsoftware.org/isdl.php" -ForegroundColor Gray
        exit 1
    }
    # Volver a buscar
    foreach ($p in $IsccPaths) {
        if (Test-Path $p) { $iscc = $p; break }
    }
}

if (-not $iscc) {
    Write-Host "ERROR: ISCC.exe no encontrado tras la instalacion" -ForegroundColor Red
    exit 1
}

Write-Host "OK  Inno Setup: $iscc" -ForegroundColor Green

# ---- 2. Verificar que win-unpacked existe ----
$winUnpacked = Join-Path $ProjectRoot "dist-electron\win-unpacked"
if (-not (Test-Path "$winUnpacked\MyStudy AI.exe")) {
    Write-Host "ERROR: dist-electron\win-unpacked no existe o esta vacio" -ForegroundColor Red
    Write-Host "       Ejecuta primero: npm run build && npm run build:electron" -ForegroundColor Gray
    exit 1
}

$sizeMB = [math]::Round((Get-ChildItem $winUnpacked -Recurse | Measure-Object Length -Sum).Sum / 1MB)
Write-Host "OK  win-unpacked: $sizeMB MB de archivos a empaquetar" -ForegroundColor Green

# ---- 3. Compilar con Inno Setup ----
Write-Host ""
Write-Host "Compilando instalador con Inno Setup (puede tardar 10-20 min)..." -ForegroundColor Yellow
Write-Host "   Compresion lzma2/ultra64 - sin limite de tamano" -ForegroundColor DarkGray
Write-Host ""

Set-Location $ProjectRoot
& $iscc $IssFile

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Inno Setup fallo con codigo $LASTEXITCODE" -ForegroundColor Red
    Set-Location $ProjectRoot
    exit 1
}

# ---- 4. Verificar resultado ----
$installer = Join-Path $ProjectRoot "dist-electron\StudyAI-Setup.exe"
if (Test-Path $installer) {
    $gb = [math]::Round((Get-Item $installer).Length / 1GB, 2)
    $mb = [math]::Round((Get-Item $installer).Length / 1MB)
    Write-Host ""
    Write-Host "=====================================================" -ForegroundColor Green
    Write-Host "  INSTALADOR LISTO" -ForegroundColor Green
    Write-Host "  Archivo: dist-electron\StudyAI-Setup.exe" -ForegroundColor White
    Write-Host "  Tamano:  $gb GB  ($mb MB)" -ForegroundColor White
    Write-Host "=====================================================" -ForegroundColor Green
    Write-Host ""
    Start-Process explorer.exe (Split-Path $installer)
    exit 0
} else {
    Write-Host "ERROR: StudyAI-Setup.exe no encontrado tras la compilacion" -ForegroundColor Red
    exit 1
}
