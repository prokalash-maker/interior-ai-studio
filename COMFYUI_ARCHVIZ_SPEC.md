# 📐 COMFYUI ARCHVIZ TECHNICAL SPECIFICATION
**Документ:** Спецификация локального пайплайна ComfyUI для архитектурной визуализации  
**Версия:** 2.2.0  
**Целевое железо:** NVIDIA GeForce RTX 4050 Laptop (6GB VRAM, CUDA 12.x)  

---

## 1. Архитектурная проблема: Clay Render Bias

### Симптом
При подаче белого или серого клей-рендера (глиняной модели из Archicad/Revit/3ds Max) через классический Img2Img (`VAEEncode` -> `KSampler` с Denoise 0.35–0.50):
* Итоговое изображение получается размытым, плоским и серо-бежевым («пластилин»).
* Текстуры дерева (шпон ореха, дуб), прожилки мрамора и металлические отблески не генерируются, так как 60–70% пикселей в латентном пространстве остаются серыми.

### Решение, внедренное в Interior AI Studio
**«Чистый латент + ControlNet с ранним срезом»**:
1. Вместо `VAEEncode` используется узел **`EmptyLatentImage`** (чистый Gaussian шум).
2. `KSampler` стартует с `denoise: 1.0`.
3. Вся геометрия сцены (стены, проёмы, размеры шкафов, стол, ножки стульев, холодильник) удерживается связкой **`ControlNet Canny`** (вес 0.80) + **`ControlNet Depth`** (вес 0.70).
4. В обоих узлах `ControlNetApplyAdvanced` задан параметр:
   ```json
   "start_percent": 0.0,
   "end_percent": 0.70
   ```
5. **Результат:** 
   * С 0% до 70% шагов ControlNet фиксирует точные габариты и перспективу.
   * На последних 30% шагов (с 70% до 100%) ControlNet отключается. Модель получает полную свободу прорисовки волокон дерева, пор камня, Fresnel-отражений и контактных теней без сдерживания серыми контурами исходника.

---

## 2. Граф генерации ComfyUI (Node Graph Architecture)

### А. Основной SDXL-пайплайн (Juggernaut XL v9)
1. **Загрузчики:**
   * `CheckpointLoaderSimple` (`juggernautXL_v9_photo.safetensors` из `D:/AI/models/checkpoints/`)
   * `LoadImage` (загружает исходный рендер через `/upload/image`)
   * `ImageScale` (масштабирование под целевое соотношение сторон)
   * `EmptyLatentImage` (ширина × высота, batch=1)
2. **ControlNet стек:**
   * `Canny` препроцессор (low: 0.05, high: 0.20)
   * `ControlNetLoader` (`controlnet-canny-sdxl-1.0.safetensors`)
   * `ControlNetApplyAdvanced` (strength: 0.80, end: 0.70)
   * `ControlNetLoader` (`controlnet-depth-sdxl-1.0.safetensors`)
   * `ControlNetApplyAdvanced` (strength: 0.70, end: 0.70)
3. **Опциональный LoRA инжектор:**
   * `LoraLoader` (подключается между Checkpoint и CLIP/Model при выборе LoRA в студии)
4. **Текстовые энкодеры:**
   * `CLIPTextEncode` (Positive — официальная формула ComfyUI.org 24mm tilt-shift)
   * `CLIPTextEncode` (Negative — фильтр искажений дерева, пластикового CGI и пережога)
5. **Сэмплирование:**
   * `KSampler Pass 1` (`dpmpp_2m`, scheduler `karras`, cfg 4.0, steps 20–85 в зависимости от времени)
6. **Многопроходный масштабируемый апскейл (в зависимости от времени):**
   * Для 1–3 мин: `LatentUpscaleBy` (1.25x) → `KSampler Pass 2` (denoise 0.28)
   * Для 5–15 мин: `LatentUpscaleBy` (1.25x) → `KSampler Pass 2` → `KSampler Pass 3` (denoise 0.16)
   * Для 15–60 мин: `LatentUpscaleBy` (1.33x) → `KSampler Pass 2` (2K) → `LatentUpscaleBy` (1.25x) → `KSampler Pass 3` (2.5K) → `KSampler Pass 4` (полировка)
7. **Декодер:**
   * `VAEDecode` → `SaveImage`

### Б. Шаблон Z-Image Turbo 8-Steps (ComfyUI.org Gallery)
* **Модель диффузии:** `z_image_turbo_bf16.safetensors`
* **Текстовый энкодер:** `qwen_3_4b.safetensors`
* **Шаги:** 8 шагов
* **CFG:** строго 1.0
* **Сэмплер:** `res_multistep` (или `euler`) со скейлером `simple`
* **Скорость:** ~15–25 секунд на RTX 4050 6GB

---

## 3. Таблица масштабирования времени рендера к вычислениям GPU

| Заданное время в UI | Базовое разрешение | Проходы латента | Суммарные шаги | Реальное время RTX 4050 |
| :--- | :--- | :--- | :--- | :--- |
| **15 – 45 сек** | `1024×576` | 1 проход | 20–35 шагов | **~15 – 40 сек** |
| **1 – 4 мин** | `1280×720` | 2 прохода (1.25x scale) | 45 + 35 = 80 шагов | **~1.5 – 3.5 мин** |
| **5 – 15 мин** | `1408×792` | 3 прохода (1.25x scale) | 65 + 55 + 50 = 170 шагов | **~5 – 12 мин** |
| **15 – 60 мин** | `1536×864` | 4 прохода (до 2560×1440) | 80 + 65 + 55 + 45 = 245 шагов | **~15 – 45 мин** |

---

## 4. Формула архитектурного промпта (ComfyUI.org Standard)

Промпт строится в [`src/services/ai/ComfyUIProvider.ts`](file:///c:/Users/user/Downloads/Visual%20AI/src/services/ai/ComfyUIProvider.ts) по пятиблочной структуре:

1. **Камера и ракурс:**  
   `Photorealistic interior visualization of a [modern luxury kitchen], architectural photography, shot on a full-frame camera with a 24mm wide-angle lens, eye-level perspective, straight vertical lines.`
2. **Спецификация PBR-материалов:**  
   `Materials: [natural american walnut wood veneer cabinetry, vertical tactile wood grain, honed roman travertine stone slab backsplash, dark graphite stainless steel appliances, large format beige limestone floor tiles].`
3. **Освещение и атмосфера:**  
   `Lighting: [soft natural daylight streaming from large windows, warm 3000K accent architectural lighting from ceiling track spotlights and concealed LED strips, realistic global illumination, soft contact shadows, subtle Fresnel reflections].`
4. **Детализация и декор:**  
   `Details: [minimalist decorative ceramic vases, green indoor foliage plant in glass container, architectural design books, neat interior styling].`
5. **Финишный журнальный рендеринг:**  
   `Style: high-end interior design magazine style, V-Ray Corona render quality, 8k detail, clean composition, neutral color grading, hyper-realistic PBR textures.`

---

## 5. Расположение файлов и путей в системе

* **ComfyUI Portable:** `D:\AI\ComfyUI_windows_portable\`
* **Custom Nodes:** `D:\AI\ComfyUI_windows_portable\ComfyUI\custom_nodes\`
  * Установлен: `ComfyUI-Manager`
* **Файл маппинга путей:** `D:\AI\ComfyUI_windows_portable\ComfyUI\extra_model_paths.yaml`
* **Модели пользователя:**
  * Чекпоинты: `D:\AI\models\checkpoints\`
  * ControlNet: `D:\AI\models\controlnet\`
  * Текстовые энкодеры: `D:\AI\models\clip\` и `D:\AI\models\ai models\`
  * LoRA: `D:\AI\models\loras\`
  * Апскейлеры: `D:\AI\models\upscale_models\`

---

## 6. Разбор видео: ComfyUI для архитектурных эскизов (10.11.2026)

Пользовательский материал: [ComfyUI for Architects: Turn Hand Sketches into Realistic 3D Renders](https://www.youtube.com/watch?v=RbxAS4gvkyQ&list=PLUeJlamSIrtM). По доступному транскрипту автор показывает KSampler, Flux diffusion model и CLIP, LoRA как стилевой адаптер, `EmptyLatentImage`, входной рисунок и ControlNet, затем VAE Decode и Save Image. Также упоминается `ConditioningZeroOut` для демонстрации работы без conditioning. Описание указывает на ComfyUI Cloud и архитектурный hand sketch.

### Применимость к Interior AI Studio

- Полезная проверяемая идея — начинать с чистого латента, а контуры/геометрию подавать отдельным ControlNet-conditioning. Это потенциально даёт модели больше свободы для синтеза материалов, чем img2img с низким denoise.
- В ролике ручной эскиз и облачная среда. Наш эталон — белый Archicad clay-рендер кухни и локальный ComfyUI на RTX 4050 Laptop с 6 GB VRAM. Скорость и качество из видео не подтверждают результат для нашей конфигурации.
- Не раскрыты точное имя Flux ControlNet checkpoint, сила/диапазон применения, seed, sampler, steps, разрешение и VRAM. Настройки нельзя переносить наугад.
- В локальной модели-конфигурации обнаружены Flux Schnell FP8, T5-XXL FP8, CLIP-L и VAE, а также **SDXL** Canny и Depth ControlNet. Flux ControlNet при проверке не найден. SDXL ControlNet-файлы несовместимы с Flux.
- Текущая Flux-ветка `src/services/ai/ComfyUIProvider.ts` использует img2img/VAE Encode и не подключает ControlNet/LoRA. Основной SDXL-граф имеет отдельную логику Canny/Depth. Этот факт следует отличать от целевой схемы выше: документация не гарантирует, что каждый описанный узел сейчас используется каждой веткой кода.

### Контролируемый эксперимент перед изменением рабочего графа

1. Зафиксировать один clay-ракурс, prompt, seed, checkpoint и разрешение; сохранить текущий результат как baseline.
2. Сравнить на SDXL текущую ветку `VAEEncode` + Canny/Depth с отдельным экспериментом `EmptyLatentImage` + Canny/Depth. Менять только способ подачи латента, затем отдельными сериями менять силы ControlNet и `end_percent`.
3. Для каждого результата оценить проёмы, мебель и перспективу, читаемость дерева/камня, время и пик VRAM; зафиксировать OOM и самовольное изменение геометрии.
4. Текущий граф остаётся режимом по умолчанию, пока одинаковый тест не покажет воспроизводимое улучшение без неприемлемого дрейфа композиции.
5. Flux ControlNet исследовать только после обнаружения конкретного совместимого checkpoint и проверки требований по VRAM. Не устанавливать его автоматически и не менять пользовательскую установку без отдельного решения.

`ConditioningZeroOut` — тема для отдельной проверки графа из видео, а не предлагаемое изменение основного prompt: обнуление conditioning может убрать нужное управление текстом.
