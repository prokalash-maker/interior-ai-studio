@echo off
chcp 65001 >nul
title Interior AI Studio — ComfyUI Local Server (RTX 4050 6GB)

echo =====================================================================
echo   Interior AI Studio: Запуск локального сервера ComfyUI
echo   Целевой GPU: NVIDIA RTX 4050 Laptop (6GB VRAM)
echo   Режим оптимизации: --lowvram --fp8_e4m3fn-text-enc (CORS: *)
echo =====================================================================
echo.

rem 1. Check Drive D install path
set D_INSTALL=d:\AI\ComfyUI_windows_portable
set C_INSTALL=c:\Users\user\Downloads\Visual AI\comfyui_runtime
set MODELS_EXTRA=c:\Users\user\Downloads\Visual AI\models\extra_model_paths.yaml

if exist "%D_INSTALL%\ComfyUI\main.py" (
    set TARGET_DIR=%D_INSTALL%
    echo [OK] Найден ComfyUI на Диске D: %D_INSTALL%
) else if exist "%C_INSTALL%\ComfyUI\main.py" (
    set TARGET_DIR=%C_INSTALL%
    echo [OK] Найден ComfyUI в рабочей папке: %C_INSTALL%
) else if exist "d:\AI\ComfyUI\main.py" (
    set TARGET_DIR=d:\AI
    echo [OK] Найден ComfyUI в d:\AI
) else (
    echo [ВНИМАНИЕ] ComfyUI еще не распакован в %D_INSTALL%.
    set TARGET_DIR=%D_INSTALL%
)

rem 2. Sync extra_model_paths.yaml so ComfyUI sees models on D:\AI\models
if exist "%TARGET_DIR%\ComfyUI" (
    copy /Y "%MODELS_EXTRA%" "%TARGET_DIR%\extra_model_paths.yaml" >nul 2>&1
    copy /Y "%MODELS_EXTRA%" "%TARGET_DIR%\ComfyUI\extra_model_paths.yaml" >nul 2>&1
    echo [OK] extra_model_paths.yaml синхронизирован с ComfyUI
)

echo.
echo Запуск ComfyUI на порту 8188...
echo Для остановки нажмите Ctrl+C в этом окне.
echo.

cd /d "%TARGET_DIR%"

rem 3. Launch with embedded Python and RTX 4050 flags
if exist "%TARGET_DIR%\python_embeded\python.exe" (
    "%TARGET_DIR%\python_embeded\python.exe" -s "%TARGET_DIR%\ComfyUI\main.py" --windows-standalone-build --lowvram --fp8_e4m3fn-text-enc --listen 127.0.0.1 --port 8188 --enable-cors-header * --extra-model-paths-config "%TARGET_DIR%\extra_model_paths.yaml"
) else if exist "%TARGET_DIR%\run_nvidia_gpu.bat" (
    call run_nvidia_gpu.bat
) else (
    python "%TARGET_DIR%\ComfyUI\main.py" --lowvram --fp8_e4m3fn-text-enc --listen 127.0.0.1 --port 8188 --enable-cors-header *
)

pause
