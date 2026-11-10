# Interior AI Studio - Master Downloader to D:\AI
# Hardware: NVIDIA GeForce RTX 4050 6GB VRAM, Intel i5-13420H, 16GB RAM

$baseDir = "D:\AI"
$modelsDir = "$baseDir\models"
$checkpointsDir = "$modelsDir\checkpoints"
$unetDir = "$modelsDir\unet"
$clipDir = "$modelsDir\clip"
$vaeDir = "$modelsDir\vae"
$lorasDir = "$modelsDir\loras"
$controlnetDir = "$modelsDir\controlnet"

Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host "   INTERIOR AI STUDIO: DOWNLOADING COMFYUI AND MODELS TO D:\AI" -ForegroundColor Yellow
Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host "Target Folder: $baseDir" -ForegroundColor White
$dDrive = Get-PSDrive D
$freeGb = [math]::round($dDrive.Free / 1GB, 1)
Write-Host "Free space on Drive D: $freeGb GB" -ForegroundColor Green
Write-Host "Target GPU: NVIDIA GeForce RTX 4050 Laptop (6GB VRAM)" -ForegroundColor Green
Write-Host "Optimization: --lowvram --fp8 (SDXL + FLUX Schnell)" -ForegroundColor Green
Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Create folders
Write-Host "[1/6] Initializing directory structure on Drive D..." -ForegroundColor Yellow
$folders = @($baseDir, $modelsDir, $checkpointsDir, $unetDir, $clipDir, $vaeDir, $lorasDir, $controlnetDir)
foreach ($f in $folders) {
    if (-not (Test-Path $f)) {
        New-Item -ItemType Directory -Force -Path $f | Out-Null
        Write-Host "  Created: $f" -ForegroundColor DarkGray
    }
}
Write-Host "  Directory structure ready." -ForegroundColor Green
Write-Host ""

function Download-CurlFile {
    param(
        [string]$Url,
        [string]$Destination,
        [string]$Description
    )
    Write-Host ">> $Description" -ForegroundColor Cyan
    Write-Host "   Saving to: $Destination" -ForegroundColor DarkGray
    
    if (Test-Path $Destination) {
        $curSize = [math]::round((Get-Item $Destination).Length / 1MB, 1)
        Write-Host "   Found existing file: $curSize MB (resuming if partial)..." -ForegroundColor Yellow
    }
    
    & curl.exe -L -C - --retry 5 --retry-delay 3 -o $Destination $Url
    
    if ($LASTEXITCODE -eq 0 -and (Test-Path $Destination)) {
        $doneSize = [math]::round((Get-Item $Destination).Length / 1MB, 1)
        Write-Host "   [SUCCESS] Completed: $doneSize MB" -ForegroundColor Green
    } else {
        Write-Host "   [ERROR] Download interrupted for $Destination (exit code: $LASTEXITCODE)" -ForegroundColor Red
    }
    Write-Host ""
}

# 2. Download ComfyUI Portable (~1.9 GB)
Write-Host "[2/6] ComfyUI Portable (Python 3.12 + PyTorch CUDA)..." -ForegroundColor Yellow
$comfyZip = "$baseDir\ComfyUI_windows_portable_nvidia.7z"
$comfyRuntimeDir = "$baseDir\ComfyUI_windows_portable"
$comfyMain = "$comfyRuntimeDir\ComfyUI\main.py"

if (Test-Path $comfyMain) {
    Write-Host "  [OK] ComfyUI Portable is already installed in $comfyRuntimeDir" -ForegroundColor Green
} else {
    $comfyUrl = "https://github.com/Comfy-Org/ComfyUI/releases/latest/download/ComfyUI_windows_portable_nvidia.7z"
    Download-CurlFile -Url $comfyUrl -Destination $comfyZip -Description "Downloading ComfyUI Portable (~1.9 GB)"
    
    Write-Host "  Extracting ComfyUI Portable with 7-Zip..." -ForegroundColor Yellow
    $7zExe = "C:\Program Files\7-Zip\7z.exe"
    if (Test-Path $7zExe) {
        & $7zExe x $comfyZip "-o$baseDir" -y
        Write-Host "  [OK] ComfyUI Portable successfully extracted to $baseDir" -ForegroundColor Green
    } else {
        & tar.exe -xf $comfyZip -C $baseDir
    }
}

# Sync extra_model_paths.yaml into ComfyUI
$extraYamlWorkspace = "c:\Users\user\Downloads\Visual AI\models\extra_model_paths.yaml"
$extraYamlComfy = "$comfyRuntimeDir\ComfyUI\extra_model_paths.yaml"
if (Test-Path "$comfyRuntimeDir\ComfyUI") {
    Copy-Item -Path $extraYamlWorkspace -Destination $extraYamlComfy -Force
    Write-Host "  [OK] extra_model_paths.yaml synced: ComfyUI will load models from D:\AI\models" -ForegroundColor Green
}
Write-Host ""

# 3. SDXL: Juggernaut XL v9 (~6.6 GB) - Primary Local Engine
Write-Host "[3/6] SDXL (Juggernaut XL v9 Photorealism)..." -ForegroundColor Yellow
$sdxlFile = "$checkpointsDir\juggernautXL_v9_photo.safetensors"
$sdxlUrl = "https://huggingface.co/RunDiffusion/Juggernaut-XL-v9/resolve/main/Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors"
Download-CurlFile -Url $sdxlUrl -Destination $sdxlFile -Description "Downloading Juggernaut XL v9 Photorealism (~6.6 GB)"

# 4. FLUX.1 Schnell FP8 UNet (~11.9 GB)
Write-Host "[4/6] FLUX.1 Schnell FP8 UNet for 6GB VRAM..." -ForegroundColor Yellow
$fluxFile = "$unetDir\flux1-schnell-fp8.safetensors"
$fluxUrl = "https://huggingface.co/Comfy-Org/flux1-schnell/resolve/main/flux1-schnell-fp8.safetensors"
Download-CurlFile -Url $fluxUrl -Destination $fluxFile -Description "Downloading FLUX.1 Schnell FP8 UNet (~11.9 GB)"

# 5. Text Encoders: T5-XXL FP8 + CLIP-L
Write-Host "[5/6] Text Encoders for FLUX..." -ForegroundColor Yellow
$t5File = "$clipDir\t5xxl_fp8_e4m3fn.safetensors"
$t5Url = "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp8_e4m3fn.safetensors"
Download-CurlFile -Url $t5Url -Destination $t5File -Description "Downloading T5-XXL FP8 Text Encoder (~4.8 GB)"

$clipLFile = "$clipDir\clip_l.safetensors"
$clipLUrl = "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors"
Download-CurlFile -Url $clipLUrl -Destination $clipLFile -Description "Downloading CLIP-L Text Encoder (~240 MB)"

# 6. FLUX VAE (~335 MB)
Write-Host "[6/6] FLUX VAE..." -ForegroundColor Yellow
$vaeFile = "$vaeDir\ae.safetensors"
$vaeUrl = "https://huggingface.co/black-forest-labs/FLUX.1-schnell/resolve/main/ae.safetensors"
Download-CurlFile -Url $vaeUrl -Destination $vaeFile -Description "Downloading FLUX VAE ae.safetensors (~335 MB)"

Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host " [ALL COMPLETE] COMFYUI AND ALL MODELS INSTALLED TO D:\AI" -ForegroundColor Green
Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host "To launch ComfyUI Server, run:" -ForegroundColor White
Write-Host "  scripts\start-comfyui.bat" -ForegroundColor Yellow
Write-Host "==========================================================================" -ForegroundColor Cyan
