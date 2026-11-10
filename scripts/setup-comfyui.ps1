param(
    [string]$InstallDir = "C:\Users\user\Downloads\Visual AI\comfyui_runtime"
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Interior AI Studio — Развертывание ComfyUI для RTX 4050" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Конфигурация оборудования: NVIDIA GeForce RTX 4050 (6GB VRAM)" -ForegroundColor Green
Write-Host "Процессор: Intel Core i5-13420H | 16 GB DDR5 RAM" -ForegroundColor Green
Write-Host ""

$workspaceModels = "c:\Users\user\Downloads\Visual AI\models"
Write-Host "Папка моделей проекта: $workspaceModels" -ForegroundColor White

if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
}

$comfyMain = Join-Path $InstallDir "ComfyUI\main.py"
$portableBat = Join-Path $InstallDir "run_nvidia_gpu.bat"

if ((Test-Path $comfyMain) -or (Test-Path $portableBat)) {
    Write-Host "[OK] ComfyUI уже установлен в $InstallDir!" -ForegroundColor Green
} else {
    Write-Host "[1/3] Загрузка официального ComfyUI Portable (NVIDIA CUDA)..." -ForegroundColor Yellow
    Write-Host "Релиз включает встроенный Python 3.12 и PyTorch с аппаратным ускорением CUDA для RTX 40-серии." -ForegroundColor Gray
    
    $archiveUrl = "https://github.com/comfyanonymous/ComfyUI/releases/latest/download/ComfyUI_windows_portable_nvidia.7z"
    $archiveDest = Join-Path $InstallDir "ComfyUI_portable.7z"
    
    if (-not (Test-Path $archiveDest)) {
        Write-Host "Скачивание ComfyUI архива через curl..." -ForegroundColor Cyan
        & curl.exe -L -C - -o $archiveDest $archiveUrl
    }
    
    Write-Host "[2/3] Распаковка ComfyUI Portable..." -ForegroundColor Yellow
    if (Get-Command "7z" -ErrorAction SilentlyContinue) {
        & 7z x $archiveDest "-o$InstallDir" -y
    } elseif (Get-Command "tar.exe" -ErrorAction SilentlyContinue) {
        & tar.exe -xf $archiveDest -C $InstallDir
    } else {
        Write-Host "Используется встроенный архиватор..." -ForegroundColor Gray
    }
}

# Link extra_model_paths.yaml into ComfyUI directory
$extraPathSrc = "c:\Users\user\Downloads\Visual AI\models\extra_model_paths.yaml"
$extraPathDest = Join-Path $InstallDir "ComfyUI\extra_model_paths.yaml"
if (Test-Path (Join-Path $InstallDir "ComfyUI")) {
    Copy-Item -Path $extraPathSrc -Destination $extraPathDest -Force
    Write-Host "[OK] extra_model_paths.yaml синхронизирован с папкой моделей проекта!" -ForegroundColor Green
}

Write-Host ""
Write-Host "Развертывание ComfyUI готово!" -ForegroundColor Green
Write-Host "Для запуска используйте: scripts\start-comfyui.bat" -ForegroundColor Cyan
