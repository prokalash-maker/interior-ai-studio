import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Sparkles,
  Sliders,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertCircle,
  Maximize2,
  Copy,
  Download,
  Camera,
  ArrowRight,
  DollarSign,
  Zap,
  Plus,
  Trash2,
  ExternalLink,
  Layers,
  Link as LinkIcon,
  Image as ImageIcon,
  Type,
  Cpu,
  Database,
  SlidersHorizontal,
  Lock,
  Dices,
  ChevronDown,
  ChevronUp,
  Columns,
  Eye,
  SplitSquareVertical,
  Check,
} from 'lucide-react';
import { Project, RoomType, GeometryPreservationMode, GenerationRecord, MaterialReference } from '../types/project';
import {
  ROOM_TYPES,
  GEOMETRY_MODES,
  INTERIOR_STYLES,
  LIGHTING_OPTIONS,
  ATMOSPHERE_OPTIONS,
  MATERIAL_OPTIONS,
  buildSmartPrompt,
  buildArchitecturalNegativePrompt,
} from '../services/promptBuilder';
import { geminiProvider } from '../services/ai/GeminiProvider';
import { pollinationsProvider } from '../services/ai/PollinationsProvider';
import { aiHordeProvider } from '../services/ai/AIHordeProvider';
import { localSDProvider } from '../services/ai/LocalSDProvider';
import { providerRegistry, PROVIDERS_CATALOG } from '../services/ai/providerRegistry';
import { dbService } from '../services/db';
import { StorageService } from '../services/storageService';
import { ImageComparisonSlider } from '../components/ImageComparisonSlider';
import { BudgetWarningModal } from '../components/BudgetWarningModal';
import { MaterialReferenceModal } from '../components/MaterialReferenceModal';
import { UpscaleModal } from '../components/UpscaleModal';
import { trainingService } from '../services/trainingService';
import { useI18n } from '../i18n/i18nContext';
import { RoomTypeOption, GeometryModeOption, InteriorStyle, LightingOption, AtmosphereOption, MaterialOption } from '../types/project';
import { Resolution, RESOLUTION_OPTIONS, CostSummary } from '../types/cost';
import { costTracker } from '../services/costTracker';

interface GenerationStudioViewProps {
  currentProject: Project | null;
  onUpdateProject: (p: Project) => void;
  onNavigateSettings: () => void;
  pendingArchicadFile?: string | null;
  onArchicadFileLoaded?: () => void;
}

export const GenerationStudioView: React.FC<GenerationStudioViewProps> = ({
  currentProject,
  onUpdateProject,
  onNavigateSettings,
  pendingArchicadFile,
  onArchicadFileLoaded,
}) => {
  const { t, language } = useI18n();

  const getRoomLabel = (r: RoomTypeOption) => (language === 'uk' ? r.labelUk : language === 'en' ? r.labelEn : r.labelRu);
  const getStyleDesc = (s: InteriorStyle) => (language === 'uk' ? s.descriptionUk : language === 'en' ? s.descriptionEn : s.descriptionRu);
  const getGeomTitle = (m: GeometryModeOption) => (language === 'uk' ? m.titleUk : language === 'en' ? m.titleEn : m.titleRu);
  const getGeomDesc = (m: GeometryModeOption) => (language === 'uk' ? m.descUk : language === 'en' ? m.descEn : m.descRu);
  const getLightingLabel = (l: LightingOption) => (language === 'uk' ? l.labelUk : language === 'en' ? l.labelEn : l.labelRu);
  const getAtmosphereLabel = (a: AtmosphereOption) => (language === 'uk' ? a.labelUk : language === 'en' ? a.labelEn : a.labelRu);
  const getMaterialLabel = (m: MaterialOption) => (language === 'uk' ? m.labelUk : language === 'en' ? m.labelEn : m.labelRu);

  // Source Image State
  const [sourceImage, setSourceImage] = useState<string>(currentProject?.sourceImageBase64 || '');
  const [sourceMimeType, setSourceMimeType] = useState<string>('image/png');
  const [imageMeta, setImageMeta] = useState<{ width: number; height: number; aspect: string } | null>(null);

  // Inspector Parameter State
  const [roomType, setRoomType] = useState<RoomType>(currentProject?.roomType || 'kitchen');
  const [styleId, setStyleId] = useState<string>('modern');
  const [geometryMode, setGeometryMode] = useState<GeometryPreservationMode>('balanced');
  const [lightingId, setLightingId] = useState<string>('daylight');
  const [atmosphereId, setAtmosphereId] = useState<string>('bright');
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>(['wood_walnut', 'stone_natural', 'metal_black']);
  const [materialCategoryFilter, setMaterialCategoryFilter] = useState<'all' | 'wood' | 'stone' | 'surface' | 'metal' | 'glass' | 'textile'>('all');
  const [materialSearchQuery, setMaterialSearchQuery] = useState<string>('');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [manualPromptOverride, setManualPromptOverride] = useState<boolean>(false);
  const [fullPrompt, setFullPrompt] = useState<string>('');

  // Active AI Provider & Resolution Control
  const [activeProviderId, setActiveProviderId] = useState<string>(providerRegistry.getActiveProviderId());
  const [enabledProviderIds, setEnabledProviderIds] = useState<string[]>(providerRegistry.getEnabledProviderIds());
  const [resolution, setResolution] = useState<Resolution>('2k');
  const [costSummary, setCostSummary] = useState<CostSummary>(costTracker.getSummary());

  // Material References (Images / Swatches, URLs, Custom Specifications)
  const [materialReferences, setMaterialReferences] = useState<MaterialReference[]>(
    currentProject?.materialReferences || []
  );
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState<boolean>(false);

  // Generation execution state
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationProgressText, setGenerationProgressText] = useState<string>('');
  const [generationTimer, setGenerationTimer] = useState<number>(0);
  const [latestResult, setLatestResult] = useState<GenerationRecord | null>(null);
  const [history, setHistory] = useState<GenerationRecord[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Multi-turn refinement input
  const [refinementText, setRefinementText] = useState<string>('');
  const [isRefining, setIsRefining] = useState<boolean>(false);

  // Active full-screen modal & budget warning modal & upscale modal
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isUpscaleOpen, setIsUpscaleOpen] = useState<boolean>(false);
  const [showBilling402Modal, setShowBilling402Modal] = useState<boolean>(false);
  const [warningModal, setWarningModal] = useState<{
    isOpen: boolean;
    type: 'expensive_request' | 'budget_exceeded';
    pendingResolution: Resolution;
    estimatedCost: number;
  } | null>(null);

  // Advanced AI Control Panel State
  const [showAdvancedAiControl, setShowAdvancedAiControl] = useState<boolean>(false);
  const [denoiseStrength, setDenoiseStrength] = useState<number>(0.65);
  const [depthControlStrength, setDepthControlStrength] = useState<number>(0.70);
  const [edgeControlStrength, setEdgeControlStrength] = useState<number>(0.80);
  const [cfgScale, setCfgScale] = useState<number>(4.0);
  const [stepsCount, setStepsCount] = useState<number>(38);
  const [customSeed, setCustomSeed] = useState<number>(-1);
  const [preserveGeometry, setPreserveGeometry] = useState<boolean>(true);
  const [preserveFurniture, setPreserveFurniture] = useState<boolean>(true);
  const [usePureEmptyLatent, setUsePureEmptyLatent] = useState<boolean>(true);
  const [materialCreativity, setMaterialCreativity] = useState<number>(0.70);

  // Render Time Budget & Architect's Custom Specifications
  const [targetRenderTimeSec, setTargetRenderTimeSec] = useState<number>(35);
  const [customMaterials, setCustomMaterials] = useState<string>('');
  const [customStyle, setCustomStyle] = useState<string>('');
  const [customLighting, setCustomLighting] = useState<string>('');
  const [customDecor, setCustomDecor] = useState<string>('');
  const [showCustomSpecs, setShowCustomSpecs] = useState<boolean>(true);

  // LoRA Model State & Dataset Notification
  const [selectedLora, setSelectedLora] = useState<string>('');
  const [loraStrength, setLoraStrength] = useState<number>(0.85);
  const [availableLoras, setAvailableLoras] = useState<string[]>([]);
  const [datasetSavedMsg, setDatasetSavedMsg] = useState<boolean>(false);

  // Comparison Display Mode: 'slider' | 'original' | 'result' | 'side_by_side'
  const [comparisonMode, setComparisonMode] = useState<'slider' | 'original' | 'result' | 'side_by_side'>('slider');
  const [studioMode, setStudioMode] = useState<'designer' | 'pro'>('designer');
  const [inspectorTab, setInspectorTab] = useState<'main' | 'materials' | 'control' | 'prompt'>('main');

  const timerRef = useRef<any>(null);

  // Global Keyboard Shortcuts (Ctrl+Enter, Alt+U, Space, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Enter or Cmd+Enter: Generate render
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isGenerating && sourceImage) {
          handleStartGeneration(resolution);
        }
      }
      // Esc: Close any modal / fullscreen
      if (e.key === 'Escape') {
        setIsFullscreen(false);
        setIsUpscaleOpen(false);
        setIsMaterialModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGenerating, sourceImage, resolution]);

  // Subscribe to costTracker and providerRegistry updates
  useEffect(() => {
    const unsub = costTracker.subscribe(() => {
      setCostSummary(costTracker.getSummary());
    });
    const unsubRegistry = providerRegistry.subscribe(() => {
      const enabled = providerRegistry.getEnabledProviderIds();
      setEnabledProviderIds(enabled);
      const current = providerRegistry.getActiveProviderId();
      if (!enabled.includes(current)) {
        const next = enabled[0] || 'comfyui_local';
        setActiveProviderId(next);
        providerRegistry.setActiveProvider(next);
      } else {
        setActiveProviderId(current);
      }
    });
    // Check injected materials or prompt from Online Catalog
    const injMat = localStorage.getItem('interior_ai_injected_material');
    if (injMat) {
      setCustomMaterials((prev) => (prev ? `${prev}, ${injMat}` : injMat));
      localStorage.removeItem('interior_ai_injected_material');
      setInspectorTab('materials');
    }
    const injPrompt = localStorage.getItem('interior_ai_injected_prompt');
    if (injPrompt) {
      setFullPrompt(injPrompt);
      setManualPromptOverride(true);
      localStorage.removeItem('interior_ai_injected_prompt');
      setInspectorTab('prompt');
    }
    const injStyle = localStorage.getItem('interior_ai_injected_style');
    if (injStyle) {
      try {
        const parsed = JSON.parse(injStyle) as { styleId?: string; materialIds?: string[] };
        const style = INTERIOR_STYLES.find((item) => item.id === parsed.styleId);
        if (style) {
          setStyleId(style.id);
          setSelectedMaterials((parsed.materialIds || style.defaultMaterials).filter((id) => MATERIAL_OPTIONS.some((m) => m.id === id)));
          setInspectorTab('main');
        }
      } catch (error) {
        console.warn('Could not apply style from library:', error);
      }
      localStorage.removeItem('interior_ai_injected_style');
    }
    trainingService.scanLocalLoras().then((list) => {
      setAvailableLoras(list);
    });

    return () => {
      unsub();
      unsubRegistry();
    };
  }, []);

  // Compute smart prompt whenever parameters change
  useEffect(() => {
    if (!manualPromptOverride) {
      const selectedStyle = INTERIOR_STYLES.find((s) => s.id === styleId) || INTERIOR_STYLES[0];
      const generated = buildSmartPrompt({
        roomType,
        style: selectedStyle,
        geometryMode,
        lightingId,
        atmosphereId,
        selectedMaterials,
        materialReferences,
        customUserPrompt: customPrompt,
        customMaterials,
        customStyle,
        customLighting,
        customDecor,
      });
      setFullPrompt(generated);
    }
  }, [roomType, styleId, geometryMode, lightingId, atmosphereId, selectedMaterials, materialReferences, customPrompt, customMaterials, customStyle, customLighting, customDecor, manualPromptOverride]);

  // Load project generations if project exists
  useEffect(() => {
    if (currentProject) {
      if (currentProject.sourceImageBase64) {
        setSourceImage(currentProject.sourceImageBase64);
      }
      setRoomType(currentProject.roomType);
      if (currentProject.materialReferences) {
        setMaterialReferences(currentProject.materialReferences);
      } else {
        setMaterialReferences([]);
      }
      dbService.getGenerationsForProject(currentProject.id).then((records) => {
        setHistory(records);
        if (records.length > 0) {
          setLatestResult(records[records.length - 1]);
        }
      });
    }
  }, [currentProject?.id]);

  // Measure loaded image dimensions
  const handleImageLoaded = (imgUrl: string) => {
    const img = new Image();
    img.onload = () => {
      const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
      const d = gcd(img.width, img.height);
      const aspect = `${img.width / d}:${img.height / d}`;
      setImageMeta({ width: img.width, height: img.height, aspect });
    };
    img.src = imgUrl;
  };

  useEffect(() => {
    if (!pendingArchicadFile || !window.electronAPI?.readWatchedArchicadImage) return;
    let cancelled = false;
    window.electronAPI.readWatchedArchicadImage(pendingArchicadFile).then(async (result) => {
      if (cancelled) return;
      if (!result.success || !result.base64 || !result.mimeType) {
        setErrorMsg(result.error || 'Не удалось загрузить новый файл Archicad.');
        onArchicadFileLoaded?.();
        return;
      }
      const dataUrl = `data:${result.mimeType};base64,${result.base64}`;
      setSourceImage(dataUrl);
      setSourceMimeType(result.mimeType);
      setErrorMsg(null);
      handleImageLoaded(dataUrl);
      if (currentProject) {
        const updated = { ...currentProject, sourceImageBase64: dataUrl, sourceImagePath: result.filePath, updatedAt: Date.now() };
        await dbService.saveProject(updated);
        if (!cancelled) onUpdateProject(updated);
      }
      onArchicadFileLoaded?.();
    }).catch((error) => {
      if (!cancelled) setErrorMsg(error?.message || 'Не удалось загрузить новый файл Archicad.');
      onArchicadFileLoaded?.();
    });
    return () => { cancelled = true; };
  }, [pendingArchicadFile]);

  // Image upload handling
  const handleSelectImageDialog = async () => {
    setErrorMsg(null);
    if (window.electronAPI) {
      const res = await window.electronAPI.selectImageDialog();
      if (!res.canceled && res.base64) {
        const fullDataUrl = `data:${res.mimeType || 'image/png'};base64,${res.base64}`;
        setSourceImage(fullDataUrl);
        setSourceMimeType(res.mimeType || 'image/png');
        handleImageLoaded(fullDataUrl);
        if (currentProject) {
          const updated = {
            ...currentProject,
            sourceImageBase64: fullDataUrl,
            sourceImagePath: res.filePath,
          };
          dbService.saveProject(updated);
          onUpdateProject(updated);
        }
      }
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png,image/jpeg,image/webp';
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const result = event.target?.result as string;
            setSourceImage(result);
            setSourceMimeType(file.type);
            handleImageLoaded(result);
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    }
  };

  const handleLoadSample = () => {
    setErrorMsg(null);
    const sample = StorageService.generateSampleClayRender();
    setSourceImage(sample);
    setSourceMimeType('image/png');
    handleImageLoaded(sample);
    if (currentProject) {
      const updated = { ...currentProject, sourceImageBase64: sample };
      dbService.saveProject(updated);
      onUpdateProject(updated);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const res = event.target?.result as string;
        setSourceImage(res);
        setSourceMimeType(file.type);
        handleImageLoaded(res);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleMaterial = (mId: string) => {
    if (selectedMaterials.includes(mId)) {
      setSelectedMaterials(selectedMaterials.filter((id) => id !== mId));
    } else {
      setSelectedMaterials([...selectedMaterials, mId]);
    }
  };

  const handleAddMaterialReference = (newRef: MaterialReference) => {
    const updated = [...materialReferences, newRef];
    setMaterialReferences(updated);
    if (currentProject) {
      const p = { ...currentProject, materialReferences: updated, updatedAt: Date.now() };
      dbService.saveProject(p);
      onUpdateProject(p);
    }
  };

  const handleRemoveMaterialReference = (refId: string) => {
    const updated = materialReferences.filter((r) => r.id !== refId);
    setMaterialReferences(updated);
    if (currentProject) {
      const p = { ...currentProject, materialReferences: updated, updatedAt: Date.now() };
      dbService.saveProject(p);
      onUpdateProject(p);
    }
  };

  // Run Generation with Cost & Budget Validation
  const handleStartGeneration = (targetRes: Resolution = resolution) => {
    if (!sourceImage) {
      setErrorMsg(t('studio.sourceRequired'));
      return;
    }

    const provider = providerRegistry.getProvider(activeProviderId) || geminiProvider;

    if (activeProviderId === 'google_gemini' && !geminiProvider.getApiKey()) {
      setErrorMsg(t('studio.geminiApiMissing'));
      return;
    }

    const cost = costTracker.getCostEstimate(activeProviderId, provider.currentModel, targetRes);

    if (costTracker.isBudgetExceeded(cost)) {
      setWarningModal({
        isOpen: true,
        type: 'budget_exceeded',
        pendingResolution: targetRes,
        estimatedCost: cost,
      });
      return;
    }

    if (costTracker.shouldWarnBeforeRequest(cost, targetRes)) {
      setWarningModal({
        isOpen: true,
        type: 'expensive_request',
        pendingResolution: targetRes,
        estimatedCost: cost,
      });
      return;
    }

    executeGeneration(targetRes);
  };

  const executeGeneration = async (targetRes: Resolution) => {
    setErrorMsg(null);
    setIsGenerating(true);
    setGenerationTimer(0);
    setGenerationProgressText('Фаза 1: Загрузка геометрии Archicad и фиксация ControlNet...');

    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += 0.2;
      setGenerationTimer(Math.round(elapsed * 10) / 10);

      const ratio = elapsed / Math.max(15, targetRenderTimeSec);
      if (ratio < 0.15) {
        setGenerationProgressText('Фаза 1: Загрузка геометрии Archicad и фиксация ControlNet (Canny + Depth)...');
      } else if (ratio < 0.45) {
        setGenerationProgressText('Фаза 2: Базовый расчет PBR материалов, шпона дерева и физического света...');
      } else if (ratio < 0.75) {
        setGenerationProgressText('Фаза 3: Многопроходный латентный апскейл 2K/4K и скульптурирование фактур...');
      } else if (ratio < 0.95) {
        setGenerationProgressText('Фаза 4: Финальный денойзинг микродеталей, контактные тени и амбиентная окклюзия...');
      } else {
        setGenerationProgressText('Финал: Декодирование VAE и сборка ультра-четкого архитектурного кадра...');
      }
    }, 200);
    timerRef.current = timer;

    const provider = providerRegistry.getProvider(activeProviderId) || geminiProvider;
    const cost = costTracker.getCostEstimate(activeProviderId, provider.currentModel, targetRes);

    try {
      const selectedStyle = INTERIOR_STYLES.find((s) => s.id === styleId) || INTERIOR_STYLES[0];
      const result = await provider.generate({
        prompt: fullPrompt,
        negativePrompt: buildArchitecturalNegativePrompt(),
        sourceImageBase64: sourceImage,
        sourceImageMimeType: sourceMimeType,
        roomType,
        styleName: selectedStyle.name,
        selectedMaterialNames: MATERIAL_OPTIONS
          .filter((material) => selectedMaterials.includes(material.id))
          .map((material) => material.labelEn),
        manualPromptOverride,
        geometryMode,
        resolution: targetRes,
        materialReferences,
        temperature: 0.35,
        advancedSettings: {
          denoise: denoiseStrength,
          depthControlStrength,
          edgeControlStrength,
          cfg: cfgScale,
          steps: stepsCount,
          seed: customSeed,
          preserveGeometry,
          preserveFurniture,
          usePureEmptyLatent,
          materialCreativity,
          targetRenderTimeSec,
          customMaterials,
          customStyle,
          customLighting,
          customDecor,
          loraModel: selectedLora || undefined,
          loraStrength: selectedLora ? loraStrength : undefined,
        },
        customMaterials,
        customStyle,
        customLighting,
        customDecor,
      });

      clearInterval(timerRef.current);

      const cleanBase64 = (result.imageBase64 || '').replace(/^data:image\/[\w+.-]+;base64,/, '');
      const generatedDataUrl = `data:${result.mimeType || 'image/png'};base64,${cleanBase64}`;

      const newRecord: GenerationRecord = {
        id: result.id,
        projectId: currentProject?.id || 'default_project',
        sourceImagePath: currentProject?.sourceImagePath || 'archicad_clay_render.png',
        sourceImageBase64: sourceImage,
        outputImagePath: `output_${result.id}.png`,
        outputImageBase64: generatedDataUrl,
        prompt: fullPrompt,
        styleId,
        roomType,
        geometryMode,
        lighting: lightingId,
        materials: selectedMaterials,
        materialReferences,
        atmosphere: atmosphereId,
        provider: result.provider,
        model: result.model,
        width: result.width,
        height: result.height,
        latencyMs: result.latencyMs,
        createdAt: Date.now(),
        resolution: targetRes,
        costUsd: cost,
        metadata: {
          denoise: denoiseStrength,
          depthControlStrength,
          edgeControlStrength,
          cfg: cfgScale,
          steps: stepsCount,
          seed: customSeed,
          preserveGeometry,
          preserveFurniture,
          usePureEmptyLatent,
          materialCreativity,
          textNotes: result.textNotes,
        },
      };

      await dbService.saveGeneration(newRecord);
      costTracker.recordGeneration(provider.id, provider.currentModel, targetRes, cost);

      setLatestResult(newRecord);
      setHistory((prev) => [...prev, newRecord]);

      if (currentProject) {
        onUpdateProject({
          ...currentProject,
          thumbnailPath: generatedDataUrl.substring(0, 100),
          updatedAt: Date.now(),
        });
      }
    } catch (err: any) {
      clearInterval(timerRef.current);
      if (err.code === 402 || (err.message && err.message.includes('402'))) {
        setShowBilling402Modal(true);
      }
      setErrorMsg(err.message || 'Ошибка при генерации изображения через AI.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Iterative refinement (multi-turn instruction)
  const handleRefine = async () => {
    if (!latestResult || !refinementText.trim()) return;
    const provider = providerRegistry.getProvider(activeProviderId) || geminiProvider;

    setErrorMsg(null);
    setIsRefining(true);

    try {
      const result = await provider.refine(
        {
          id: latestResult.id,
          imageBase64: latestResult.outputImageBase64 || '',
          mimeType: 'image/png',
          width: latestResult.width,
          height: latestResult.height,
          model: latestResult.model,
          provider: latestResult.provider,
          promptUsed: latestResult.prompt,
          latencyMs: latestResult.latencyMs,
          timestamp: latestResult.createdAt,
        },
        refinementText.trim()
      );

      const cleanRefineBase64 = (result.imageBase64 || '').replace(/^data:image\/[\w+.-]+;base64,/, '');
      const generatedDataUrl = `data:${result.mimeType || 'image/png'};base64,${cleanRefineBase64}`;
      const cost = costTracker.getCostEstimate(activeProviderId, provider.currentModel, resolution);

      const newRecord: GenerationRecord = {
        id: result.id,
        projectId: currentProject?.id || 'default_project',
        parentId: latestResult.id,
        sourceImagePath: latestResult.outputImagePath,
        sourceImageBase64: latestResult.outputImageBase64,
        outputImagePath: `refine_${result.id}.png`,
        outputImageBase64: generatedDataUrl,
        prompt: `${latestResult.prompt} -> Уточнение: ${refinementText.trim()}`,
        styleId,
        roomType,
        geometryMode: 'strict',
        provider: result.provider,
        model: result.model,
        width: result.width,
        height: result.height,
        latencyMs: result.latencyMs,
        createdAt: Date.now(),
        resolution,
        costUsd: cost,
      };

      await dbService.saveGeneration(newRecord);
      costTracker.recordGeneration(provider.id, provider.currentModel, resolution, cost);

      setLatestResult(newRecord);
      setHistory((prev) => [...prev, newRecord]);
      setRefinementText('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка при уточнении рендера.');
    } finally {
      setIsRefining(false);
    }
  };

  const handleUseDemoRender = async () => {
    setShowBilling402Modal(false);
    setErrorMsg(null);

    const sourceImgToUse = sourceImage || StorageService.generateSampleClayRender();
    const demoBase64 = StorageService.generateRealisticSampleRender();

    const newRecord: GenerationRecord = {
      id: 'demo_' + Date.now(),
      projectId: currentProject?.id || 'default_project',
      sourceImagePath: 'archicad_clay_render.png',
      sourceImageBase64: sourceImgToUse,
      outputImagePath: 'demo_render.png',
      outputImageBase64: demoBase64,
      prompt: fullPrompt,
      styleId,
      roomType,
      geometryMode,
      lighting: lightingId,
      materials: selectedMaterials,
      atmosphere: atmosphereId,
      provider: 'Nano Banana Pro (Demo Simulation)',
      model: 'gemini-3-pro-image',
      width: 1920,
      height: 1080,
      latencyMs: 1420,
      createdAt: Date.now(),
      resolution,
      costUsd: 0,
    };

    if (!sourceImage) {
      setSourceImage(sourceImgToUse);
    }

    await dbService.saveGeneration(newRecord);
    setLatestResult(newRecord);
    setHistory((prev) => [...prev, newRecord]);

    if (currentProject) {
      onUpdateProject({
        ...currentProject,
        sourceImageBase64: sourceImgToUse,
        thumbnailPath: demoBase64.substring(0, 100),
        updatedAt: Date.now(),
      });
    }
  };

  const handleExport = (format: 'png' | 'jpeg') => {
    if (!latestResult?.outputImageBase64) return;
    const defaultName = `${currentProject?.name || 'InteriorRender'}_${latestResult.styleId}_${Date.now()}`;
    StorageService.exportImage(latestResult.outputImageBase64, defaultName, format);
  };

  const handleCopy = () => {
    if (latestResult?.outputImageBase64) {
      StorageService.copyToClipboard(latestResult.outputImageBase64);
    }
  };

  const handleApplyUpscaledImage = async (newBase64: string, newWidth: number, newHeight: number) => {
    if (latestResult) {
      const updated: GenerationRecord = {
        ...latestResult,
        outputImageBase64: `data:image/png;base64,${newBase64}`,
        width: newWidth,
        height: newHeight,
      };
      setLatestResult(updated);
      try {
        await dbService.saveGeneration(updated);
      } catch (_) {}
      if (currentProject) {
        onUpdateProject({
          ...currentProject,
          updatedAt: Date.now(),
        });
      }
    }
  };

  const activeProvider = providerRegistry.getProvider(activeProviderId) || geminiProvider;
  const currentCostEstimate = costTracker.getCostEstimate(activeProviderId, activeProvider.currentModel, resolution);
  const draft1kCost = costTracker.getCostEstimate(activeProviderId, activeProvider.currentModel, '1k');

  return (
    <div className="flex-1 flex overflow-hidden bg-studio-bg text-studio-text select-none">
      {/* ---------------- LEFT: WORKSPACE / IMAGE CANVAS ---------------- */}
      <section className="flex-1 flex flex-col border-r border-studio-border relative overflow-hidden">
        {/* Workspace Toolbar Header */}
        <div className="h-11 border-b border-studio-border px-4 flex items-center justify-between bg-studio-surface/60">
          <div className="flex items-center space-x-3 text-xs">
            <span className="font-medium text-studio-text">{t('studio.workspaceTitle')}</span>
            {imageMeta && (
              <div className="flex items-center space-x-2 text-studio-textSubtle text-[11px] font-mono bg-studio-surfaceLight px-2 py-0.5 rounded border border-studio-border">
                <span>{imageMeta.width} × {imageMeta.height} px</span>
                <span>•</span>
                <span>{imageMeta.aspect}</span>
              </div>
            )}

            {/* Live Session Spend & Budget Pill */}
            <div className="flex items-center space-x-2 text-[11px] font-mono bg-studio-surfaceLight px-2.5 py-0.5 rounded-lg border border-studio-border">
              <span className="text-studio-textMuted flex items-center space-x-1">
                <DollarSign className="w-3 h-3 text-emerald-400" />
                <span className="text-white font-semibold">${costSummary.sessionSpend.toFixed(2)}</span>
                <span className="text-studio-textSubtle">/ {costSummary.budgetLimit > 0 ? `$${costSummary.budgetLimit.toFixed(2)}` : '∞'}</span>
              </span>
              <span className="text-studio-border">|</span>
              <span className="text-indigo-300 font-medium">⚡ {costSummary.sessionGenerations}</span>
            </div>
          </div>


          <div className="flex items-center space-x-2">
            {/* AI 4K Upscaler Button - ALWAYS VISIBLE */}
            <button
              type="button"
              onClick={() => setIsUpscaleOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1 text-xs rounded-lg bg-gradient-to-r from-studio-cyan/25 to-indigo-600/25 hover:from-studio-cyan/35 hover:to-indigo-600/35 text-studio-cyan border border-studio-cyan/40 font-bold shadow-sm shadow-studio-cyan/10 transition-all active:scale-[0.98]"
              title="Запустить нейросетевой AI Апскейлер 4K (4x-UltraSharp & Micro-PBR Refiner)"
            >
              <Sparkles className="w-3.5 h-3.5 text-studio-cyan" />
              <span>AI Апскейлер 4K</span>
            </button>

            <button
              onClick={handleSelectImageDialog}
              className="flex items-center space-x-1.5 px-2.5 py-1 text-xs rounded bg-studio-surfaceHover hover:bg-studio-border border border-studio-border text-studio-text transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-400" />
              <span>{t('studio.loadClayRender')}</span>
            </button>
            {!sourceImage && (
              <button
                onClick={handleLoadSample}
                className="flex items-center space-x-1 px-2 py-1 text-xs rounded border border-dashed border-indigo-500/40 hover:bg-indigo-500/10 text-indigo-300 transition-colors"
                title="Завантажити тестовий рендер / Test Render"
              >
                <span>{t('studio.sampleArchicad')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Canvas Display Area */}
        <div
          className="flex-1 p-4 relative overflow-hidden flex items-center justify-center bg-studio-bg"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* STATE 1: Empty - No Image uploaded */}
          {!sourceImage && (
            <div className="max-w-md w-full border-2 border-dashed border-studio-border hover:border-indigo-500/60 rounded-2xl p-8 flex flex-col items-center text-center transition-all bg-studio-surface/40 hover:bg-studio-surface/80 group">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4 group-hover:scale-110 transition-transform">
                <Camera className="w-8 h-8" />
              </div>
              <h3 className="text-base font-semibold text-studio-text mb-1">
                {t('studio.dragDropTitle')}
              </h3>
              <p className="text-xs text-studio-textMuted mb-5 leading-relaxed">
                {t('studio.dragDropDesc')}
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
                <button
                  onClick={handleSelectImageDialog}
                  className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium shadow-md shadow-indigo-600/20 transition-colors flex items-center justify-center space-x-2"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{t('studio.selectFile')}</span>
                </button>
                <button
                  onClick={handleLoadSample}
                  className="w-full sm:w-auto px-4 py-2 bg-studio-surfaceHover hover:bg-studio-border border border-studio-border text-studio-text rounded-lg text-xs font-medium transition-colors"
                >
                  {t('studio.useSampleRender')}
                </button>
              </div>
            </div>
          )}

          {/* STATE 2: Source Image loaded, but no AI generation yet */}
          {sourceImage && !latestResult && !isGenerating && (
            <div className="w-full h-full flex flex-col items-center justify-center relative group">
              <img
                src={sourceImage}
                alt="Archicad Clay Render"
                className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-studio-border"
              />
              <div className="absolute bottom-6 bg-studio-surface/90 backdrop-blur-md border border-studio-border/80 px-4 py-2 rounded-xl shadow-lg flex items-center space-x-3 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-studio-success animate-pulse" />
                  <span className="text-studio-text">
                    {t('studio.geometryLoaded')}
                  </span>
                </div>
                <div className="h-4 w-px bg-studio-border" />
                <button
                  type="button"
                  onClick={() => setIsUpscaleOpen(true)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-studio-cyan/20 hover:bg-studio-cyan/30 text-studio-cyan border border-studio-cyan/40 flex items-center space-x-1.5 transition-all shadow-sm active:scale-[0.98]"
                  title="Апскейлить исходный рендер до 4K Ultra-HD"
                >
                  <Sparkles className="w-3.5 h-3.5 text-studio-cyan" />
                  <span>Апскейл исходника 4K</span>
                </button>
              </div>
            </div>
          )}

          {/* STATE 3: Actively Generating with Nano Banana Pro */}
          {isGenerating && (
            <div className="w-full h-full flex flex-col items-center justify-center relative p-6">
              {sourceImage && (
                <img
                  src={sourceImage}
                  alt="Processing"
                  className="max-w-full max-h-full object-contain rounded-xl opacity-20 filter blur-sm transition-all"
                />
              )}
              <div className="absolute flex flex-col items-center bg-studio-surface/95 backdrop-blur-lg border border-indigo-500/40 p-8 rounded-2xl shadow-2xl space-y-4 max-w-sm text-center">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <RefreshCw className="w-8 h-8 animate-spin" />
                  </div>
                  <Sparkles className="w-5 h-5 text-studio-cyan absolute -top-1 -right-1 animate-bounce" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-white">
                    {activeProvider.name}
                  </h4>
                  <p className="text-xs text-indigo-300 mt-1.5 animate-pulse min-h-[32px] flex items-center justify-center">
                    {generationProgressText}
                  </p>
                </div>
                <div className="w-full bg-studio-bg rounded-full h-2 overflow-hidden border border-studio-border/60">
                  <div
                    className="bg-gradient-to-r from-indigo-500 via-studio-cyan to-emerald-400 h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(99, Math.round((generationTimer / Math.max(15, targetRenderTimeSec)) * 100))}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between w-full text-[11px] font-mono text-studio-textSubtle px-1">
                  <span>
                    {generationTimer}с / {targetRenderTimeSec < 60 ? `${targetRenderTimeSec}с` : `${Math.round(targetRenderTimeSec / 60)} мин`}
                  </span>
                  <span className="text-studio-cyan font-bold">
                    {Math.min(99, Math.round((generationTimer / Math.max(15, targetRenderTimeSec)) * 100))}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STATE 4: Generation Complete - Interactive Comparison & Multi-View */}
          {sourceImage && latestResult && !isGenerating && (
            <div className="w-full h-full flex flex-col space-y-2">
              {/* Quick Comparison View Switcher Toolbar */}
              <div className="flex flex-wrap items-center justify-between bg-studio-surface/90 border border-studio-border/70 rounded-xl px-3 py-1.5 backdrop-blur-md gap-2">
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => setComparisonMode('slider')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all ${
                      comparisonMode === 'slider'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-studio-textMuted hover:text-white hover:bg-studio-surfaceHover'
                    }`}
                  >
                    <SplitSquareVertical className="w-3.5 h-3.5" />
                    <span>Слайдер До/После</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setComparisonMode('result')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all ${
                      comparisonMode === 'result'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-studio-textMuted hover:text-white hover:bg-studio-surfaceHover'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Только результат</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setComparisonMode('original')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all ${
                      comparisonMode === 'original'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-studio-textMuted hover:text-white hover:bg-studio-surfaceHover'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Оригинал Archicad</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setComparisonMode('side_by_side')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all ${
                      comparisonMode === 'side_by_side'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-studio-textMuted hover:text-white hover:bg-studio-surfaceHover'
                    }`}
                  >
                    <Columns className="w-3.5 h-3.5" />
                    <span>Бок о бок</span>
                  </button>

                  <div className="h-4 w-px bg-studio-border/60 mx-1" />

                  {/* Upscale 2x / 4x Action Button */}
                  <button
                    type="button"
                    onClick={() => setIsUpscaleOpen(true)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r from-studio-cyan/20 to-indigo-600/20 hover:from-studio-cyan/30 hover:to-indigo-600/30 text-studio-cyan border border-studio-cyan/40 flex items-center space-x-1.5 transition-all shadow-sm active:scale-[0.98]"
                    title="Увеличить разрешение до 2K / 4K Ultra-HD"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-studio-cyan" />
                    <span>Апскейл 2x / 4x</span>
                  </button>

                  {/* Add to LoRA Training Dataset Button */}
                  <button
                    type="button"
                    onClick={async () => {
                      if (!latestResult.outputImageBase64 || !sourceImage) return;
                      await trainingService.addPairToDataset({
                        sourceBase64: sourceImage,
                        outputBase64: latestResult.outputImageBase64,
                        prompt: fullPrompt,
                        styleName: styleId,
                        roomType,
                        tags: [styleId, roomType].filter(Boolean),
                      });
                      setDatasetSavedMsg(true);
                      setTimeout(() => setDatasetSavedMsg(false), 3000);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center space-x-1.5 transition-all shadow-sm active:scale-[0.98] ${
                      datasetSavedMsg
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-studio-surface hover:bg-studio-surfaceHover text-studio-textMuted hover:text-white border-studio-border'
                    }`}
                    title="Сохранить пару (Archicad + Рендер) в датасет для обучения LoRA в Training Studio"
                  >
                    <Database className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{datasetSavedMsg ? '✓ В датасете LoRA' : 'В датасет LoRA'}</span>
                  </button>
                </div>

                {/* Metadata Badge */}
                {latestResult.metadata && (
                  <div className="flex items-center space-x-2 text-[11px] font-mono text-studio-textSubtle bg-studio-bg/70 px-2.5 py-1 rounded-lg border border-studio-border/50">
                    <span className="text-indigo-300 font-semibold">Denoise: {latestResult.metadata.denoise ?? 0.35}</span>
                    <span>•</span>
                    <span>Steps: {latestResult.metadata.steps ?? 28}</span>
                    <span>•</span>
                    <span>CFG: {latestResult.metadata.cfg ?? 6.0}</span>
                    <span>•</span>
                    <span className="text-emerald-400">ControlNet: {latestResult.metadata.edgeControlStrength ? 'Canny+Depth' : 'Img2Img'}</span>
                  </div>
                )}
              </div>

              {/* Viewport */}
              <div className="flex-1 relative overflow-hidden rounded-xl border border-studio-border bg-studio-bg flex items-center justify-center">
                {comparisonMode === 'slider' && (
                  <ImageComparisonSlider
                    sourceImage={latestResult.sourceImageBase64 || sourceImage}
                    generatedImage={latestResult.outputImageBase64 || ''}
                    onExport={() => handleExport('png')}
                    onCopy={handleCopy}
                    onUpscale={() => setIsUpscaleOpen(true)}
                  />
                )}

                {comparisonMode === 'result' && (
                  <div className="relative w-full h-full flex items-center justify-center p-2">
                    <img
                      src={latestResult.outputImageBase64 || ''}
                      alt="AI Result"
                      className="max-w-full max-h-full object-contain rounded-lg"
                    />
                    <div className="absolute top-4 right-4 bg-indigo-600/80 backdrop-blur-md text-white text-xs px-2.5 py-1 rounded-md font-mono border border-indigo-400/30 shadow-lg">
                      Готовая визуализация
                    </div>
                  </div>
                )}

                {comparisonMode === 'original' && (
                  <div className="relative w-full h-full flex items-center justify-center p-2">
                    <img
                      src={latestResult.sourceImageBase64 || sourceImage}
                      alt="Archicad Clay Render"
                      className="max-w-full max-h-full object-contain rounded-lg"
                    />
                    <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md text-white text-xs px-2.5 py-1 rounded-md font-mono border border-white/10 shadow-lg">
                      Исходный рендер Archicad
                    </div>
                  </div>
                )}

                {comparisonMode === 'side_by_side' && (
                  <div className="w-full h-full grid grid-cols-2 gap-2 p-2">
                    <div className="relative h-full border border-studio-border/60 rounded-lg overflow-hidden flex items-center justify-center bg-black/30">
                      <img
                        src={latestResult.sourceImageBase64 || sourceImage}
                        alt="Archicad Clay"
                        className="max-w-full max-h-full object-contain"
                      />
                      <span className="absolute top-2 left-2 bg-black/70 text-white/90 text-[10px] px-2 py-0.5 rounded font-mono">
                        Исходный Archicad
                      </span>
                    </div>
                    <div className="relative h-full border border-indigo-500/30 rounded-lg overflow-hidden flex items-center justify-center bg-black/30">
                      <img
                        src={latestResult.outputImageBase64 || ''}
                        alt="AI Result"
                        className="max-w-full max-h-full object-contain"
                      />
                      <span className="absolute top-2 right-2 bg-indigo-600/80 text-white text-[10px] px-2 py-0.5 rounded font-mono">
                        Результат визуализации
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Multi-turn Refinement Bar */}
              <div className="mt-3 bg-studio-surface border border-studio-border rounded-xl p-2.5 flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-indigo-400 flex-shrink-0 ml-1.5" />
                <input
                  type="text"
                  value={refinementText}
                  onChange={(e) => setRefinementText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRefine();
                  }}
                  placeholder={t('studio.refinePlaceholder')}
                  disabled={isRefining}
                  className="flex-1 bg-transparent text-xs text-studio-text placeholder-studio-textSubtle focus:outline-none"
                />
                <button
                  onClick={handleRefine}
                  disabled={isRefining || !refinementText.trim()}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5"
                >
                  {isRefining ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Send className="w-3 h-3" />
                  )}
                  <span>{isRefining ? t('studio.refining') : t('studio.applyRefinement')}</span>
                </button>
                <div className="h-4 w-px bg-studio-border mx-1" />
                <button
                  onClick={() => setIsFullscreen(true)}
                  className="p-1.5 hover:bg-studio-surfaceHover rounded text-studio-textMuted hover:text-white"
                  title={t('studio.fullscreen')}
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Global studio banner for errors with smart 1-click recovery */}
        {errorMsg && (
          <div className="mx-4 mb-3 p-3.5 rounded-xl bg-studio-danger/10 border border-studio-danger/30 text-studio-danger text-xs space-y-2.5 animate-fadeIn">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-studio-danger" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
              <button
                onClick={() => setErrorMsg(null)}
                className="text-studio-danger hover:text-white ml-3 font-bold text-sm leading-none"
              >
                ✕
              </button>
            </div>

            {/* Smart 1-click switch buttons for billing/endpoint errors */}
            {(errorMsg.includes('402') || errorMsg.includes('prepayment') || errorMsg.includes('credit') || errorMsg.includes('404') || errorMsg.includes('API-ключ')) && (
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-studio-danger/20">
                <button
                  onClick={() => {
                    setActiveProviderId('comfyui_local');
                    providerRegistry.setActiveProvider('comfyui_local');
                    setErrorMsg(null);
                  }}
                  className="px-2.5 py-1 bg-studio-cyan/20 hover:bg-studio-cyan/30 text-studio-cyan border border-studio-cyan/40 rounded-lg text-[11px] font-semibold transition-colors flex items-center space-x-1"
                >
                  <Cpu className="w-3 h-3" />
                  <span>{t('studio.switchToComfyUI')}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ---------------- RIGHT: STUDIO INSPECTOR PANEL ---------------- */}
      <aside className="w-96 bg-studio-surface flex flex-col justify-between overflow-y-auto border-l border-studio-border">
        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-studio-border">
            <div className="flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-studio-text">
                {t('inspector.title')}
              </span>
            </div>
            <span className="text-[10px] text-studio-cyan bg-studio-cyan/10 border border-studio-cyan/20 px-2 py-0.5 rounded font-mono">
              {PROVIDERS_CATALOG.find((p) => p.id === activeProviderId)?.shortName || activeProvider.name}
            </span>
          </div>

          {/* Studio Mode Switcher: Designer (Simple) vs PRO (Expert) */}
          <div className="flex items-center p-1 bg-studio-bg rounded-xl border border-studio-border">
            <button
              type="button"
              onClick={() => setStudioMode('designer')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-2 ${
                studioMode === 'designer'
                  ? 'bg-gradient-to-r from-studio-cyan to-blue-500 text-black shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Дизайнер (Простой)</span>
            </button>
            <button
              type="button"
              onClick={() => setStudioMode('pro')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-2 ${
                studioMode === 'pro'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>PRO (Эксперт)</span>
            </button>
          </div>

          {/* ======================================================== */}
          {/* DESIGNER MODE: 5 SIMPLE VISUAL CARDS FOR NON-TECH USERS */}
          {/* ======================================================== */}
          {studioMode === 'designer' && (
            <div className="space-y-4 animate-in fade-in">
              {/* Card 1: Room Type */}
              <div className="p-3.5 rounded-xl bg-studio-surface border border-studio-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
                    <span>🏠 1. Тип помещения</span>
                  </span>
                  <span className="text-[10px] text-studio-cyan font-mono">Archicad Scene</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: 'kitchen', label: '🍳 Кухня' },
                    { id: 'kitchen_living', label: '🛋️ Кухня-гостиная' },
                    { id: 'living_room', label: '🪑 Гостиная' },
                    { id: 'bedroom', label: '🛏️ Спальня' },
                    { id: 'bathroom', label: '🚿 Санузел' },
                    { id: 'hallway', label: '🚪 Прихожая' },
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRoomType(r.id as RoomType)}
                      className={`py-2 px-2.5 rounded-lg text-xs font-medium text-left transition-all border ${
                        roomType === r.id
                          ? 'bg-studio-cyan/20 border-studio-cyan text-white shadow-sm'
                          : 'bg-studio-bg hover:bg-studio-surfaceLight border-studio-border text-zinc-300'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Card 2: Visual Style */}
              <div className="p-3.5 rounded-xl bg-studio-surface border border-studio-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    🎨 2. Стиль дизайна
                  </span>
                  <span className="text-[10px] text-studio-textMuted">Готовые палитры</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'japandi', label: 'Джапанди', desc: 'Теплое дерево, дзен, лен' },
                    { id: 'minimalism', label: 'Минимализм', desc: 'Чистые линии, травертин' },
                    { id: 'scandinavian', label: 'Сканди', desc: 'Светлый дуб, воздух, свет' },
                    { id: 'neoclassic', label: 'Неоклассика', desc: 'Мрамор, лепнина, латунь' },
                    { id: 'loft', label: 'Лофт', desc: 'Бетон, металл, кирпич' },
                    { id: 'wabi_sabi', label: 'Wabi-Sabi', desc: 'Фактурная штукатурка, дерево' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStyleId(s.id)}
                      className={`p-2.5 rounded-xl text-left transition-all border flex flex-col justify-between ${
                        styleId === s.id
                          ? 'bg-gradient-to-br from-studio-cyan/20 to-blue-500/10 border-studio-cyan text-white shadow-sm ring-1 ring-studio-cyan/50'
                          : 'bg-studio-bg hover:bg-studio-surfaceLight border-studio-border text-zinc-300'
                      }`}
                    >
                      <span className="font-bold text-xs">{s.label}</span>
                      <span className="text-[10px] text-zinc-400 mt-1 leading-tight">{s.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Card 3: Quick PBR Materials Moodboard */}
              <div className="p-3.5 rounded-xl bg-studio-surface border border-studio-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    🪵 3. Материалы и отделка
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">
                    Выбрано: {selectedMaterials.length}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400">
                  Нажмите, чтобы включить нужные текстуры в визуализацию:
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-0.5">
                  {[
                    { id: 'wood_walnut', label: 'Американский орех' },
                    { id: 'wood_oak', label: 'Светлый дуб' },
                    { id: 'wood_slats', label: 'Деревянные рейки' },
                    { id: 'stone_travertine', label: 'Римский травертин' },
                    { id: 'marble_calacatta', label: 'Мрамор Калакатта' },
                    { id: 'stone_terrazzo', label: 'Терраццо' },
                    { id: 'surface_microcement', label: 'Микроцемент' },
                    { id: 'surface_concrete', label: 'Бетон' },
                    { id: 'metal_brass', label: 'Латунь / Шампань' },
                    { id: 'metal_black', label: 'Черный металл' },
                    { id: 'glass_fluted', label: 'Рифленое стекло' },
                    { id: 'boucle', label: 'Ткань букле' },
                    { id: 'leather', label: 'Кожа' },
                  ].map((mat) => {
                    const isSelected = selectedMaterials.includes(mat.id);
                    return (
                      <button
                        key={mat.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedMaterials(selectedMaterials.filter((m) => m !== mat.id));
                          } else {
                            setSelectedMaterials([...selectedMaterials, mat.id]);
                          }
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border flex items-center space-x-1 ${
                          isSelected
                            ? 'bg-purple-600/30 border-purple-400 text-white shadow-sm'
                            : 'bg-studio-bg hover:bg-studio-surfaceLight border-studio-border text-zinc-400'
                        }`}
                      >
                        <span>{mat.label}</span>
                        {isSelected && <Check className="w-3 h-3 text-purple-300 ml-0.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Card 4: Lighting & Time of Day */}
              <div className="p-3.5 rounded-xl bg-studio-surface border border-studio-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    💡 4. Свет и время суток
                  </span>
                  <span className="text-[10px] text-amber-300 font-mono">3000K ArchViz</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Солнечный день', icon: '☀️', prompt: 'bright warm natural daylight streaming through windows, clear architectural exposure, soft sunlight spots' },
                    { label: 'Рассеянный день', icon: '⛅', prompt: 'soft diffused daylight, overcast soft shadows, neutral architectural lighting, clean reflections' },
                    { label: 'Уютный вечер', icon: '🌙', prompt: 'cozy warm evening ambient lighting, concealed 3000K warm LED strips beneath cabinets, dim warm glow, gentle contrast' },
                  ].map((l, idx) => {
                    const isSelected = customLighting === l.prompt;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCustomLighting(l.prompt)}
                        className={`p-2 rounded-xl text-center transition-all border flex flex-col items-center justify-center space-y-1 ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-400 text-white shadow-sm ring-1 ring-amber-400/50'
                            : 'bg-studio-bg hover:bg-studio-surfaceLight border-studio-border text-zinc-300'
                        }`}
                      >
                        <span className="text-lg">{l.icon}</span>
                        <span className="text-[10px] font-semibold">{l.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Card 5: Strictness of Archicad Geometry (Human Presets) */}
              <div className="p-3.5 rounded-xl bg-studio-surface border border-studio-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    📐 5. Точность стен и мебели
                  </span>
                  <span className="text-[10px] text-studio-cyan font-mono">
                    {geometryMode === 'strict' ? t('geom.strictBadge') : geometryMode === 'balanced' ? t('geom.balancedBadge') : t('geom.creativeBadge')}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { mode: 'strict', denoise: 0.60, label: 'Строго Archicad', desc: 'Стены и мебель заблокированы' },
                    { mode: 'balanced', denoise: 0.75, label: 'Идеальный баланс', desc: 'Фотореализм + геометрия' },
                    { mode: 'creative', denoise: 0.82, label: 'Больше декора', desc: 'Свобода расстановки декора' },
                  ].map((g, idx) => {
                    const isSelected = geometryMode === g.mode;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setGeometryMode(g.mode as any);
                          setDenoiseStrength(g.denoise);
                        }}
                        className={`p-2 rounded-xl text-left transition-all border flex flex-col justify-between ${
                          isSelected
                            ? 'bg-studio-cyan/20 border-studio-cyan text-white shadow-sm'
                            : 'bg-studio-bg hover:bg-studio-surfaceLight border-studio-border text-zinc-400'
                        }`}
                      >
                        <span className="text-[11px] font-bold text-white leading-tight">{g.label}</span>
                        <span className="text-[9px] text-zinc-400 mt-1 leading-tight">{g.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* PRO MODE: 4 ADVANCED TABS FOR ENGINEERS & POWER USERS    */}
          {/* ======================================================== */}
          {studioMode === 'pro' && (
            <>
              {/* 4-Tab Navigation Bar */}
              <div className="grid grid-cols-4 gap-1 p-1 bg-studio-bg rounded-xl border border-studio-border text-center">
                <button
                  type="button"
                  onClick={() => setInspectorTab('main')}
                  className={`py-1.5 px-1 rounded-lg text-[11px] font-semibold transition-all ${
                    inspectorTab === 'main'
                      ? 'bg-gradient-to-r from-indigo-600 to-studio-cyan text-white shadow-sm'
                      : 'text-studio-textMuted hover:text-white hover:bg-studio-surface'
                  }`}
                >
                  Рендер
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorTab('materials')}
                  className={`py-1.5 px-1 rounded-lg text-[11px] font-semibold transition-all ${
                    inspectorTab === 'materials'
                      ? 'bg-gradient-to-r from-indigo-600 to-studio-cyan text-white shadow-sm'
                      : 'text-studio-textMuted hover:text-white hover:bg-studio-surface'
                  }`}
                >
                  Материалы
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorTab('control')}
                  className={`py-1.5 px-1 rounded-lg text-[11px] font-semibold transition-all ${
                    inspectorTab === 'control'
                      ? 'bg-gradient-to-r from-indigo-600 to-studio-cyan text-white shadow-sm'
                      : 'text-studio-textMuted hover:text-white hover:bg-studio-surface'
                  }`}
                >
                  AI Control
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorTab('prompt')}
                  className={`py-1.5 px-1 rounded-lg text-[11px] font-semibold transition-all ${
                    inspectorTab === 'prompt'
                      ? 'bg-gradient-to-r from-indigo-600 to-studio-cyan text-white shadow-sm'
                      : 'text-studio-textMuted hover:text-white hover:bg-studio-surface'
                  }`}
                >
                  Промпт
                </button>
              </div>

          {/* TAB 1: MAIN RENDER PARAMS */}
          {inspectorTab === 'main' && (
            <div className="space-y-4 animate-in fade-in">

          {/* 1. AI ENGINE SELECTOR (Google Gemini, Krea, Pollinations Free, AI Horde Free, etc.) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <label className="text-[11px] font-medium text-studio-textMuted uppercase tracking-wider">
                  {t('cost.providerSwitch')}
                </label>
                <button
                  type="button"
                  onClick={onNavigateSettings}
                  className="text-[10px] text-studio-cyan hover:underline font-mono"
                  title="Настроить активные сервисы в меню Настроек"
                >
                  (⚙️ {enabledProviderIds.length}/8)
                </button>
              </div>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                {PROVIDERS_CATALOG.find((p) => p.id === activeProviderId)?.isFree ? '100% БЕСПЛАТНО' : 'ПЛАТНЫЙ API'}
              </span>
            </div>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
              {PROVIDERS_CATALOG.filter((p) => p.isAvailable && enabledProviderIds.includes(p.id)).map((prov) => {
                const isActive = activeProviderId === prov.id;
                return (
                  <button
                    key={prov.id}
                    onClick={() => {
                      setActiveProviderId(prov.id);
                      providerRegistry.setActiveProvider(prov.id);
                      setErrorMsg(null);
                    }}
                    className={`w-full py-2 px-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-600/25 to-studio-cyan/15 border-studio-cyan text-white shadow-md ring-1 ring-studio-cyan/40'
                        : 'bg-studio-bg/90 border-studio-border text-studio-textMuted hover:text-white hover:border-studio-border/90'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className={`p-1.5 rounded-lg flex-shrink-0 ${isActive ? 'bg-studio-cyan/20 text-studio-cyan' : 'bg-studio-surface text-studio-textSubtle'}`}>
                        {prov.id === 'comfyui_local' ? (
                          <Cpu className="w-3.5 h-3.5" />
                        ) : prov.id === 'gemini_bridge' ? (
                          <ExternalLink className="w-3.5 h-3.5" />
                        ) : prov.isFree ? (
                          <Sparkles className="w-3.5 h-3.5" />
                        ) : (
                          <Zap className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-semibold text-xs text-white truncate">{prov.shortName}</span>
                          {isActive && <CheckCircle2 className="w-3 h-3 text-studio-cyan flex-shrink-0" />}
                        </div>
                        <span className="text-[10px] text-zinc-400 block truncate">{prov.description}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border block ${
                        prov.isFree
                          ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30 font-bold'
                          : 'text-indigo-300 bg-indigo-500/15 border-indigo-500/30'
                      }`}>
                        {prov.isFree ? '0.00$ Free' : prov.costBadge}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>


          {/* 2. RESOLUTION SELECTOR & ESTIMATED COST */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-studio-textMuted uppercase tracking-wider">
                {t('cost.resolution')}
              </label>
              <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${
                currentCostEstimate === 0 
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                  : 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
              }`}>
                {currentCostEstimate === 0 ? '0.00$ • БЕСПЛАТНО' : `~$${currentCostEstimate.toFixed(3)} USD`}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {RESOLUTION_OPTIONS.map((opt) => {
                const isSelected = resolution === opt.id;
                const cost = costTracker.getCostEstimate(
                  activeProviderId,
                  activeProvider.currentModel,
                  opt.id
                );
                return (
                  <button
                    key={opt.id}
                    onClick={() => setResolution(opt.id)}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-sm'
                        : 'bg-studio-bg border-studio-border text-studio-textMuted hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs uppercase">{opt.id}</span>
                      {opt.id === '1k' && (
                        <span className="text-[9px] bg-amber-500/15 text-amber-300 px-1 rounded font-mono">
                          Draft
                        </span>
                      )}
                      {opt.id === '4k' && (
                        <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1 rounded font-mono">
                          Ultra
                        </span>
                      )}
                    </div>
                    <div className="text-[9px] text-studio-textSubtle mt-0.5">{opt.dimensions}</div>
                    <div className="text-[9px] text-emerald-400 font-mono font-semibold mt-0.5">
                      {cost === 0 ? '0.00$ Free' : `~$${cost.toFixed(3)}`}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>



          {/* 2.5 AI 4K UPSCALER QUICK ACCESS */}
          <div className="p-2.5 rounded-xl bg-gradient-to-r from-studio-cyan/10 via-indigo-600/10 to-transparent border border-studio-cyan/30 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 rounded-lg bg-studio-cyan/20 text-studio-cyan">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-bold text-white">AI Апскейлер 4K</span>
                  <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1 rounded border border-emerald-500/20">4x-UltraSharp</span>
                </div>
                <p className="text-[10px] text-zinc-400">Нейросетевое увеличение и PBR-текстуры</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsUpscaleOpen(true)}
              className="px-2.5 py-1.5 rounded-lg bg-studio-cyan/20 hover:bg-studio-cyan/30 border border-studio-cyan/40 text-studio-cyan hover:text-white text-xs font-semibold shadow-sm transition-all active:scale-[0.98]"
            >
              Открыть
            </button>
          </div>

          {/* 3. ROOM TYPE */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-studio-textMuted uppercase tracking-wider">
              {t('inspector.roomType')}
            </label>
            <select
              value={roomType}
              onChange={(e) => setRoomType(e.target.value as RoomType)}
              className="w-full bg-studio-bg border border-studio-border focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-studio-text focus:outline-none transition-colors"
            >
              {ROOM_TYPES.map((r) => (
                <option key={r.id} value={r.id}>
                  {getRoomLabel(r)}
                </option>
              ))}
            </select>
          </div>

          {/* 4. INTERIOR STYLE */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-studio-textMuted uppercase tracking-wider">
                {t('inspector.style')}
              </label>
              <span className="text-[10px] text-indigo-400">
                {t('inspector.stylesCount', { count: INTERIOR_STYLES.length })}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
              {INTERIOR_STYLES.map((style) => {
                const isSelected = styleId === style.id;
                return (
                  <button
                    key={style.id}
                    onClick={() => setStyleId(style.id)}
                    className={`p-2 rounded-lg text-left text-xs border transition-all ${
                      isSelected
                        ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-sm'
                        : 'bg-studio-surfaceLight border-studio-border/70 hover:border-studio-border text-studio-textMuted hover:text-studio-text'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium truncate text-[11px]">{style.name.split('/')[0]}</span>
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: style.previewColor }}
                      />
                    </div>
                    <p className="text-[10px] text-studio-textSubtle line-clamp-1">
                      {getStyleDesc(style)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>


          {/* 5. GEOMETRY PRESERVATION MODE */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-studio-textMuted uppercase tracking-wider">
                {t('inspector.geometryLock')}
              </label>
              <span className="text-[10px] font-mono text-studio-success">
                {geometryMode === 'strict' ? t('geom.strictBadge') : geometryMode === 'balanced' ? t('geom.balancedBadge') : t('geom.creativeBadge')}
              </span>
            </div>
            <div className="space-y-1">
              {GEOMETRY_MODES.map((mode) => {
                const isSelected = geometryMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    onClick={() => {
                      setGeometryMode(mode.id);
                      if (mode.id === 'strict') {
                        setDenoiseStrength(0.60);
                        setEdgeControlStrength(0.85);
                        setDepthControlStrength(0.70);
                        setCfgScale(4.0);
                        setStepsCount(35);
                      } else if (mode.id === 'balanced') {
                        setDenoiseStrength(0.75);
                        setEdgeControlStrength(0.80);
                        setDepthControlStrength(0.70);
                        setCfgScale(4.0);
                        setStepsCount(38);
                      } else if (mode.id === 'creative') {
                        setDenoiseStrength(0.82);
                        setEdgeControlStrength(0.65);
                        setDepthControlStrength(0.60);
                        setCfgScale(4.0);
                        setStepsCount(40);
                      }
                    }}
                    className={`w-full p-2 rounded-lg text-left border transition-all ${
                      isSelected
                        ? 'bg-indigo-600/10 border-indigo-500 text-studio-text'
                        : 'bg-studio-surfaceLight border-studio-border hover:bg-studio-surfaceHover text-studio-textMuted'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-medium mb-0.5">
                      <span>{getGeomTitle(mode)}</span>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />}
                    </div>
                    <p className="text-[10px] text-studio-textSubtle leading-relaxed">
                      {getGeomDesc(mode)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* TAB 3: ADVANCED AI CONTROL PANEL (Architectural Control) */}
      {inspectorTab === 'control' && (
        <div className="space-y-3 animate-in fade-in">
          <div className="space-y-3 border border-studio-border/70 rounded-xl p-3 bg-studio-surfaceLight/60">
            <div className="flex items-center justify-between pb-2 border-b border-studio-border/50">
              <div className="flex items-center space-x-2">
                <SlidersHorizontal className="w-4 h-4 text-studio-cyan" />
                <span className="text-xs font-bold text-white tracking-wide uppercase">
                  Панель AI Control (Точные параметры)
                </span>
              </div>
              <span className="text-[10px] font-mono text-studio-cyan bg-studio-cyan/10 px-2 py-0.5 rounded border border-studio-cyan/20">
                Denoise: {denoiseStrength}
              </span>
            </div>

            {/* Fast Preset Buttons & Time Budget */}
            <div className="space-y-1.5">
                  <span className="text-[10px] font-medium text-studio-textSubtle uppercase tracking-wider">Пресеты качества и времени:</span>
                  <div className="grid grid-cols-4 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setTargetRenderTimeSec(15);
                        setStepsCount(18);
                        setCfgScale(4.2);
                        setDenoiseStrength(0.60);
                        setEdgeControlStrength(0.75);
                        setDepthControlStrength(0.0);
                      }}
                      className="px-1.5 py-1.5 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[10px] font-medium text-center"
                    >
                      ⚡ 15с Драфт
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetRenderTimeSec(35);
                        setStepsCount(35);
                        setCfgScale(4.0);
                        setDenoiseStrength(0.68);
                        setEdgeControlStrength(0.85);
                        setDepthControlStrength(0.0);
                      }}
                      className="px-1.5 py-1.5 rounded bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-[10px] font-medium text-center"
                    >
                      💎 35с PBR
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetRenderTimeSec(60);
                        setStepsCount(55);
                        setCfgScale(4.0);
                        setDenoiseStrength(0.68);
                        setEdgeControlStrength(0.85);
                        setDepthControlStrength(0.0);
                      }}
                      className="px-1.5 py-1.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[10px] font-medium text-center"
                    >
                      🏛️ 60с Deep
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetRenderTimeSec(120);
                        setStepsCount(35);
                        setCfgScale(3.8);
                        setDenoiseStrength(0.68);
                        setEdgeControlStrength(0.85);
                        setDepthControlStrength(0.0);
                      }}
                      className="px-1.5 py-1.5 rounded bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-[10px] font-medium text-center"
                    >
                      ✨ 2 мин 2-Pass
                    </button>
                  </div>

                  {/* Deep Multi-Pass Architectural Presets (5, 10, 15 Minutes) */}
                  <div className="grid grid-cols-3 gap-1 pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setTargetRenderTimeSec(300);
                        setStepsCount(50);
                        setCfgScale(3.8);
                        setDenoiseStrength(0.68);
                        setEdgeControlStrength(0.85);
                        setDepthControlStrength(0.0);
                      }}
                      className="px-1.5 py-1.5 rounded bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-[10px] font-medium text-center"
                    >
                      🏆 5 мин (3-Pass Ultra)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetRenderTimeSec(600);
                        setStepsCount(55);
                        setCfgScale(3.8);
                        setDenoiseStrength(0.68);
                        setEdgeControlStrength(0.85);
                        setDepthControlStrength(0.0);
                      }}
                      className="px-1.5 py-1.5 rounded bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 text-[10px] font-medium text-center"
                    >
                      👑 10 мин (Master Studio)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetRenderTimeSec(900);
                        setStepsCount(60);
                        setCfgScale(3.8);
                        setDenoiseStrength(0.68);
                        setEdgeControlStrength(0.85);
                        setDepthControlStrength(0.0);
                      }}
                      className="px-1.5 py-1.5 rounded bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-[10px] font-medium text-center"
                    >
                      🌟 15 мин (Exhibition 4K)
                    </button>
                  </div>

                  {/* Ultra Masterpiece Architectural Presets (30, 45, 60 Minutes) */}
                  <div className="grid grid-cols-3 gap-1 pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setTargetRenderTimeSec(1800);
                        setStepsCount(70);
                        setCfgScale(4.0);
                        setDenoiseStrength(0.78);
                        setEdgeControlStrength(0.80);
                        setDepthControlStrength(0.70);
                      }}
                      className="px-1.5 py-1.5 rounded bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-[10px] font-medium text-center"
                    >
                      🌌 30 мин (Hyper)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetRenderTimeSec(2700);
                        setStepsCount(75);
                        setCfgScale(4.0);
                        setDenoiseStrength(0.78);
                        setEdgeControlStrength(0.80);
                        setDepthControlStrength(0.70);
                      }}
                      className="px-1.5 py-1.5 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[10px] font-medium text-center"
                    >
                      🏰 45 мин (Comp)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetRenderTimeSec(3600);
                        setStepsCount(85);
                        setCfgScale(4.0);
                        setDenoiseStrength(0.78);
                        setEdgeControlStrength(0.80);
                        setDepthControlStrength(0.70);
                      }}
                      className="px-1.5 py-1.5 rounded bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-[10px] font-bold text-center"
                    >
                      🌠 60 мин (Ultra)
                    </button>
                  </div>
                </div>

                {/* 0. Target Render Time (Seconds & Minutes) */}
                <div className="space-y-1.5 bg-studio-bg/60 p-2.5 rounded-lg border border-studio-border/60">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-white font-medium">Желаемое время рендера:</span>
                    <div className="flex items-center space-x-1">
                      <span className="font-mono text-studio-cyan font-bold text-xs">
                        {targetRenderTimeSec < 60
                          ? `${targetRenderTimeSec} сек`
                          : `${Math.floor(targetRenderTimeSec / 60)} мин ${targetRenderTimeSec % 60 ? (targetRenderTimeSec % 60) + 'с' : ''}`}
                      </span>
                      <span className="text-[9px] text-studio-textSubtle">
                        ({targetRenderTimeSec >= 900
                          ? 'Ultra Masterpiece Pipeline'
                          : targetRenderTimeSec >= 300
                          ? '3-Pass Master Architecture'
                          : targetRenderTimeSec > 75
                          ? '2-Pass Latent Refinement'
                          : `~${stepsCount} шагов`})
                      </span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="3600"
                    step="15"
                    value={targetRenderTimeSec}
                    onChange={(e) => {
                      const sec = parseInt(e.target.value);
                      setTargetRenderTimeSec(sec);
                      if (sec <= 20) {
                        setStepsCount(18);
                      } else if (sec <= 45) {
                        setStepsCount(Math.max(22, Math.min(45, Math.round(sec * 0.95))));
                      } else if (sec <= 75) {
                        setStepsCount(Math.max(45, Math.min(65, Math.round(sec * 0.90))));
                      } else if (sec <= 180) {
                        setStepsCount(40);
                      } else if (sec <= 900) {
                        setStepsCount(Math.min(65, Math.max(45, Math.round(sec / 16))));
                      } else {
                        setStepsCount(Math.min(85, Math.max(60, Math.round(sec / 45))));
                      }
                    }}
                    className="w-full accent-cyan-400 h-1.5 bg-studio-surface rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-studio-textSubtle font-mono">
                    <span>15с</span>
                    <span>5м</span>
                    <span>15м</span>
                    <span>30м</span>
                    <span>45м</span>
                    <span>60м</span>
                  </div>
                </div>

                {/* 1. Denoise Strength */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-studio-textMuted">Denoise Strength (Сила изменения)</span>
                    <span className="font-mono text-studio-cyan font-bold">{denoiseStrength}</span>
                  </div>
                  <input
                    type="range"
                    min="0.20"
                    max="0.85"
                    step="0.01"
                    value={denoiseStrength}
                    onChange={(e) => setDenoiseStrength(parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 h-1.5 bg-studio-bg rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-studio-textSubtle font-mono">
                    <span className={denoiseStrength < 0.55 ? 'text-zinc-500' : ''}>&lt; 0.55 Сильное сохранение</span>
                    <span className={denoiseStrength >= 0.55 && denoiseStrength <= 0.80 ? 'text-emerald-400 font-bold' : ''}>0.60–0.75 Материалы и фотореализм</span>
                    <span className={denoiseStrength > 0.80 ? 'text-amber-400 font-semibold' : ''}>&gt; 0.80 Больше свободы</span>
                  </div>
                </div>

                {/* 2. Edge / Canny ControlNet Strength */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-studio-textMuted">Edge / Canny ControlNet (Контуры мебели)</span>
                    <span className="font-mono text-emerald-400 font-semibold">{edgeControlStrength}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={edgeControlStrength}
                    onChange={(e) => setEdgeControlStrength(parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 h-1.5 bg-studio-bg rounded-lg cursor-pointer"
                  />
                  <div className="text-[9px] text-studio-textSubtle">
                    Фиксирует линии фасадов шкафов, стыки стен и пропорции мебели из Archicad.
                  </div>
                </div>

                {/* 3. Depth ControlNet Strength */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-studio-textMuted">Depth ControlNet (Глубина и перспектива)</span>
                    <span className="font-mono text-indigo-400 font-semibold">{depthControlStrength}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={depthControlStrength}
                    onChange={(e) => setDepthControlStrength(parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 h-1.5 bg-studio-bg rounded-lg cursor-pointer"
                  />
                  <div className="text-[9px] text-studio-textSubtle">
                    Предотвращает искажение угла камеры, высоты потолка и глубины комнаты.
                  </div>
                </div>

                {/* 4. CFG & Steps */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-studio-textMuted">CFG Scale</span>
                      <span className="font-mono text-white">{cfgScale}</span>
                    </div>
                    <input
                      type="range"
                      min="1.0"
                      max="14.0"
                      step="0.5"
                      value={cfgScale}
                      onChange={(e) => setCfgScale(parseFloat(e.target.value))}
                      className="w-full accent-indigo-500 h-1.5 bg-studio-bg rounded-lg cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-studio-textMuted">Шаги (Steps)</span>
                      <span className="font-mono text-white">{stepsCount}</span>
                    </div>
                    <input
                      type="range"
                      min="15"
                      max="40"
                      step="1"
                      value={stepsCount}
                      onChange={(e) => setStepsCount(parseInt(e.target.value))}
                      className="w-full accent-indigo-500 h-1.5 bg-studio-bg rounded-lg cursor-pointer"
                    />
                  </div>
                </div>

                {/* 5. Seed input with randomize */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-studio-textMuted">Seed (Сид генерации)</span>
                    <span className="text-[10px] font-mono text-studio-textSubtle">
                      {customSeed === -1 ? 'Случайный' : customSeed}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <input
                      type="number"
                      value={customSeed === -1 ? '' : customSeed}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        setCustomSeed(val === '' ? -1 : parseInt(val) || -1);
                      }}
                      placeholder="-1 (Случайный при каждом рендере)"
                      className="flex-1 bg-studio-bg border border-studio-border focus:border-indigo-500 rounded-lg px-2.5 py-1 text-xs font-mono text-studio-text focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setCustomSeed(-1)}
                      className={`p-1.5 rounded-lg border text-xs transition-colors flex items-center space-x-1 ${
                        customSeed === -1
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                          : 'bg-studio-surface border-studio-border text-studio-textMuted hover:text-white'
                      }`}
                      title="Сбросить на случайный (-1)"
                    >
                      <Dices className="w-3.5 h-3.5" />
                    </button>
                    {latestResult?.metadata?.seed !== undefined && (
                      <button
                        type="button"
                        onClick={() => {
                          if (latestResult.metadata?.seed !== undefined) {
                            setCustomSeed(latestResult.metadata.seed);
                          }
                        }}
                        className="px-2 py-1 bg-studio-surface hover:bg-studio-surfaceHover border border-studio-border text-studio-textMuted hover:text-white rounded-lg text-[10px] font-mono"
                        title="Использовать сид предыдущей генерации"
                      >
                        Зафиксировать
                      </button>
                    )}
                  </div>
                </div>

                {/* 5.5 LoRA Model Selection & Weight */}
                <div className="space-y-1.5 p-2.5 rounded-xl bg-studio-surface/50 border border-studio-border">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-studio-text flex items-center space-x-1.5">
                      <Cpu className="w-3.5 h-3.5 text-studio-cyan" />
                      <span>LoRA Веса (Обучение интерьеров)</span>
                    </span>
                    <span className="text-[10px] font-mono text-studio-cyan bg-studio-cyan/10 px-1.5 py-0.5 rounded border border-studio-cyan/20">
                      {selectedLora ? `${Math.round(loraStrength * 100)}%` : 'Выкл'}
                    </span>
                  </div>

                  <select
                    value={selectedLora}
                    onChange={(e) => setSelectedLora(e.target.value)}
                    className="w-full bg-studio-bg border border-studio-border focus:border-studio-cyan rounded-lg px-2.5 py-1.5 text-xs text-studio-text focus:outline-none"
                  >
                    <option value="">Без LoRA (Базовый чекпоинт)</option>
                    {availableLoras.map((lora) => (
                      <option key={lora} value={lora}>
                        {lora}
                      </option>
                    ))}
                  </select>

                  {selectedLora && (
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[10px] text-studio-textMuted">
                        <span>Влияние весов LoRA (Weight)</span>
                        <span className="font-mono text-studio-cyan">{loraStrength.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="1.5"
                        step="0.05"
                        value={loraStrength}
                        onChange={(e) => setLoraStrength(parseFloat(e.target.value))}
                        className="w-full accent-studio-cyan h-1.5 bg-studio-bg rounded-lg cursor-pointer"
                      />
                    </div>
                  )}
                </div>

                {/* 6. Preservation Toggles */}
                <div className="space-y-1.5 pt-1 border-t border-studio-border/30">
                  <label className="flex items-center space-x-2 text-xs text-studio-text cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={preserveGeometry}
                      onChange={(e) => setPreserveGeometry(e.target.checked)}
                      className="rounded bg-studio-bg border-studio-border text-indigo-600 focus:ring-0"
                    />
                    <span>Preserve Geometry (Блокировать геометрию стен и проёмов)</span>
                  </label>

                  <label className="flex items-center space-x-2 text-xs text-studio-text cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={preserveFurniture}
                      onChange={(e) => setPreserveFurniture(e.target.checked)}
                      className="rounded bg-studio-bg border-studio-border text-indigo-600 focus:ring-0"
                    />
                    <span>Preserve Furniture (Блокировать габариты мебели и шкафов)</span>
                  </label>

                  <div className="pt-1.5 border-t border-studio-border/30">
                    <label className="flex items-center space-x-2 text-xs text-studio-text cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={usePureEmptyLatent}
                        onChange={(e) => setUsePureEmptyLatent(e.target.checked)}
                        className="rounded bg-studio-bg border-studio-border text-studio-cyan focus:ring-0"
                      />
                      <span className="flex items-center space-x-1.5 flex-wrap">
                        <Sparkles className="w-3.5 h-3.5 text-studio-cyan" />
                        <span className="font-semibold text-white">Режим чистого латента (EmptyLatent + ControlNet)</span>
                        <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/15 px-1.5 py-0.2 rounded border border-emerald-500/30">
                          Мастер-PBR
                        </span>
                      </span>
                    </label>
                    <p className="text-[10px] text-studio-textSubtle pl-5 pt-0.5 leading-relaxed">
                      Устраняет серый клей-налёт Archicad. Модель строит глубокие текстуры дерева и свет с чистого шума, а ControlNet (Canny + Depth) удерживает точные стены и мебель.
                    </p>
                  </div>
                </div>

                {/* 7. Material Creativity */}
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-studio-textMuted">Material Creativity (Вариативность материалов)</span>
                    <span className="font-mono text-white">{(materialCreativity * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={materialCreativity}
                    onChange={(e) => setMaterialCreativity(parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 h-1.5 bg-studio-bg rounded-lg cursor-pointer"
                  />
                </div>

                {/* ControlNet Models Hardware Status */}
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-300 space-y-0.5 font-mono">
                  <div className="flex items-center space-x-1.5 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>ControlNet SDXL активен на RTX 4050:</span>
                  </div>
                  <div className="pl-5 text-emerald-300/80">
                    • Canny Edge: controlnet-canny-sdxl-1.0 (2.5 GB)<br />
                    • Depth Control: controlnet-depth-sdxl-1.0 (2.5 GB)
                  </div>
                </div>
              </div>
            </div>
        )}

        {/* TAB 2: ARCHITECTURAL MATERIALS & LIGHTING */}
        {inspectorTab === 'materials' && (
          <div className="space-y-4 animate-in fade-in">
            {/* Quick 1-Click Architectural PBR Material Chips */}
            <div className="space-y-2 bg-studio-bg/60 p-3 rounded-xl border border-studio-border">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-studio-cyan uppercase tracking-wider">
                  ⚡ Экспресс-чипы PBR материалов
                </span>
                <span className="text-[10px] text-studio-textSubtle">Клик для вставки в спецификацию</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { name: '🪵 Натуральный Дуб', prompt: 'fronts in natural French oak veneer with visible tactile grain and ultra-matte lacquer finish' },
                  { name: '🏛️ Травертин Навона', prompt: 'countertop and splashback in honed Roman Travertine with natural cavities and warm cream veins' },
                  { name: '⬛ Черный графит', prompt: 'matte powder-coated black architectural steel fixtures and edge profiles' },
                  { name: '🪟 Рифленое стекло', prompt: 'cabinet inserts in fluted textured reeded glass with soft light refraction' },
                  { name: '🏺 Микроцемент', prompt: 'seamless light warm grey microcement plaster finish on back walls' },
                  { name: '🟡 Сатин-латунь', prompt: 'brushed satin champagne brass mixer tap and recessed handle accents' },
                ].map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setCustomMaterials((prev) => (prev ? `${prev}, ${chip.prompt}` : chip.prompt));
                    }}
                    className="p-2 rounded-lg bg-studio-surface border border-studio-border hover:border-studio-cyan text-left text-xs text-zinc-300 hover:text-white transition-all flex items-center justify-between group shadow-sm"
                    title={`Добавить «${chip.name}» в спецификацию`}
                  >
                    <span className="font-medium text-[11px]">{chip.name}</span>
                    <Plus className="w-3.5 h-3.5 text-studio-cyan opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>

            {/* 6. LIGHTING & ATMOSPHERE */}
            <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-studio-textMuted uppercase tracking-wider">
                {t('inspector.lighting')}
              </label>
              <select
                value={lightingId}
                onChange={(e) => setLightingId(e.target.value)}
                className="w-full bg-studio-bg border border-studio-border focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs text-studio-text focus:outline-none"
              >
                {LIGHTING_OPTIONS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {getLightingLabel(l)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-studio-textMuted uppercase tracking-wider">
                {t('inspector.atmosphere')}
              </label>
              <select
                value={atmosphereId}
                onChange={(e) => setAtmosphereId(e.target.value)}
                className="w-full bg-studio-bg border border-studio-border focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs text-studio-text focus:outline-none"
              >
                {ATMOSPHERE_OPTIONS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {getAtmosphereLabel(a)}
                  </option>
                ))}
              </select>
            </div>
          </div>


          {/* 7. MATERIALS SELECTION & REFERENCE SWATCHES */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <label className="text-[11px] font-medium text-studio-textMuted uppercase tracking-wider">
                  {t('inspector.materials')}
                </label>
                {selectedMaterials.length > 0 && (
                  <span className="text-[10px] font-mono text-studio-cyan bg-studio-cyan/15 px-1.5 py-0.2 rounded border border-studio-cyan/30">
                    {selectedMaterials.length}
                  </span>
                )}
              </div>

              {selectedMaterials.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedMaterials([])}
                  className="text-[10px] text-studio-textSubtle hover:text-rose-400 transition-colors"
                >
                  Сбросить
                </button>
              )}
            </div>

            {/* Category Filter Pills & Search */}
            <div className="space-y-1.5">
              <div className="flex items-center space-x-1">
                <input
                  type="text"
                  value={materialSearchQuery}
                  onChange={(e) => setMaterialSearchQuery(e.target.value)}
                  placeholder="Поиск материала (орех, мрамор, латунь, букле)..."
                  className="flex-1 bg-studio-bg border border-studio-border focus:border-indigo-500 rounded-md px-2 py-1 text-[11px] text-studio-text focus:outline-none"
                />
                {materialSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setMaterialSearchQuery('')}
                    className="text-[10px] text-zinc-400 hover:text-white px-1.5 py-1 bg-studio-surface rounded border border-studio-border"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1 text-[10px]">
                {[
                  { id: 'all', label: 'Все (37)' },
                  { id: 'wood', label: '🌳 Дерево' },
                  { id: 'stone', label: '⛰️ Камень' },
                  { id: 'surface', label: '🧱 Поверхности' },
                  { id: 'metal', label: '⚙️ Металл' },
                  { id: 'glass', label: '🪟 Стекло' },
                  { id: 'textile', label: '🧵 Текстиль' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setMaterialCategoryFilter(cat.id as any)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
                      materialCategoryFilter === cat.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-studio-surface border border-studio-border text-studio-textMuted hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Material Items Grid */}
            <div className="flex flex-wrap gap-1 max-h-52 overflow-y-auto pr-1">
              {MATERIAL_OPTIONS.filter((mat) => {
                const matchesCat =
                  materialCategoryFilter === 'all' || mat.category === materialCategoryFilter;
                if (!matchesCat) return false;
                if (!materialSearchQuery.trim()) return true;
                const q = materialSearchQuery.toLowerCase();
                return (
                  mat.labelRu.toLowerCase().includes(q) ||
                  mat.labelUk.toLowerCase().includes(q) ||
                  mat.labelEn.toLowerCase().includes(q)
                );
              }).map((mat) => {
                const isSelected = selectedMaterials.includes(mat.id);
                return (
                  <button
                    key={mat.id}
                    onClick={() => toggleMaterial(mat.id)}
                    className={`px-2 py-1 rounded text-[11px] transition-all border text-left flex items-center space-x-1 ${
                      isSelected
                        ? 'bg-indigo-600/25 border-indigo-500 text-indigo-100 font-medium shadow-sm ring-1 ring-indigo-500/30'
                        : 'bg-studio-surfaceLight border-studio-border/60 text-studio-textMuted hover:text-white hover:border-studio-border'
                    }`}
                  >
                    {isSelected && <span className="text-emerald-400 text-[10px]">✓</span>}
                    <span>{getMaterialLabel(mat)}</span>
                  </button>
                );
              })}
            </div>

            {/* CUSTOM MATERIAL REFERENCES (Images / Swatches, Links, Text) */}
            <div className="pt-2 border-t border-studio-border/60 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-[11px] font-semibold text-white">
                    Референсы материалов
                  </span>
                  {materialReferences.length > 0 && (
                    <span className="text-[9px] font-mono text-indigo-300 bg-indigo-500/20 px-1.5 py-0.2 rounded-full">
                      {materialReferences.length}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsMaterialModalOpen(true)}
                  className="px-2 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-lg text-[10px] font-medium transition-colors flex items-center space-x-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Добавить</span>
                </button>
              </div>

              {/* Reference Cards List */}
              {materialReferences.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setIsMaterialModalOpen(true)}
                  className="w-full p-2.5 rounded-xl border border-dashed border-studio-border hover:border-indigo-500/50 bg-studio-bg/40 text-left transition-colors group cursor-pointer"
                >
                  <p className="text-[11px] text-studio-textMuted group-hover:text-studio-text leading-relaxed">
                    + Прикрепить фото текстуры (мрамор, паркет, ткань), ссылку на каталог или название материала для точного наложения.
                  </p>
                </button>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                  {materialReferences.map((ref) => (
                    <div
                      key={ref.id}
                      className="p-2 rounded-xl bg-studio-bg border border-studio-border flex items-center justify-between gap-2.5 group hover:border-indigo-500/50 transition-colors"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        {ref.imageBase64 ? (
                          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border border-studio-border/60 bg-black">
                            <img
                              src={ref.imageBase64}
                              alt={ref.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-studio-surfaceLight border border-studio-border flex-shrink-0 flex items-center justify-center text-studio-textMuted">
                            {ref.type === 'url' ? (
                              <LinkIcon className="w-4 h-4 text-indigo-400" />
                            ) : (
                              <Type className="w-4 h-4 text-studio-cyan" />
                            )}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                              {ref.targetSurface}
                            </span>
                            {ref.url && (
                              <a
                                href={ref.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-studio-textMuted hover:text-indigo-300"
                                title={ref.url}
                              >
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                          <p className="text-xs font-medium text-white truncate mt-0.5">
                            {ref.name}
                          </p>
                          {ref.notes && (
                            <p className="text-[10px] text-studio-textSubtle truncate">
                              {ref.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveMaterialReference(ref.id)}
                        className="text-studio-textSubtle hover:text-studio-danger p-1 rounded transition-colors"
                        title="Удалить референс"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>


          {/* 7.5 ARCHITECT CUSTOM SPECIFICATIONS (Manual Materials, Style, Lighting, Decor) */}
          <div className="space-y-2 border border-studio-border/70 rounded-xl p-2.5 bg-studio-surfaceLight/60">
            <button
              type="button"
              onClick={() => setShowCustomSpecs(!showCustomSpecs)}
              className="w-full flex items-center justify-between text-left group"
            >
              <div className="flex items-center space-x-2">
                <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[11px] font-semibold text-white tracking-wide uppercase">
                  Спецификация архитектора (Ручной ввод)
                </span>
              </div>
              <div className="flex items-center space-x-1.5">
                {(customMaterials || customStyle || customLighting || customDecor) && (
                  <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    Активно
                  </span>
                )}
                {showCustomSpecs ? (
                  <ChevronUp className="w-3.5 h-3.5 text-studio-textMuted group-hover:text-white" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-studio-textMuted group-hover:text-white" />
                )}
              </div>
            </button>

            {showCustomSpecs && (
              <div className="pt-2 border-t border-studio-border/50 space-y-2.5 animate-fadeIn">
                {/* 1. Custom Materials */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-medium text-studio-textMuted uppercase tracking-wider">
                      🎨 Свои материалы и фактуры:
                    </span>
                    {customMaterials && (
                      <button
                        type="button"
                        onClick={() => setCustomMaterials('')}
                        className="text-studio-textSubtle hover:text-studio-danger text-[9px]"
                      >
                        Очистить
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={customMaterials}
                    onChange={(e) => setCustomMaterials(e.target.value)}
                    placeholder="напр.: фасады — вертикальный шпон дуба, остров — темный керамогранит..."
                    className="w-full bg-studio-bg border border-studio-border focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-studio-textSubtle focus:outline-none transition-colors"
                  />
                </div>

                {/* 2. Custom Style */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-medium text-studio-textMuted uppercase tracking-wider">
                      🏛️ Своя стилистика и концепция:
                    </span>
                    {customStyle && (
                      <button
                        type="button"
                        onClick={() => setCustomStyle('')}
                        className="text-studio-textSubtle hover:text-studio-danger text-[9px]"
                      >
                        Очистить
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={customStyle}
                    onChange={(e) => setCustomStyle(e.target.value)}
                    placeholder="напр.: Japandi с элементами Wabi-Sabi, чистые вертикали, лаконичные объемы..."
                    className="w-full bg-studio-bg border border-studio-border focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-studio-textSubtle focus:outline-none transition-colors"
                  />
                </div>

                {/* 3. Custom Lighting */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-medium text-studio-textMuted uppercase tracking-wider">
                      💡 Световые сценарии и источники:
                    </span>
                    {customLighting && (
                      <button
                        type="button"
                        onClick={() => setCustomLighting('')}
                        className="text-studio-textSubtle hover:text-studio-danger text-[9px]"
                      >
                        Очистить
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={customLighting}
                    onChange={(e) => setCustomLighting(e.target.value)}
                    placeholder="напр.: утреннее солнце сквозь жалюзи, скрытая подсветка 2700K в цоколе, трековый Flos..."
                    className="w-full bg-studio-bg border border-studio-border focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-studio-textSubtle focus:outline-none transition-colors"
                  />
                </div>

                {/* 4. Custom Decor */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-medium text-studio-textMuted uppercase tracking-wider">
                      🏺 Декор, аксессуары и наполнение:
                    </span>
                    {customDecor && (
                      <button
                        type="button"
                        onClick={() => setCustomDecor('')}
                        className="text-studio-textSubtle hover:text-studio-danger text-[9px]"
                      >
                        Очистить
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={customDecor}
                    onChange={(e) => setCustomDecor(e.target.value)}
                    placeholder="напр.: керамическая ваза с сухими ветками, эспрессо-машина, книги по архитектуре..."
                    className="w-full bg-studio-bg border border-studio-border focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-studio-textSubtle focus:outline-none transition-colors"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: SYNTHESIZED FINAL PROMPT */}
      {inspectorTab === 'prompt' && (
        <div className="space-y-4 animate-in fade-in">
          {/* 8. SYNTHESIZED PROMPT */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-studio-textMuted uppercase tracking-wider">
                {t('inspector.promptTitle')}
              </label>
              <button
                type="button"
                onClick={() => setManualPromptOverride(!manualPromptOverride)}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium"
              >
                {manualPromptOverride ? t('inspector.resetAuto') : t('inspector.editManual')}
              </button>
            </div>
            <textarea
              value={fullPrompt}
              onChange={(e) => {
                setFullPrompt(e.target.value);
                setManualPromptOverride(true);
              }}
              rows={5}
              className="w-full bg-studio-bg border border-studio-border focus:border-indigo-500 rounded-lg p-2.5 text-[11px] font-mono text-studio-text focus:outline-none leading-relaxed resize-none"
            />
            <div className="flex items-center justify-between text-[10px] text-zinc-400">
              <span>Символов: {fullPrompt.length}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(fullPrompt);
                }}
                className="text-studio-cyan hover:underline"
              >
                Скопировать промпт
              </button>
            </div>
          </div>


          {/* Negative Prompt Info */}
          <div className="p-3 rounded-xl bg-studio-bg/60 border border-studio-border text-xs space-y-1">
            <span className="text-[10px] uppercase font-mono font-bold text-zinc-400 block">
              Архитектурный фильтр искажений (Negative Prompt):
            </span>
            <p className="text-[10px] text-zinc-500 font-mono leading-relaxed">
              blurry, distorted architecture, floating furniture, warped walls, low quality, artifacts, cartoon, 3d render look
            </p>
          </div>
        </div>
      )}
    </>
  )}
</div>

        {/* Bottom CTA Buttons */}
        <div className="p-4 border-t border-studio-border bg-studio-surface/80 space-y-2">
          {/* Quick 1K Draft Button */}
          {resolution !== '1k' && (
            <button
              onClick={() => handleStartGeneration('1k')}
              disabled={isGenerating || !sourceImage}
              className="w-full py-2 px-3 rounded-lg bg-studio-surfaceHover hover:bg-studio-border border border-amber-500/30 text-amber-300 hover:text-white font-medium text-xs transition-colors flex items-center justify-center space-x-1.5 disabled:opacity-50"
              title={t('cost.quickDraftDesc')}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {t('cost.quickDraftTest')} (~${draft1kCost.toFixed(3)} USD)
              </span>
            </button>
          )}

          {/* Main Generate Button with Live Cost Badge */}
          <button
            onClick={() => handleStartGeneration(resolution)}
            disabled={isGenerating || !sourceImage}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-studio-cyan hover:brightness-110 active:scale-[0.99] disabled:opacity-50 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-between"
          >
            <div className="flex items-center space-x-2">
              {isGenerating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 text-white" />
              )}
              <span>
                {isGenerating ? t('inspector.generatingBtn') : t('inspector.generateBtn')}
              </span>
            </div>

            <span className="font-mono text-[11px] bg-black/30 px-2 py-0.5 rounded-full border border-white/20 text-emerald-300">
              ~${currentCostEstimate.toFixed(3)} USD
            </span>
          </button>

          {!geminiProvider.getApiKey() && activeProviderId === 'google_gemini' && (
            <p className="text-[11px] text-studio-warning text-center">
              {t('inspector.apiKeyNotice')}{' '}
              <button
                onClick={onNavigateSettings}
                className="underline hover:text-white"
              >
                {t('inspector.setupIn1Click')}
              </button>
            </p>
          )}

          {activeProviderId === 'gemini_bridge' && (
            <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-center space-y-1.5">
              <p className="text-xs text-indigo-300 font-semibold">
                🌐 Режим Gemini Bridge (Личный Google Аккаунт)
              </p>
              <p className="text-[10px] text-studio-textMuted leading-relaxed">
                Прямая передача промпта и рендера в официальный веб-интерфейс Gemini без API-ключа.
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* Fullscreen Inspector Modal */}
      {isFullscreen && latestResult && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col p-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10 text-white">
            <span className="font-mono text-xs">
              Полноэкранный просмотр // {latestResult.model} // {latestResult.resolution?.toUpperCase() || '2K'} // Задержка {latestResult.latencyMs} мс
            </span>
            <button
              onClick={() => setIsFullscreen(false)}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-xs"
            >
              Закрыть (Esc)
            </button>
          </div>
          <div className="flex-1 relative mt-2">
            <ImageComparisonSlider
              sourceImage={latestResult.sourceImageBase64 || sourceImage}
              generatedImage={latestResult.outputImageBase64 || ''}
              onExport={() => handleExport('png')}
              onCopy={handleCopy}
            />
          </div>
        </div>
      )}

      {/* Modal for Budget Warnings (Expensive 4K / Exceeded Session Budget) */}
      {warningModal?.isOpen && (
        <BudgetWarningModal
          isOpen={true}
          type={warningModal.type}
          resolution={warningModal.pendingResolution}
          estimatedCost={warningModal.estimatedCost}
          sessionSpend={costSummary.sessionSpend}
          budgetLimit={costSummary.budgetLimit}
          onProceed={() => {
            const res = warningModal.pendingResolution;
            setWarningModal(null);
            executeGeneration(res);
          }}
          onCancel={() => setWarningModal(null)}
          onSwitchToDraft={() => {
            setWarningModal(null);
            setResolution('1k');
            executeGeneration('1k');
          }}
          onDisableWarning={() => {
            costTracker.setWarnOnExpensive(false);
          }}
        />
      )}

      {/* Modal for 402 Billing / Depleted Credits */}
      {showBilling402Modal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-studio-surface border border-studio-danger/40 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-studio-danger/15 border border-studio-danger/30 flex items-center justify-center text-studio-danger">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">
                    {t('billing402.title')}
                  </h3>
                  <span className="text-[11px] text-studio-textMuted font-mono">
                    {t('billing402.subtitle')}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowBilling402Modal(false)}
                className="text-studio-textMuted hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="bg-studio-bg rounded-xl p-4 border border-studio-border text-xs text-studio-textMuted space-y-2.5 leading-relaxed">
              <p>
                <strong className="text-white">{t('billing402.why')}</strong> {t('billing402.p1')}
              </p>
              <p>
                {t('billing402.p2')}
              </p>
              <div className="pt-1 text-[11px] text-studio-cyan bg-studio-cyan/5 p-2 rounded border border-studio-cyan/20">
                {t('billing402.tip')}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 pt-1">
              <button
                onClick={() => {
                  setShowBilling402Modal(false);
                  setActiveProviderId('comfyui_local');
                  providerRegistry.setActiveProvider('comfyui_local');
                  setErrorMsg(null);
                }}
                className="py-2.5 px-3 bg-studio-accent/15 hover:bg-studio-accent/25 text-studio-accent border border-studio-accent/35 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center space-x-1.5"
              >
                <span>{t('studio.switchToComfyUI')}</span>
              </button>

              <a
                href="https://ai.studio/projects"
                target="_blank"
                rel="noreferrer"
                className="py-2.5 px-3 bg-studio-surfaceHover hover:bg-studio-border text-studio-text rounded-xl text-xs font-medium border border-studio-border text-center transition-colors flex items-center justify-center space-x-1.5"
              >
                <span>{t('billing402.openBilling')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>

            </div>
          </div>

        </div>
      )}

      {/* Modal for Adding Material References (Image / URL / Text) */}
      <MaterialReferenceModal
        isOpen={isMaterialModalOpen}
        onClose={() => setIsMaterialModalOpen(false)}
        onAddReference={handleAddMaterialReference}
      />

      {/* AI Upscale Modal (2x / 4x Ultra-HD) */}
      {isUpscaleOpen && (
        <UpscaleModal
          isOpen={isUpscaleOpen}
          onClose={() => setIsUpscaleOpen(false)}
          imageBase64={latestResult?.outputImageBase64 || sourceImage || ''}
          sourceWidth={latestResult?.width || imageMeta?.width || 1344}
          sourceHeight={latestResult?.height || imageMeta?.height || 768}
          promptUsed={latestResult?.prompt || fullPrompt || ''}
          onApplyUpscaledImage={handleApplyUpscaledImage}
        />
      )}
    </div>
  );
};
