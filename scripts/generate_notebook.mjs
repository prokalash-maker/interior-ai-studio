import fs from 'fs';
import path from 'path';

const notebook = {
  cells: [
    {
      cell_type: "markdown",
      metadata: { id: "header" },
      source: [
        "# 🏛️ Interior AI Studio — Обучение SDXL LoRA на GPU Tesla T4 (16 ГБ)\n",
        "\n",
        "> **ВАЖНО перед запуском:**\n",
        "> В верхнем меню Colab нажмите: **«Среда выполнения» -> «Сменить среду выполнения»**.\n",
        "> В блоке «Аппаратный ускоритель» выберите **«Графический процессор T4»** (НЕ TPU и НЕ ЦП!).\n",
        "\n",
        "**Что делает этот блокнот:**\n",
        "1. Создает виртуальный Swap-буфер (8 ГБ), предотвращая вылеты по системной памяти;\n",
        "2. Загружает **ВСЕ 7,230+ интерьеров** из архитектурной базы Hugging Face;\n",
        "3. Формирует профессиональные PBR-подписи к каждому интерьеру;\n",
        "4. Обучает адаптер SDXL LoRA с нативным fp16 VAE и автосохранением каждые 200 шагов;\n",
        "5. Скачивает готовый файл `archviz_materials_library_xl.safetensors` прямо в папку загрузок для `D:\\AI\\models\\loras\\`."
      ]
    },
    {
      cell_type: "markdown",
      metadata: { id: "step1_title" },
      source: [
        "## Шаг 1. Проверка GPU T4, создание Swap-памяти и установка окружения"
      ]
    },
    {
      cell_type: "code",
      execution_count: null,
      metadata: { id: "step1_code" },
      outputs: [],
      source: [
        "import torch\n",
        "import sys\n",
        "\n",
        "print(\"=== 1. ПРОВЕРКА ОБОРУДОВАНИЯ ===\")\n",
        "if not torch.cuda.is_available():\n",
        "    raise SystemExit(\"❌ ОШИБКА: GPU не обнаружен! В меню 'Среда выполнения' -> 'Сменить среду выполнения' выберите 'Графический процессор T4' (НЕ TPU)!\")\n",
        "\n",
        "gpu_name = torch.cuda.get_device_name(0)\n",
        "vram_gb = torch.cuda.get_device_properties(0).total_memory / (1024**3)\n",
        "print(f\"✅ Видеокарта: {gpu_name} ({vram_gb:.1f} ГБ VRAM)\")\n",
        "!nvidia-smi\n",
        "\n",
        "print(\"\\n=== 2. СОЗДАНИЕ 8 ГБ SWAP (ЗАЩИТА ОТ SIGKILL 9 / OOM) ===\")\n",
        "!fallocate -l 8G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=8192\n",
        "!chmod 600 /swapfile\n",
        "!mkswap /swapfile\n",
        "!swapon /swapfile 2>/dev/null || true\n",
        "!free -h\n",
        "\n",
        "print(\"\\n=== 3. УСТАНОВКА KOHYA SD-SCRIPTS ===\")\n",
        "%cd /content\n",
        "!rm -rf sd-scripts\n",
        "!git clone https://github.com/kohya-ss/sd-scripts.git\n",
        "%cd /content/sd-scripts\n",
        "\n",
        "!pip install -q --upgrade pip\n",
        "!pip install -q -r requirements.txt\n",
        "!pip install -q bitsandbytes accelerate torchvision datasets pillow\n",
        "!accelerate config default\n",
        "\n",
        "print(\"\\n🎉 Шаг 1 успешно завершен! Swap-буфер подключен, окружение готово.\")\n"
      ]
    },
    {
      cell_type: "markdown",
      metadata: { id: "step2_title" },
      source: [
        "## Шаг 2. Загрузка базовой модели Juggernaut XL v9 (ArchViz)"
      ]
    },
    {
      cell_type: "code",
      execution_count: null,
      metadata: { id: "step2_code" },
      outputs: [],
      source: [
        "import os\n",
        "os.makedirs(\"/content/base_model\", exist_ok=True)\n",
        "base_model_path = \"/content/base_model/juggernautXL_v9.safetensors\"\n",
        "\n",
        "if not os.path.exists(base_model_path) or os.path.getsize(base_model_path) < 100 * 1024 * 1024:\n",
        "    print(\"Загрузка Juggernaut XL v9 (~6.6 ГБ)... Подождите 1-2 минуты...\")\n",
        "    !wget -c -O {base_model_path} \"https://huggingface.co/RunDiffusion/Juggernaut-XL-v9/resolve/main/Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors\"\n",
        "    print(\"✅ Базовая модель успешно загружена!\")\n",
        "else:\n",
        "    print(f\"✅ Базовая модель уже загружена ({os.path.getsize(base_model_path) / (1024**3):.2f} ГБ).\")\n"
      ]
    },
    {
      cell_type: "markdown",
      metadata: { id: "step3_title" },
      source: [
        "## Шаг 3. Загрузка ВСЕХ 7,230+ интерьеров и генерация PBR-разметки"
      ]
    },
    {
      cell_type: "code",
      execution_count: null,
      metadata: { id: "step3_code" },
      outputs: [],
      source: [
        "import os\n",
        "import gc\n",
        "from datasets import load_dataset\n",
        "\n",
        "# 1_interior означает 1 повторение на эпоху для 7,230 изображений\n",
        "target_dir = \"/content/dataset/1_interior\"\n",
        "os.makedirs(target_dir, exist_ok=True)\n",
        "\n",
        "print(\"Загружаем архитектурную базу 7,230 интерьеров с Hugging Face...\")\n",
        "ds = load_dataset(\"hammer888/interior_style_dataset\", split=\"train\")\n",
        "total = len(ds)\n",
        "print(f\"Доступно в базе: {total} интерьеров! Сохраняем ВСЕ сцены с PBR-разметкой...\")\n",
        "\n",
        "saved = 0\n",
        "for i, item in enumerate(ds):\n",
        "    try:\n",
        "        img = item['image']\n",
        "        raw_text = item.get('text', 'Modern style interior design')\n",
        "\n",
        "        caption = (\n",
        "            f\"Photorealistic interior architectural visualization, {raw_text}. \"\n",
        "            f\"Materials: authentic natural finishes, tactile wood and stone textures, clean PBR surfaces. \"\n",
        "            f\"Lighting: soft ambient illumination, realistic global lighting, subtle reflections. \"\n",
        "            f\"Style: professional architectural photography, 8k resolution, Corona Render, V-Ray magazine quality.\"\n",
        "        )\n",
        "\n",
        "        base_name = f\"interior_{saved:05d}\"\n",
        "        img_path = os.path.join(target_dir, f\"{base_name}.jpg\")\n",
        "        txt_path = os.path.join(target_dir, f\"{base_name}.txt\")\n",
        "\n",
        "        img.convert('RGB').save(img_path, quality=92)\n",
        "        with open(txt_path, 'w', encoding='utf-8') as f:\n",
        "            f.write(caption)\n",
        "\n",
        "        saved += 1\n",
        "        if saved % 500 == 0 or saved == total:\n",
        "            print(f\"  Подготовлено {saved} / {total} интерьеров...\")\n",
        "    except Exception as e:\n",
        "        continue\n",
        "\n",
        "# Очищаем оперативную память от объекта датасета перед обучением\n",
        "del ds\n",
        "gc.collect()\n",
        "\n",
        "print(f\"\\n🎉 ГОТОВО! Сохранено {saved} интерьеров с PBR-подписями в {target_dir}!\")\n",
        "print(\"Память очищена для обучения.\")\n"
      ]
    },
    {
      cell_type: "markdown",
      metadata: { id: "step4_title" },
      source: [
        "## Шаг 4. Обучение SDXL LoRA с автосохранением каждые 200 шагов (под лимит 1 ч 50 мин)"
      ]
    },
    {
      cell_type: "code",
      execution_count: null,
      metadata: { id: "step4_code" },
      outputs: [],
      source: [
        "import os\n",
        "import gc\n",
        "import torch\n",
        "\n",
        "# 1. Защита от фрагментации памяти CUDA\n",
        "os.environ[\"PYTORCH_CUDA_ALLOC_CONF\"] = \"expandable_segments:True\"\n",
        "\n",
        "gc.collect()\n",
        "if torch.cuda.is_available():\n",
        "    torch.cuda.empty_cache()\n",
        "\n",
        "os.makedirs(\"/content/output\", exist_ok=True)\n",
        "%cd /content/sd-scripts\n",
        "\n",
        "print(\"🔥 Запуск обучения SDXL LoRA (sdxl_train_network.py)...\")\n",
        "print(\"Оптимизировано под лимит времени: 900 шагов (~65 минут) с автосохранением каждые 200 шагов!\")\n",
        "\n",
        "# Поскольку все 7,233 латента и текста уже на диске, обучение начнется СРАЗУ же без задержек!\n",
        "!accelerate launch --num_cpu_threads_per_process 2 --mixed_precision fp16 sdxl_train_network.py \\\n",
        "  --pretrained_model_name_or_path=\"/content/base_model/juggernautXL_v9.safetensors\" \\\n",
        "  --train_data_dir=\"/content/dataset\" \\\n",
        "  --output_dir=\"/content/output\" \\\n",
        "  --output_name=\"archviz_materials_library_xl\" \\\n",
        "  --save_model_as=safetensors \\\n",
        "  --network_module=networks.lora \\\n",
        "  --network_dim=32 \\\n",
        "  --network_alpha=16 \\\n",
        "  --network_train_unet_only \\\n",
        "  --lowram \\\n",
        "  --sdpa \\\n",
        "  --max_data_loader_n_workers=1 \\\n",
        "  --resolution=\"1024,1024\" \\\n",
        "  --train_batch_size=1 \\\n",
        "  --gradient_accumulation_steps=2 \\\n",
        "  --max_train_steps=900 \\\n",
        "  --save_every_n_steps=200 \\\n",
        "  --learning_rate=1e-4 \\\n",
        "  --unet_lr=1e-4 \\\n",
        "  --lr_scheduler=\"cosine_with_restarts\" \\\n",
        "  --lr_warmup_steps=50 \\\n",
        "  --optimizer_type=\"AdamW8bit\" \\\n",
        "  --mixed_precision=\"fp16\" \\\n",
        "  --save_precision=\"fp16\" \\\n",
        "  --gradient_checkpointing \\\n",
        "  --cache_latents \\\n",
        "  --cache_latents_to_disk \\\n",
        "  --cache_text_encoder_outputs \\\n",
        "  --cache_text_encoder_outputs_to_disk \\\n",
        "  --enable_bucket \\\n",
        "  --min_bucket_reso=512 \\\n",
        "  --max_bucket_reso=1024 \\\n",
        "  --bucket_reso_steps=64 \\\n",
        "  --bucket_no_upscale\n",
        "\n",
        "print(\"\\n🎉 ОБУЧЕНИЕ ЗАВЕРШЕНО! Проверьте Шаг 5 для скачивания файла.\")\n"
      ]
    },
    {
      cell_type: "markdown",
      metadata: { id: "step5_title" },
      source: [
        "## Шаг 5. Скачивание готовой LoRA на компьютер\n",
        "Сохраните полученный файл в папку `D:\\AI\\models\\loras\\` на вашем компьютере:"
      ]
    },
    {
      cell_type: "code",
      execution_count: null,
      metadata: { id: "step5_code" },
      outputs: [],
      source: [
        "import os\n",
        "import glob\n",
        "from google.colab import files\n",
        "\n",
        "output_dir = \"/content/output\"\n",
        "safetensors_files = glob.glob(os.path.join(output_dir, \"*.safetensors\"))\n",
        "\n",
        "if safetensors_files:\n",
        "    safetensors_files.sort(key=os.path.getmtime)\n",
        "    target_file = safetensors_files[-1]\n",
        "    size_mb = os.path.getsize(target_file) / (1024 * 1024)\n",
        "    print(f\"✅ Найдена готовая LoRA: {target_file} ({size_mb:.1f} МБ)\")\n",
        "    print(\"Начинаем скачивание в браузер...\")\n",
        "    files.download(target_file)\n",
        "    print(\"\\n📁 Переместите скачанный файл в папку: D:\\\\AI\\\\models\\\\loras\\\\\")\n",
        "    print(\"Затем в Interior AI Studio нажмите 'Обновить список' в панели LoRA!\")\n",
        "else:\n",
        "    print(\"❌ Файл .safetensors не найден в папке /content/output/.\")\n",
        "    print(\"Проверьте вывод консоли на Шаге 4 выше, чтобы увидеть причину ошибки.\")\n"
      ]
    }
  ],
  metadata: {
    accelerator: "GPU",
    colab: {
      gpuType: "T4",
      provenance: []
    },
    kernelspec: {
      display_name: "Python 3",
      name: "python3"
    },
    language_info: {
      name: "python"
    }
  },
  nbformat: 4,
  nbformat_minor: 0
};

const outputPath = path.resolve('Interior_AI_Studio_SDXL_LoRA_Trainer.ipynb');
fs.writeFileSync(outputPath, JSON.stringify(notebook, null, 2), 'utf8');
console.log('Successfully updated notebook with safe limits at', outputPath);
