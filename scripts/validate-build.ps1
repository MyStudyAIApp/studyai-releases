# StudyAI -- Validacion pre-build
# Ejecutar ANTES de Inno Setup para detectar todos los problemas posibles
# sin esperar 20 minutos de compilacion.

$ErrorActionPreference = 'Continue'
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$WinUnpacked = Join-Path $ProjectRoot "dist-electron\win-unpacked"
$Resources   = Join-Path $WinUnpacked "resources"
$Errors      = @()
$Warnings    = @()

function OK  ($msg) { Write-Host "  OK   $msg" -ForegroundColor Green }
function FAIL($msg) { Write-Host "  FAIL $msg" -ForegroundColor Red;    $script:Errors   += $msg }
function WARN($msg) { Write-Host "  WARN $msg" -ForegroundColor Yellow; $script:Warnings += $msg }

function Check-File($label, $path, $minMB = 0) {
    if (-not (Test-Path $path)) {
        FAIL "$label -- no encontrado: $path"
        return
    }
    $mb = [math]::Round((Get-Item $path).Length / 1MB, 1)
    if ($mb -lt $minMB) {
        FAIL "$label -- demasiado pequeno: ${mb} MB (minimo ${minMB} MB) -- probablemente symlink roto"
        return
    }
    OK "$label  ($mb MB)"
}

function Check-Dir($label, $path) {
    if (-not (Test-Path $path -PathType Container)) {
        FAIL "$label -- carpeta no encontrada: $path"
    } else {
        OK "$label  existe"
    }
}

function Check-NoLock($path) {
    if (-not (Test-Path $path)) { return }
    try {
        $stream = [System.IO.File]::Open($path, 'Open', 'Read', 'None')
        $stream.Close()
    } catch {
        FAIL "Archivo bloqueado por otro proceso: $([System.IO.Path]::GetFileName($path))"
        WARN "Cierra Inno Setup, electron-builder u otros procesos antes de compilar"
    }
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  StudyAI -- Validacion pre-build" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# ---- 1. win-unpacked existe ----
Write-Host "[1] Estructura win-unpacked" -ForegroundColor White
if (-not (Test-Path "$WinUnpacked\MyStudy AI.exe")) {
    FAIL "win-unpacked no existe o no tiene MyStudy AI.exe -- ejecuta electron-builder primero"
} else {
    OK "MyStudy AI.exe existe"
}
Check-File "app.asar"   "$Resources\app.asar"   1

# ---- 2. Backend ----
Write-Host ""
Write-Host "[2] Backend Python" -ForegroundColor White
Check-File "backend.exe"  "$Resources\backend\backend.exe"  10
Check-Dir  "_internal"    "$Resources\backend\_internal"

# ---- 3. Whisper medium ----
# model.bin (1.4 GB) NO se bundlea a proposito -- se descarga a demanda en
# userData/ (ver electron/main.js: ensureWhisperConfigInUserData). Solo los
# 3 archivos de config pequenos van en el instalador.
Write-Host ""
Write-Host "[3] Whisper medium (transcripcion offline)" -ForegroundColor White
Check-File "config.json"    "$Resources\whisper-models\medium\config.json"      0
Check-File "tokenizer.json" "$Resources\whisper-models\medium\tokenizer.json"   0

# ---- 4. FFmpeg ----
Write-Host ""
Write-Host "[4] FFmpeg (audio)" -ForegroundColor White
Check-File "ffmpeg.exe"  "$Resources\ffmpeg\ffmpeg.exe"  50

# ---- 5. Tesseract ----
Write-Host ""
Write-Host "[5] Tesseract OCR" -ForegroundColor White
Check-File "tesseract.exe"     "$Resources\tesseract\tesseract.exe"  0
Check-File "spa.traineddata"   "$Resources\tesseract\tessdata\spa.traineddata"  1
Check-File "eng.traineddata"   "$Resources\tesseract\tessdata\eng.traineddata"  1
Check-File "osd.traineddata"   "$Resources\tesseract\tessdata\osd.traineddata"  5

# ---- 6. Inno Setup disponible ----
Write-Host ""
Write-Host "[6] Herramientas de compilacion" -ForegroundColor White
$isccPaths = @(
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    "C:\Program Files\Inno Setup 6\ISCC.exe",
    "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe"
)
$iscc = $null
foreach ($p in $isccPaths) { if (Test-Path $p) { $iscc = $p; break } }
if ($iscc) { OK "Inno Setup: $iscc" } else { FAIL "Inno Setup no encontrado" }

$issFile = Join-Path $ProjectRoot "build\installer.iss"
if (Test-Path $issFile) { OK "installer.iss existe" } else { FAIL "build\installer.iss no encontrado" }

# ---- 7. Verificar que installer.iss apunta a win-unpacked real ----
Write-Host ""
Write-Host "[7] Coherencia installer.iss" -ForegroundColor White
$issContent = Get-Content $issFile -Raw -ErrorAction SilentlyContinue
if ($issContent) {
    if ($issContent -match 'WizardImageFile') {
        FAIL "installer.iss contiene WizardImageFile -- provoca error en IS 6.7.3, elimina esa linea"
    } else {
        OK "Sin WizardImageFile (correcto)"
    }
    if ($issContent -match 'SourceDir.*win-unpacked') {
        OK "SourceDir apunta a win-unpacked"
    } else {
        WARN "Revisa que SourceDir en installer.iss sea correcto"
    }
    if ($issContent -match 'Compression=lzma2') {
        OK "Compresion lzma2 configurada"
    } else {
        WARN "Compresion no es lzma2 -- puede haber limite de tamano"
    }
}

# ---- 8. Procesos que bloquean archivos ----
Write-Host ""
Write-Host "[8] Archivos bloqueados" -ForegroundColor White
$bigFiles = @(
    "$Resources\whisper-models\medium\model.bin",
    "$Resources\ffmpeg\ffmpeg.exe",
    "$Resources\backend\backend.exe"
)
$anyLocked = $false
foreach ($f in $bigFiles) {
    if (-not (Test-Path $f)) { continue }
    try {
        $s = [System.IO.File]::Open($f, 'Open', 'Read', 'None')
        $s.Close()
    } catch {
        FAIL "BLOQUEADO: $([System.IO.Path]::GetFileName($f)) -- cierra electron-builder / Inno Setup"
        $anyLocked = $true
    }
}
if (-not $anyLocked) { OK "Ningun archivo bloqueado" }

# ---- 9. Tamano total estimado ----
Write-Host ""
Write-Host "[9] Tamano estimado del instalador" -ForegroundColor White
$totalMB = [math]::Round((Get-ChildItem $WinUnpacked -Recurse -File -ErrorAction SilentlyContinue |
    Measure-Object Length -Sum).Sum / 1MB)
OK "win-unpacked: $totalMB MB sin comprimir"
if ($totalMB -gt 5000) {
    WARN "Muy grande ($totalMB MB) -- el instalador puede tardar 30+ min"
} elseif ($totalMB -gt 3000) {
    OK "Tamano normal -- instalador ~20 min aprox"
} else {
    OK "Tamano compacto -- instalador ~10 min aprox"
}

# ---- Resultado final ----
Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
if ($Errors.Count -eq 0) {
    Write-Host "  LISTO para compilar -- sin errores" -ForegroundColor Green
    Write-Host "  Ejecuta: powershell -ExecutionPolicy Bypass -File scripts\build-installer.ps1" -ForegroundColor Gray
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host ""
    exit 0
} else {
    Write-Host "  HAY $($Errors.Count) ERROR(ES) -- corrige antes de compilar" -ForegroundColor Red
    Write-Host ""
    foreach ($e in $Errors)   { Write-Host "  x $e" -ForegroundColor Red }
    foreach ($w in $Warnings) { Write-Host "  ! $w" -ForegroundColor Yellow }
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}
