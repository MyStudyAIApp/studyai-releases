# StudyAI -- Build backend.exe con PyInstaller
# Crea un ejecutable autonomo que incluye Python + todos los paquetes.
# El resultado queda en: python-service/dist/backend/

$ErrorActionPreference = 'Stop'
$Python = "C:\Users\rinco\AppData\Local\Programs\Python\Python312\python.exe"
$PythonScripts = "C:\Users\rinco\AppData\Local\Programs\Python\Python312\Scripts"
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$ServiceDir  = Join-Path $ProjectRoot "python-service"

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  StudyAI -- Build backend.exe" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar Python
if (-not (Test-Path $Python)) {
    Write-Host "ERROR: Python 3.12 no encontrado en $Python" -ForegroundColor Red
    exit 1
}
Write-Host "OK  Python: $(&$Python --version)" -ForegroundColor Green

# 2. Instalar PyInstaller si no esta
$pyinstaller = Join-Path $PythonScripts "pyinstaller.exe"
if (-not (Test-Path $pyinstaller)) {
    Write-Host "Instalando PyInstaller..." -ForegroundColor Yellow
    & $Python -m pip install pyinstaller --quiet
    Write-Host "OK  PyInstaller instalado" -ForegroundColor Green
} else {
    Write-Host "OK  PyInstaller ya disponible" -ForegroundColor Green
}

# 3. Limpiar builds anteriores
$distDir  = Join-Path $ServiceDir "dist"
$buildDir = Join-Path $ServiceDir "build"
if (Test-Path $distDir)  { Remove-Item $distDir  -Recurse -Force }
if (Test-Path $buildDir) { Remove-Item $buildDir -Recurse -Force }
Write-Host "OK  Directorio limpio" -ForegroundColor Green

# 4. Ejecutar PyInstaller
Write-Host ""
Write-Host "Ejecutando PyInstaller (puede tardar 5-10 min)..." -ForegroundColor Yellow
Set-Location $ServiceDir

& $Python -m PyInstaller `
    --name=backend `
    --onedir `
    --console `
    --noupx `
    --collect-all faster_whisper `
    --collect-all ctranslate2 `
    --collect-binaries nvidia `
    --collect-all google.generativeai `
    --collect-all google.genai `
    --collect-all anthropic `
    --collect-all langdetect `
    --collect-all pymupdf `
    --collect-all fitz `
    --collect-all pytesseract `
    --collect-all pyttsx3 `
    --collect-all edge_tts `
    --hidden-import=uvicorn.logging `
    --hidden-import=uvicorn.loops `
    --hidden-import=uvicorn.loops.auto `
    --hidden-import=uvicorn.protocols `
    --hidden-import=uvicorn.protocols.http `
    --hidden-import=uvicorn.protocols.http.auto `
    --hidden-import=uvicorn.protocols.websockets `
    --hidden-import=uvicorn.protocols.websockets.auto `
    --hidden-import=uvicorn.lifespan `
    --hidden-import=uvicorn.lifespan.on `
    --hidden-import=aiosqlite `
    --hidden-import=sqlalchemy.dialects.sqlite `
    --hidden-import=sqlalchemy.dialects.sqlite.aiosqlite `
    --hidden-import=multiprocessing.freeze_support `
    --hidden-import=psutil `
    --hidden-import=httpx `
    --hidden-import=reportlab `
    --hidden-import=docx `
    --hidden-import=PIL `
    --add-data "ai;ai" `
    --add-data "db;db" `
    --add-data "processors;processors" `
    main.py

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: PyInstaller fallo con codigo $LASTEXITCODE" -ForegroundColor Red
    Set-Location $ProjectRoot
    exit 1
}

Set-Location $ProjectRoot

# 5. Quitar las librerias NVIDIA CUDA (cublas/cudnn/cuda_nvrtc) del bundle.
# PyInstaller las incluye automaticamente porque faster-whisper -> ctranslate2
# tira de los paquetes pip nvidia-cublas-cu12/nvidia-cudnn-cu12 -- pesan ~1.9GB
# y solo las aprovecha quien tiene GPU NVIDIA compatible. Se descargan aparte
# bajo demanda (ver electron/main.js: maybeAutoDownloadCudaPack) en vez de ir
# dentro del instalador para el 100% de los usuarios.
$nvidiaDir = Join-Path $ServiceDir "dist\backend\_internal\nvidia"
if (Test-Path $nvidiaDir) {
    $nvidiaSize = [math]::Round((Get-ChildItem $nvidiaDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB)
    Remove-Item $nvidiaDir -Recurse -Force
    Write-Host "  INFO  Quitadas librerias NVIDIA del bundle (-${nvidiaSize}MB) -- se descargan aparte si hace falta" -ForegroundColor DarkGray
}

# 6. Verificar resultado
$backendExe = Join-Path $ServiceDir "dist\backend\backend.exe"
if (Test-Path $backendExe) {
    $size = [math]::Round((Get-ChildItem (Join-Path $ServiceDir "dist\backend") -Recurse |
        Measure-Object -Property Length -Sum).Sum / 1MB)
    Write-Host ""
    Write-Host "=====================================================" -ForegroundColor Green
    Write-Host "  OK  backend.exe generado correctamente" -ForegroundColor Green
    Write-Host "  Ruta:   python-service\dist\backend\backend.exe" -ForegroundColor Green
    Write-Host "  Tamano: ~$size MB" -ForegroundColor Green
    Write-Host "=====================================================" -ForegroundColor Green
    exit 0
} else {
    Write-Host "ERROR: backend.exe no encontrado tras el build" -ForegroundColor Red
    exit 1
}
