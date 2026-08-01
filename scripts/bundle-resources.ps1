# StudyAI -- Preparar recursos para el instalador
# Copia Whisper models, ffmpeg y Tesseract a resources/
# para que electron-builder los incluya en el instalador.

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$Resources   = Join-Path $ProjectRoot "resources"

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  StudyAI -- Preparar recursos" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# Crear carpetas destino (sin small - solo medium)
New-Item -ItemType Directory -Force "$Resources\whisper-models\medium" | Out-Null
New-Item -ItemType Directory -Force "$Resources\ffmpeg"                | Out-Null
New-Item -ItemType Directory -Force "$Resources\tesseract"             | Out-Null

$HF_Cache = "$env:USERPROFILE\.cache\huggingface\hub"

# ----------------------------------------------------------------------------
# Funcion auxiliar: copia archivos de un snapshot HuggingFace resolviendo symlinks
# ----------------------------------------------------------------------------
function Copy-HFSnapshot($snapshotPath, $destDir) {
    Get-ChildItem $snapshotPath | ForEach-Object {
        $item = $_
        $destFile = Join-Path $destDir $item.Name
        if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
            # Es un symlink -- resolver la ruta real
            # En PS 5.1 .Target puede ser String[] -- tomamos el primer elemento
            $targetRaw = (Get-Item $item.FullName -Force).Target
            if ($targetRaw -is [array]) {
                $realPath = [string]$targetRaw[0]
            } else {
                $realPath = [string]$targetRaw
            }
            if (-not [System.IO.Path]::IsPathRooted($realPath)) {
                $realPath = Join-Path (Split-Path $item.FullName) $realPath
            }
            $realPath = [System.IO.Path]::GetFullPath($realPath)
            if (Test-Path $realPath) {
                Copy-Item $realPath $destFile -Force
            }
        } else {
            Copy-Item $item.FullName $destFile -Force
        }
    }
}

# ----------------------------------------------------------------------------
# Funcion auxiliar: encuentra el snapshot mas reciente de un modelo HF
# ----------------------------------------------------------------------------
function Find-HFSnapshot($modelName) {
    $snapshotsDir = "$HF_Cache\$modelName\snapshots"
    if (-not (Test-Path $snapshotsDir)) { return $null }
    $snap = Get-ChildItem $snapshotsDir -Directory | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($snap) { return $snap.FullName }
    return $null
}

# ----------------------------------------------------------------------------
# 1. WHISPER MEDIUM
# ----------------------------------------------------------------------------
Write-Host "1/4  Whisper medium..." -ForegroundColor Yellow

$mediumSnap = Find-HFSnapshot "models--Systran--faster-whisper-medium"
if ($mediumSnap) {
    $dest = "$Resources\whisper-models\medium"
    Copy-HFSnapshot $mediumSnap $dest
    Write-Host "     OK  Whisper medium copiado desde: $mediumSnap" -ForegroundColor Green
} else {
    Write-Host "     WARN  Whisper medium no encontrado en HuggingFace cache" -ForegroundColor Red
    Write-Host "           Abre la app una vez para que se descargue automaticamente" -ForegroundColor Gray
}

# ----------------------------------------------------------------------------
# 2. FFMPEG
# ----------------------------------------------------------------------------
Write-Host "2/3  ffmpeg..." -ForegroundColor Yellow

# IMPORTANTE -- licencia: el ffmpeg de winget/choco/scoop es casi siempre un
# "build GPL completo" (incluye libx264/libx265), lo cual obligaria a que TODO
# el binario se distribuya bajo GPL -- incompatible con una app comercial de
# codigo cerrado. Por eso SIEMPRE se prioriza la copia LGPL propia del
# proyecto (assets/ffmpeg-lgpl/ffmpeg.exe, build oficial de BtbN/FFmpeg-Builds
# sin --enable-gpl) antes que cualquier ffmpeg del sistema. Los candidatos de
# abajo solo son un respaldo si esa copia no existiera.
$ffmpegSrc = $null
$ffmpegLgpl = Join-Path $ProjectRoot "assets\ffmpeg-lgpl\ffmpeg.exe"
if (Test-Path $ffmpegLgpl) {
    $ffmpegSrc = $ffmpegLgpl
    Write-Host "     Usando copia LGPL del proyecto (assets\ffmpeg-lgpl\ffmpeg.exe)" -ForegroundColor DarkGray
}

# Buscar en rutas habituales
$candidates = @(
    "$env:LOCALAPPDATA\Microsoft\WinGet\Links\ffmpeg.exe",
    "C:\ProgramData\chocolatey\bin\ffmpeg.exe",
    "$env:USERPROFILE\scoop\shims\ffmpeg.exe"
)

if (-not $ffmpegSrc) {
    foreach ($c in $candidates) {
        if (Test-Path $c) {
            $ffmpegSrc = $c
            break
        }
    }
}

# Buscar en WinGet Packages con glob
if (-not $ffmpegSrc) {
    $wingetPkg = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages"
    if (Test-Path $wingetPkg) {
        $found = Get-ChildItem $wingetPkg -Recurse -Filter "ffmpeg.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found) { $ffmpegSrc = $found.FullName }
    }
}

# Buscar en PATH
if (-not $ffmpegSrc) {
    $cmd = Get-Command ffmpeg -ErrorAction SilentlyContinue
    if ($cmd) { $ffmpegSrc = $cmd.Source }
}

# Resolver symlink si es necesario
if ($ffmpegSrc -and (Test-Path $ffmpegSrc)) {
    $item = Get-Item $ffmpegSrc -Force
    if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
        $resolved = $item.Target
        if (Test-Path $resolved) { $ffmpegSrc = $resolved }
    }
}

if ($ffmpegSrc -and (Test-Path $ffmpegSrc)) {
    Copy-Item $ffmpegSrc "$Resources\ffmpeg\ffmpeg.exe" -Force
    $mb = [math]::Round((Get-Item "$Resources\ffmpeg\ffmpeg.exe").Length / 1MB)
    Write-Host "     OK  ffmpeg.exe copiado ($mb MB)" -ForegroundColor Green
} else {
    Write-Host "     WARN  ffmpeg.exe no encontrado" -ForegroundColor Red
    Write-Host "           Instala con: winget install Gyan.FFmpeg" -ForegroundColor Gray
    Write-Host "           O copia manualmente ffmpeg.exe a resources\ffmpeg\" -ForegroundColor Gray
}

# ----------------------------------------------------------------------------
# 4. TESSERACT OCR
# ----------------------------------------------------------------------------
Write-Host "3/3  Tesseract..." -ForegroundColor Yellow

$tesseractCandidates = @(
    "C:\Program Files\Tesseract-OCR",
    "C:\Program Files (x86)\Tesseract-OCR",
    "$env:LOCALAPPDATA\Programs\Tesseract-OCR"
)

$tesseractSrc = $null
foreach ($c in $tesseractCandidates) {
    if (Test-Path "$c\tesseract.exe") {
        $tesseractSrc = $c
        break
    }
}

if ($tesseractSrc) {
    Write-Host "     Copiando desde $tesseractSrc ..." -ForegroundColor Gray

    # Copiar ejecutable
    Copy-Item "$tesseractSrc\tesseract.exe" "$Resources\tesseract\" -Force

    # Copiar DLLs
    Get-ChildItem "$tesseractSrc\*.dll" -ErrorAction SilentlyContinue |
        Copy-Item -Destination "$Resources\tesseract\" -Force

    # Copiar tessdata
    $destTessdata = "$Resources\tesseract\tessdata"
    New-Item -ItemType Directory -Force $destTessdata | Out-Null

    $langs = @("spa.traineddata", "eng.traineddata", "osd.traineddata")
    foreach ($lang in $langs) {
        $src = "$tesseractSrc\tessdata\$lang"
        if (Test-Path $src) {
            Copy-Item $src "$destTessdata\" -Force
            Write-Host "     + $lang" -ForegroundColor Gray
        }
    }

    # Copiar traineddata adicionales que tenga el usuario
    Get-ChildItem "$tesseractSrc\tessdata\*.traineddata" -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -notin $langs } |
        ForEach-Object {
            Copy-Item $_.FullName "$destTessdata\" -Force
            Write-Host "     + $($_.Name)" -ForegroundColor Gray
        }

    Write-Host "     OK  Tesseract copiado" -ForegroundColor Green
} else {
    Write-Host "     WARN  Tesseract no encontrado" -ForegroundColor Red
    Write-Host "           Descargalo desde: https://github.com/UB-Mannheim/tesseract/wiki" -ForegroundColor Gray
}

# ----------------------------------------------------------------------------
# Resumen
# ----------------------------------------------------------------------------
Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  Resumen de resources\" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

$checks = @(
    @{ Name = "Whisper medium"; Path = "$Resources\whisper-models\medium" },
    @{ Name = "ffmpeg.exe";     Path = "$Resources\ffmpeg\ffmpeg.exe" },
    @{ Name = "tesseract.exe";  Path = "$Resources\tesseract\tesseract.exe" }
)

$allOk = $true
foreach ($c in $checks) {
    if (Test-Path $c.Path) {
        Write-Host ("  OK  {0}" -f $c.Name) -ForegroundColor Green
    } else {
        Write-Host ("  MISS  {0}" -f $c.Name) -ForegroundColor Red
        if ($c.Name -like "Whisper medium" -or $c.Name -like "ffmpeg*") {
            $allOk = $false
        }
    }
}

Write-Host ""
if ($allOk) {
    Write-Host "  Recursos listos para el build" -ForegroundColor Green
} else {
    Write-Host "  Faltan recursos criticos. Revisa los avisos arriba." -ForegroundColor Red
    exit 1
}
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""
exit 0
