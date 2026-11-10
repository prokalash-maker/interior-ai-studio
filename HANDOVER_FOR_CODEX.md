# 📘 HANDOVER GUIDE FOR CHATGPT / OPENAI CODEX
**Проект:** AI Designer by V1PERCOREJZ (Professional ArchViz AI Assistant)  
**Версия исходников:** `v2.6.0 Pro` (installer ещё не собран; последняя подтверждённая сборка — v2.5.0)  
**Дата актуализации:** 10.11.2026  
**Рабочая директория проекта:** `D:\AI\Project\Visual AI`  
**Предыдущий исполняемый билд:** `D:\AI\Project\Visual AI\release\win-unpacked\Interior AI Studio.exe` (v2.5.0; не считать новым v2.6.0)

---

## 🎯 1. ВАЖНЫЕ ИЗМЕНЕНИЯ В ОКРУЖЕНИИ (ЧТО ПОМЕНЯЛОСЬ)

### 1.1. Новое расположение проекта
* **Было:** `C:\Users\user\Downloads\Visual AI`
* **Стало:** **`D:\AI\Project\Visual AI`**  
  > ⚠️ Все скрипты сборки, запуск и работа ведутся строго в `D:\AI\Project\Visual AI`.  
  > ComfyUI находится рядом: `D:\AI\ComfyUI_windows_portable\`.  
  > Модели находятся в: `D:\AI\models\`.

### 1.2. Установлен и настроен Codex CLI
* Пакет `@openai/codex` установлен глобально в системе (`codex-cli 0.167.0`).
* В PowerShell Windows из-за Execution Policy запуск выполняется командой:
  ```cmd
  codex.cmd
  ```
* Авторизация: через ChatGPT Plus аккаунт пользователя.

---

## 🚀 2. НОВЫЙ ФУНКЦИОНАЛ, ДОБАВЛЕННЫЙ С ПОСЛЕДНЕГО РЕЛИЗА

### 2.1. «Режим: Дизайнер» (Простой режим для архитекторов)
Файл: `src/views/GenerationStudioView.tsx`
* Добавлен переключатель режимов: **`[✨ Режим: Дизайнер (Простой)]`** vs **`[⚙️ Режим: PRO (Эксперт)]`** (`studioMode` state).
* В «Режиме: Дизайнер» скрыты все сложные технические параметры (CFG, Sampler, Steps, Denoise в цифрах, пороги Canny) и заменены на 5 интуитивных визуальных карточек:
  1. **Тип помещения:** Гостиная, Кухня, Спальня, Ванная, Прихожая, Кабинет, Терраса.
  2. **Стиль дизайна:** Japandi, Минимализм, Скандинавский, Неоклассика, Лофт, Wabi-Sabi, Contemporary.
  3. **Материалы и отделка:** 37 интерактивных PBR-чипов по категориям (дерево, камень, штукатурка, металл, стекло, ткани: американский орех, беленый дуб, травертин Navona, мрамор Calacatta, микроцемент, матовая латунь, рифленое стекло fluted, букле).
  4. **Освещение и время суток:** ☀️ Солнечный полдень, ⛅ Мягкий рассеянный свет, 🌙 Уютный вечер 3000K, 💡 Архитектурный студийный свет.
  5. **Точность геометрии стен (Denoise):**
     * 🔒 *Приоритет геометрии (0.60)* — настройки стараются удержать линии стен и мебели; модель может менять детали.
     * ✨ *Сбалансированный режим (0.75)* — компромисс между сходством с исходником и обработкой материалов.
     * 🎨 *Больше декора (0.82)* — генерация нового декора и смелых текстур.

### 2.2. Встроенный автономный сборщик датасетов (Dataset Harvester)
Файлы: `electron/main.cjs`, `electron/preload.cjs`, `src/types/electron.d.ts`, `src/views/TrainingStudioView.tsx`
* Реализован IPC-мост для автоматического сбора HD-картинок интерьеров и генерации парных `.txt` описаний с профессиональными PBR-тегами.
* Эндпоинты:
  * `window.electronAPI.harvester.searchAndDownload(...)` — сбор HD-изображений (>=1024x768) по 13 пресетам материалов.
  * `window.electronAPI.harvester.getStats(...)` — статистика собранных пар (картинка + txt).
  * `window.electronAPI.harvester.loadImages(...)` — предпросмотр галереи в студии.
  * `window.electronAPI.harvester.openFolder(...)` — открытие папки в Проводнике Windows.
* Добавлена функция копирования в 1 клик собранных картинок в тренировочную папку LoRA.
* Полная трехъязычная локализация (`ru`, `uk`, `en`) в `src/i18n/locales/`.

### 2.3. Инфраструктура LoRA моделей
Папка моделей: `D:\AI\models\loras\`
1. **`Interior_SDXL_v1.0.safetensors` (1.3 ГБ):**  
   * Скачана с Hugging Face (`YucaCreative/interior_design_sdxl`).  
   * База: SDXL 1.0.  
   * Обязательное триггер-слово: `interior design`.
2. **`archviz_materials_library_xl.safetensors`:**  
   * Собственная обученная SDXL LoRA на 1 800 интерьерных сценах (из базы 7 230 интерьеров Hugging Face `hammer888/interior_style_dataset`).  
   * Обучена в Google Colab на NVIDIA Tesla T4 с финальным loss = `0.104`.  
   * Сохранены промежуточные чекпоинты (step 200, 400, 600, 800, 900).
   * Автономный блокнот Colab сохранен в корне: `Interior_AI_Studio_SDXL_LoRA_Trainer.ipynb`.

---

## 🛠️ 3. ТЕКУЩИЙ СТАТУС СБОРКИ ПРОЕКТА
* Проект успешно собирается без ошибок:
  * `npm run build:renderer` (`tsc && vite build`) — компиляция без TypeScript-ошибок за 2.4 сек.
  * `npm run build:electron` — компиляция Electron main/preload.
  * `npm run dist:dir` — упаковка в `D:\AI\Project\Visual AI\release\win-unpacked\Interior AI Studio.exe` (190 МБ).

---

## ⚠️ 4. ПРАВИЛА И ОГРАНИЧЕНИЯ ДЛЯ РАБОТЫ CODEX

1. **Аппаратный лимит видеокарты:**  
   У пользователя **NVIDIA RTX 4050 Laptop строго 6 ГБ VRAM**.  
   * Никогда не запускать генерации в `float32`.  
   * Все SDXL и FLUX пайплайны обязаны использовать `fp16` или `fp8`, `AdamW8bit`, `gradient_checkpointing`, и `tiled VAE`.
2. **Выполнение команд в Windows:**  
   * В среде Windows PowerShell выполнение `npm` напрямую может блокироваться политикой безопасности.  
   * Всегда выполнять через: `cmd.exe /c "npm run ..."` или предварительно включить `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.
3. **Сохранение существующего кода:**  
   * Не ломать существующие IPC-каналы в `electron/main.cjs` и `electron/preload.cjs`.
   * Сохранять трехъязычную локализацию (`ru`, `uk`, `en`). Все новые текстовые константы добавлять во все три файла в `src/i18n/locales/`.
4. **ComfyUI Integration:**  
   * Сервер ComfyUI крутится на `http://127.0.0.1:8188`.
   * Все запросы к нему идут через прокси-функцию `window.electronAPI.comfyuiFetch(...)`, обходящую CORS.

---

## 📋 5. ТЕКУЩИЕ ЗАДАЧИ ДЛЯ ДАЛЬНЕЙШЕЙ РАЗРАБОТКИ
1. **Интеграция обученной LoRA в пресеты Дизайнера:**  
   Автоматически подставлять `archviz_materials_library_xl.safetensors` при выборе карточек материалов (орех, микроцемент, травертин) в простом режиме.
2. **Live-превью генерации:**  
   Отображение прогресс-бара генерации и промежуточных шагов из ComfyUI через WebSocket (`/ws`).
3. **Экспорт рендеров:**  
   Добавить кнопку быстрого экспорта рендера в форматы TIFF / PNG 16-bit без сжатия для постобработки в Photoshop.
