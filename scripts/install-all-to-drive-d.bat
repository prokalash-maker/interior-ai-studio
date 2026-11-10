@echo off
chcp 65001 >nul
title Interior AI Studio — Установка ComfyUI и Моделей на Диск D (D:\AI)
echo ======================================================================
echo   Запуск загрузки полного комплекта ComfyUI + SDXL + FLUX в D:\AI
echo ======================================================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-all-to-drive-d.ps1"

pause
