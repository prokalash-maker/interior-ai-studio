param(
    [string]$Target = "all" # "sdxl", "flux", or "all"
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Interior AI Studio — Загрузчик архитектурных моделей" -ForegroundColor Yellow
Write-Host "  Целевой GPU: NVIDIA RTX 4050 6GB • Папка: models\" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$modelsRoot = "c:\Users\user\Downloads\Visual AI\models"
$checkpointsDir = Join-Path $modelsRoot "checkpoints"
$unetDir = Join-Path $modelsRoot "unet"
$clipDir = Join-Path $modelsRoot "clip"
$vaeDir = Join-Path $modelsRoot "vae"

# 1. SDXL — Juggernaut XL v9 (Основной локальный движок)
if ($Target -eq "sdxl" -or $Target -eq "all") {
    $sdxlDest = Join-Path $checkpointsDir "juggernautXL_v9_photo.safetensors"
    Write-Host "[1/2] Проверка модели SDXL (Juggernaut XL v9)..." -ForegroundColor Yellow
    if (Test-Path $sdxlDest) {
        Write-Host "  [OK] Juggernaut XL v9 уже загружен: $sdxlDest" -ForegroundColor Green
    } else {
        Write-Host "  Скачивание Juggernaut XL v9 (~6.6 GB) для фотореализма интерьеров Archicad..." -ForegroundColor Cyan
        $sdxlUrl = "https://huggingface.co/RunDiffusion/Juggernaut-XL-v9/resolve/main/Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors"
        & curl.exe -L -C - -o $sdxlDest $sdxlUrl
    }
}

# 2. FLUX.1 Schnell FP8 + CLIP (Эксперименты с максимальным качеством)
if ($Target -eq "flux" -or $Target -eq "all") {
    Write-Host ""
    Write-Host "[2/2] Проверка модели FLUX.1 Schnell (Квантованный FP8 для 6GB VRAM)..." -ForegroundColor Yellow
    
    $fluxUnet = Join-Path $unetDir "flux1-schnell-fp8.safetensors"
    if (Test-Path $fluxUnet) {
        Write-Host "  [OK] FLUX.1 Schnell FP8 UNet уже загружен: $fluxUnet" -ForegroundColor Green
    } else {
        Write-Host "  Скачивание FLUX.1 Schnell FP8 (~11.9 GB)..." -ForegroundColor Cyan
        $fluxUrl = "https://huggingface.co/Comfy-Org/flux1-schnell/resolve/main/flux1-schnell-fp8.safetensors"
        & curl.exe -L -C - -o $fluxUnet $fluxUrl
    }

    $clipT5 = Join-Path $clipDir "t5xxl_fp8_e4m3fn.safetensors"
    if (Test-Path $clipT5) {
        Write-Host "  [OK] T5-XXL FP8 Text Encoder уже загружен: $clipT5" -ForegroundColor Green
    } else {
        Write-Host "  Скачивание T5-XXL FP8 Text Encoder (~4.8 GB)..." -ForegroundColor Cyan
        $t5Url = "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp8_e4m3fn.safetensors"
        & curl.exe -L -C - -o $clipT5 $t5Url
    }

    $clipL = Join-Path $clipDir "clip_l.safetensors"
    if (-not (Test-Path $clipL)) {
        Write-Host "  Скачивание CLIP-L (~240 MB)..." -ForegroundColor Cyan
        $clipLUrl = "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors"
        & curl.exe -L -C - -o $clipL $clipLUrl
    }

    $vae = Join-Path $vaeDir "ae.safetensors"
    if (-not (Test-Path $vae)) {
        Write-Host "  Скачивание FLUX VAE (~335 MB)..." -ForegroundColor Cyan
        $vaeUrl = "https://huggingface.co/black-forest-labs/FLUX.1-schnell/resolve/main/ae.safetensors"
        & curl.exe -L -C - -o $vae $vaeUrl
    }
}

Write-Host ""
Write-Host "Готово! Все модели готовы для локального инференса в Interior AI Studio." -ForegroundColor Green
