import React, { useState, useRef, useEffect } from 'react';
import {
  ExternalLink,
  Copy,
  Check,
  FolderOpen,
  UploadCloud,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  SlidersHorizontal,
  Layers,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Download,
  Eye,
  RefreshCw,
  Camera,
  Sun,
  Palette,
  Maximize2,
  CheckSquare,
  Square,
} from 'lucide-react';
import { Project, ProjectView, ApprovedProjectDesign, ProjectDesignDraft, ProjectDesignVariant, GenerationRecord } from '../types/project';
import { GenerationResult } from '../types/ai';
import { geminiBridgeService } from '../services/ai/GeminiBridgeService';
import {
  ROOM_TYPES,
  INTERIOR_STYLES,
  LIGHTING_OPTIONS,
  ATMOSPHERE_OPTIONS,
  MATERIAL_OPTIONS,
  GEOMETRY_MODES,
  buildArchitecturalPositivePrompt,
  PromptBuildParams
} from '../services/promptBuilder';
import { dbService } from '../services/db';
import { useI18n } from '../i18n/i18nContext';

interface GeminiBridgeViewProps {
  currentProject: Project | null;
  onUpdateProject?: (project: Project) => void;
  onNavigateStudio?: () => void;
}

const STYLE_NAMES: Record<string, { ru: string; uk: string; en: string }> = {
  modern: { ru: 'Современный', uk: 'Сучасний', en: 'Modern' },
  minimalism: { ru: 'Минимализм', uk: 'Мінімалізм', en: 'Minimalism' },
  japandi: { ru: 'Джапанди', uk: 'Джапанді', en: 'Japandi' },
  wabi_sabi: { ru: 'Ваби-саби', uk: 'Вабі-сабі', en: 'Wabi-Sabi' },
  scandinavian: { ru: 'Скандинавский', uk: 'Скандинавський', en: 'Scandinavian' },
  contemporary: { ru: 'Контемпорари', uk: 'Контемпорарі', en: 'Contemporary' },
  neoclassic: { ru: 'Неоклассика', uk: 'Неокласика', en: 'Neoclassic' },
  loft: { ru: 'Лофт', uk: 'Лофт', en: 'Loft' },
  industrial: { ru: 'Индустриальный', uk: 'Індустріальний', en: 'Industrial' },
  art_deco: { ru: 'Арт-деко', uk: 'Арт-деко', en: 'Art Deco' },
  mid_century_modern: { ru: 'Модерн середины века', uk: 'Модерн середини століття', en: 'Mid-Century Modern' },
  mediterranean: { ru: 'Средиземноморский', uk: 'Середземноморський', en: 'Mediterranean' },
  luxury: { ru: 'Тихая роскошь', uk: 'Тиха розкіш', en: 'Quiet Luxury' },
  organic_modern: { ru: 'Органический модерн', uk: 'Органічний модерн', en: 'Organic Modern' },
  brutalism: { ru: 'Брутализм', uk: 'Бруталізм', en: 'Brutalism' },
  high_tech: { ru: 'Хай-тек', uk: 'Хай-тек', en: 'High-Tech' },
  eclectic: { ru: 'Эклектика', uk: 'Еклектика', en: 'Eclectic' },
  transitional: { ru: 'Переходный стиль', uk: 'Перехідний стиль', en: 'Transitional' },
  classic: { ru: 'Классический', uk: 'Класичний', en: 'Classic' },
};

const toImageDataUrl = (image: string, mimeType: string): string => {
  if (/^data:image\/[\w.+-]+;base64,/i.test(image)) return image;
  const cleanBase64 = image.replace(/^data:[^,]+,/, '').replace(/\s/g, '');
  const normalizedMime = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;
  return `data:${normalizedMime};base64,${cleanBase64}`;
};

export const GeminiBridgeView: React.FC<GeminiBridgeViewProps> = ({
  currentProject,
  onUpdateProject,
  onNavigateStudio,
}) => {
  const { t, language } = useI18n();
  const surfaceFields = [
    { id: 'floor', label: t('bridge.surfaceFloor') },
    { id: 'walls', label: t('bridge.surfaceWalls') },
    { id: 'cabinetry', label: t('bridge.surfaceCabinetry') },
    { id: 'countertop', label: t('bridge.surfaceCountertop') },
    { id: 'furniture', label: t('bridge.surfaceFurniture') },
    { id: 'textile', label: t('bridge.surfaceTextile') },
  ] as const;
  // Source Image state (from project or local upload)
  const [sourceImage, setSourceImage] = useState<string | null>(
    currentProject?.sourceImageBase64 || null
  );
  const [sourceMimeType, setSourceMimeType] = useState<string>('image/png');
  const [sourceImageFailed, setSourceImageFailed] = useState(false);
  const [projectViews, setProjectViews] = useState<ProjectView[]>(currentProject?.views || []);
  const [selectedViewId, setSelectedViewId] = useState<string>(currentProject?.views?.[0]?.id || '');
  const [hydratedProjectId, setHydratedProjectId] = useState<string | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const [viewOverrideText, setViewOverrideText] = useState<string>('');
  const [approvedDesign, setApprovedDesign] = useState<ApprovedProjectDesign | undefined>(currentProject?.approvedDesign);
  const [designVariants, setDesignVariants] = useState<ProjectDesignVariant[]>(currentProject?.designVariants || []);

  // Architecture parameters
  const [roomType, setRoomType] = useState<string>(currentProject?.roomType || 'kitchen');
  const [styleId, setStyleId] = useState<string>('modern');
  const [geometryMode, setGeometryMode] = useState<'strict' | 'balanced' | 'creative'>('strict');
  const [lightingId, setLightingId] = useState<string>('morning');
  const [atmosphereId, setAtmosphereId] = useState<string>('warm');
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>(['wood_oak', 'stone_natural']);
  const [surfaceAssignments, setSurfaceAssignments] = useState<NonNullable<ApprovedProjectDesign['surfaceAssignments']>>({});
  const [cameraOptics, setCameraOptics] = useState<string>('tilt_shift_24mm');
  const [activeParamTab, setActiveParamTab] = useState<'architecture' | 'materials' | 'specs' | 'prompt'>('architecture');

  // Custom User Specifications (Manual input)
  const [customMaterials, setCustomMaterials] = useState<string>(
    'фасады — вертикальный шпон натурального дуба, темный керамогранит, матовая сталь'
  );
  const [customStyle, setCustomStyle] = useState<string>('современный минимализм с чистыми линиями');
  const [customLighting, setCustomLighting] = useState<string>('утренний естественный свет из окна, скрытая LED подсветка 3000K, трековые споты');
  const [customDecor, setCustomDecor] = useState<string>('обеденный стол с обитыми бежевой тканью стульями, дизайнерский подвесной светильник');
  const [negativePrompt, setNegativePrompt] = useState<string>(
    'deformed chairs, missing furniture, altered room layout, relocated kitchen island, cartoon, 3d CGI render, wireframe, blurry, distorted geometry, warped perspective, extra furniture, duplicated objects, redesigned kitchen, low quality'
  );

  // Generated Prompt state
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('');
  const [isPromptCustomized, setIsPromptCustomized] = useState<boolean>(false);

  // Copy feedback state
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);
  const [copiedImage, setCopiedImage] = useState<boolean>(false);
  const [tempFileMessage, setTempFileMessage] = useState<string | null>(null);
  const [bridgeMessage, setBridgeMessage] = useState<string | null>(null);
  const [downloadedImage, setDownloadedImage] = useState<{ filePath: string; fileName: string; byteLength: number; targetViewId?: string; targetProjectId?: string } | null>(null);

  // Imported Result state
  const [importedResult, setImportedResult] = useState<GenerationResult | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [sliderPosition, setSliderPosition] = useState<number>(50);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const anglesInputRef = useRef<HTMLInputElement>(null);
  const activeBridgeViewIdRef = useRef<string>(selectedViewId);
  const activeBridgePromptRef = useRef<string>(generatedPrompt);
  const bridgeContextInvalidatedRef = useRef(false);
  const viewSelectionRequestRef = useRef(0);
  const currentProjectRef = useRef(currentProject);
  currentProjectRef.current = currentProject;

  const buildDesignDraft = (): ProjectDesignDraft => ({
    styleId,
    materialIds: [...selectedMaterials],
    surfaceAssignments: { ...surfaceAssignments },
    lightingId,
    atmosphereId,
    roomType,
    geometryMode,
    cameraOptics,
    negativePrompt,
    customStyle,
    customMaterials,
    customLighting,
    customDecor,
    updatedAt: Date.now(),
  });

  useEffect(() => {
    setSourceImageFailed(false);
  }, [sourceImage, selectedViewId]);

  useEffect(() => {
    let views: ProjectView[] = currentProject?.views || [];
    if (!views.length && currentProject?.sourceImageBase64) {
      views = [{
        id: `view-${currentProject.id}-primary`, name: t('bridge.primaryView'),
        sourceImageBase64: currentProject.sourceImageBase64,
        sourceMimeType: 'image/png', sourceImagePath: currentProject.sourceImagePath,
        approved: false, createdAt: currentProject.createdAt, updatedAt: currentProject.updatedAt,
      }];
    }
    setProjectViews(views);
    setApprovedDesign(currentProject?.approvedDesign);
    setDesignVariants(currentProject?.designVariants || []);
    setImportedResult(null);
    setDownloadedImage(null);
    setBridgeMessage(null);
    setDraftSaved(false);
    setViewOverrideText('');
    setIsPromptCustomized(false);
    setGeneratedPrompt('');
    setActiveParamTab('architecture');

    // Each project starts from its own approved design or clean Bridge defaults.
    // Never carry unapproved settings from the previously selected project.
    const design = currentProject?.designDraft || currentProject?.approvedDesign;
    setStyleId(design?.styleId || 'modern');
    setSelectedMaterials(design?.materialIds || ['wood_oak', 'stone_natural']);
    setSurfaceAssignments(design?.surfaceAssignments || {});
    setLightingId(design?.lightingId || 'morning');
    setAtmosphereId(design?.atmosphereId || 'warm');
    setRoomType(design?.roomType || currentProject?.roomType || 'kitchen');
    setGeometryMode(design?.geometryMode || 'strict');
    setCameraOptics(design?.cameraOptics || 'tilt_shift_24mm');
    setNegativePrompt(design?.negativePrompt || 'deformed chairs, missing furniture, altered room layout, relocated kitchen island, cartoon, 3d CGI render, wireframe, blurry, distorted geometry, warped perspective, extra furniture, duplicated objects, redesigned kitchen, low quality');
    setCustomStyle(design?.customStyle || 'современный минимализм с чистыми линиями');
    setCustomMaterials(design?.customMaterials || 'фасады — вертикальный шпон натурального дуба, темный керамогранит, матовая сталь');
    setCustomLighting(design?.customLighting || 'утренний естественный свет из окна, скрытая LED подсветка 3000K, трековые споты');
    setCustomDecor(design?.customDecor || 'обеденный стол с обитыми бежевой тканью стульями, дизайнерский подвесной светильник');

    const first = views[0];
    if (first) {
      setSelectedViewId(first.id);
      activeBridgeViewIdRef.current = first.id;
      setViewOverrideText(first.designOverride || '');
      setSourceImage(first.sourceImageBase64);
      setSourceMimeType(first.sourceMimeType || 'image/png');
    } else {
      setSelectedViewId('');
      activeBridgeViewIdRef.current = '';
      setSourceImage(currentProject?.sourceImageBase64 || null);
      setSourceMimeType('image/png');
    }
    setHydratedProjectId(currentProject?.id || null);
  }, [currentProject?.id]);

  useEffect(() => {
    if (!currentProject || hydratedProjectId !== currentProject.id) return;
    setDraftSaved(false);
    const timer = window.setTimeout(() => {
      const latestProject = currentProjectRef.current;
      if (!latestProject || latestProject.id !== currentProject.id) return;
      const updatedProject: Project = { ...latestProject, designDraft: buildDesignDraft(), updatedAt: Date.now() };
      void dbService.saveProject(updatedProject).then(() => {
        if (currentProjectRef.current?.id === updatedProject.id) {
          setDraftSaved(true);
          onUpdateProject?.(updatedProject);
        }
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [
    currentProject?.id,
    hydratedProjectId,
    styleId,
    selectedMaterials,
    surfaceAssignments,
    lightingId,
    atmosphereId,
    roomType,
    geometryMode,
    cameraOptics,
    negativePrompt,
    customStyle,
    customMaterials,
    customLighting,
    customDecor,
  ]);

  const persistProjectViews = async (views: ProjectView[], design = approvedDesign, variants = designVariants) => {
    setProjectViews(views);
    if (!currentProject) return;
    const storedViews = views.map(({ resultImageBase64: _resultImageBase64, ...view }) => view);
    const storedDesign = design ? (({ masterImageBase64: _masterImageBase64, ...savedDesign }) => savedDesign)(design) : undefined;
    const updatedProject: Project = {
      ...currentProject,
      views: storedViews,
      approvedDesign: storedDesign,
      designDraft: buildDesignDraft(),
      designVariants: variants,
      sourceImageBase64: storedViews[0]?.sourceImageBase64 || currentProject.sourceImageBase64,
      sourceImagePath: storedViews[0]?.sourceImagePath || currentProject.sourceImagePath,
      updatedAt: Date.now(),
    };
    await dbService.saveProject(updatedProject);
    onUpdateProject?.(updatedProject);
  };

  const handleAddAngleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const remaining = Math.max(0, 12 - projectViews.length);
    if (remaining === 0) {
      setBridgeMessage(t('bridge.viewLimitReached'));
      return;
    }
    const additions: ProjectView[] = [];
    for (const file of Array.from(files).slice(0, remaining)) {
      try {
        if (!/\.(png|jpe?g|webp)$/i.test(file.name) || file.size > 50 * 1024 * 1024) throw new Error('invalid-image');
        const data = await geminiBridgeService.processImportedFile(file);
        additions.push({
          id: `view-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name.replace(/\.[^.]+$/, ''),
          sourceImagePath: (file as File & { path?: string }).path,
          sourceImageBase64: data.imageBase64,
          sourceMimeType: data.mimeType,
          approved: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      } catch (error) {
        console.error('Could not add project view:', error);
        setBridgeMessage(t('bridge.invalidImageFile'));
      }
    }
    if (!additions.length) return;
    const updated = [...projectViews, ...additions];
    await persistProjectViews(updated);
    const firstNewView = additions[0];
    setSelectedViewId(firstNewView.id);
    setViewOverrideText('');
    setSourceImage(firstNewView.sourceImageBase64);
    setSourceMimeType(firstNewView.sourceMimeType);
    setImportedResult(null);
  };

  const handleSelectView = async (view: ProjectView) => {
    const requestId = ++viewSelectionRequestRef.current;
    setImportedResult(null);
    setSelectedViewId(view.id);
    setViewOverrideText(view.designOverride || '');
    setSourceImage(view.sourceImageBase64);
    setSourceMimeType(view.sourceMimeType || 'image/png');
    let resultBase64 = view.resultImageBase64;
    let resultMime = view.resultMimeType || 'image/png';
    let resultWidth = view.resultWidth || 1024;
    let resultHeight = view.resultHeight || 768;
    if (!resultBase64 && view.resultGenerationId) {
      const record = await dbService.getGenerationById(view.resultGenerationId);
      if (record?.outputImageBase64) {
        const match = record.outputImageBase64.match(/^data:(image\/[\w+.-]+);base64,/);
        resultMime = match?.[1] || 'image/png';
        resultBase64 = record.outputImageBase64.replace(/^data:image\/[\w+.-]+;base64,/, '');
        resultWidth = record.width;
        resultHeight = record.height;
      }
    }
    if (requestId !== viewSelectionRequestRef.current) return;
    if (resultBase64) {
      const result = geminiBridgeService.createBridgeGenerationResult({
        imageBase64: resultBase64,
        mimeType: resultMime,
        width: resultWidth,
        height: resultHeight,
        promptUsed: generatedPrompt,
      });
      setImportedResult(result);
    } else {
      setImportedResult(null);
    }
  };

  const handleSaveViewOverride = async () => {
    if (!selectedViewId) return;
    await persistProjectViews(projectViews.map((view) => view.id === selectedViewId ? { ...view, designOverride: viewOverrideText.trim() || undefined, updatedAt: Date.now() } : view));
    setBridgeMessage(t('bridge.overrideSaved'));
  };

  const handleApproveDesign = async () => {
    if (!importedResult || !selectedViewId) return;
    const view = projectViews.find((item) => item.id === selectedViewId);
    if (!view) return;
    const decisions = [customStyle, customMaterials, customLighting, customDecor].filter(Boolean).join('\n');
    const design: ApprovedProjectDesign = {
      masterViewId: view.id,
      masterGenerationId: view.resultGenerationId,
      masterImageBase64: importedResult.imageBase64,
      masterMimeType: importedResult.mimeType,
      decisions,
      styleId,
      materialIds: selectedMaterials,
      surfaceAssignments,
      lightingId,
      atmosphereId,
      roomType,
      geometryMode,
      cameraOptics,
      negativePrompt,
      customStyle,
      customMaterials,
      customLighting,
      customDecor,
      approvedAt: Date.now(),
    };
    setApprovedDesign(design);
    await persistProjectViews(projectViews.map((item) => ({ ...item, approved: item.id === view.id })), design);
    setBridgeMessage(t('bridge.masterApproved'));
  };

  const handleSaveDesignVariant = async () => {
    if (!currentProject || !importedResult || !selectedViewId) return;
    const variant: ProjectDesignVariant = {
      id: `variant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: `${t('bridge.designVariant')} ${designVariants.length + 1}`,
      masterViewId: selectedViewId,
      masterGenerationId: importedResult.id,
      masterMimeType: importedResult.mimeType,
      decisions: [customStyle, customMaterials, customLighting, customDecor].filter(Boolean).join('\n'),
      styleId, materialIds: [...selectedMaterials], surfaceAssignments: { ...surfaceAssignments },
      lightingId, atmosphereId, roomType, geometryMode, cameraOptics, negativePrompt,
      customStyle, customMaterials, customLighting, customDecor, approvedAt: Date.now(),
    };
    const updated = [...designVariants, variant];
    setDesignVariants(updated);
    await persistProjectViews(projectViews, approvedDesign, updated);
    setBridgeMessage(t('bridge.variantSaved'));
  };

  const handleApplyDesignVariant = async (variant: ProjectDesignVariant) => {
    setStyleId(variant.styleId || 'modern');
    setSelectedMaterials(variant.materialIds || []);
    setSurfaceAssignments(variant.surfaceAssignments || {});
    setLightingId(variant.lightingId || 'morning');
    setAtmosphereId(variant.atmosphereId || 'warm');
    setCustomStyle(variant.customStyle || '');
    setCustomMaterials(variant.customMaterials || '');
    setCustomLighting(variant.customLighting || '');
    setCustomDecor(variant.customDecor || '');
    setRoomType(variant.roomType || roomType);
    setGeometryMode(variant.geometryMode || 'strict');
    setCameraOptics(variant.cameraOptics || 'tilt_shift_24mm');
    setNegativePrompt(variant.negativePrompt || '');
    setIsPromptCustomized(false);
    const view = projectViews.find((item) => item.id === variant.masterViewId);
    if (view && view.id !== selectedViewId) await handleSelectView(view);
    if (variant.masterGenerationId) {
      const record = await dbService.getGenerationById(variant.masterGenerationId);
      const match = record?.outputImageBase64?.match(/^data:(image\/[\w+.-]+);base64,/);
      if (record?.outputImageBase64) {
        setImportedResult(geminiBridgeService.createBridgeGenerationResult({
          imageBase64: record.outputImageBase64.replace(/^data:image\/[\w+.-]+;base64,/, ''),
          mimeType: match?.[1] || variant.masterMimeType,
          width: record.width, height: record.height, promptUsed: record.prompt,
        }));
      }
    }
    setBridgeMessage(t('bridge.variantRestored', { name: variant.name }));
  };

  const handleCopyMasterImage = async () => {
    if (!approvedDesign) return;
    let image = approvedDesign.masterImageBase64;
    let mimeType = approvedDesign.masterMimeType;
    if (!image && approvedDesign.masterGenerationId) {
      const record = await dbService.getGenerationById(approvedDesign.masterGenerationId);
      const match = record?.outputImageBase64?.match(/^data:(image\/[\w+.-]+);base64,/);
      if (record?.outputImageBase64) {
        image = record.outputImageBase64.replace(/^data:image\/[\w+.-]+;base64,/, '');
        mimeType = match?.[1] || 'image/png';
      }
    }
    if (!image) {
      setBridgeMessage(t('bridge.masterCopyFailed'));
      return;
    }
    const copied = await geminiBridgeService.copyImageToClipboard(image, mimeType);
    setBridgeMessage(copied ? t('bridge.masterCopied') : t('bridge.masterCopyFailed'));
  };

  useEffect(() => {
    if (!window.electronAPI?.onGeminiImageDownloaded) return;
    const savedViewId = sessionStorage.getItem('geminiBridgePendingViewId');
    const savedPrompt = sessionStorage.getItem('geminiBridgePendingPrompt');
    const savedProjectId = sessionStorage.getItem('geminiBridgePendingProjectId');
    const openedAt = Number(sessionStorage.getItem('geminiBridgeOpenedAt') || 0);
    const pendingProjectMatches = !savedProjectId || savedProjectId === currentProject?.id;
    const targetViewExists = pendingProjectMatches && projectViews.some((view) => view.id === savedViewId);
    activeBridgeViewIdRef.current = targetViewExists && savedViewId ? savedViewId : selectedViewId;
    if (pendingProjectMatches && savedPrompt) activeBridgePromptRef.current = savedPrompt;
    if (!pendingProjectMatches) {
      bridgeContextInvalidatedRef.current = true;
      setDownloadedImage(null);
      setBridgeMessage(t('bridge.downloadWrongProject'));
      sessionStorage.removeItem('geminiBridgePendingViewId');
      sessionStorage.removeItem('geminiBridgePendingPrompt');
      sessionStorage.removeItem('geminiBridgePendingProjectId');
      sessionStorage.removeItem('geminiBridgeOpenedAt');
    }
    const unsubscribe = window.electronAPI.onGeminiImageDownloaded((event) => {
      if (bridgeContextInvalidatedRef.current) return;
      const targetViewId = projectViews.some((view) => view.id === activeBridgeViewIdRef.current) ? activeBridgeViewIdRef.current : selectedViewId;
      setDownloadedImage({ ...event, targetViewId, targetProjectId: currentProject?.id });
      setBridgeMessage(event.byteLength > 50 * 1024 * 1024 ? t('bridge.downloadTooLarge') : t('bridge.downloadDetected'));
    });
    void window.electronAPI.listGeminiDownloads().then((result) => {
      if (!result.success || !result.files.length) return;
      const pendingDownload = result.files.find((file) => file.modifiedAt >= openedAt);
      if (pendingDownload && openedAt > 0) {
        const targetViewId = targetViewExists && savedViewId ? savedViewId : selectedViewId;
        if (pendingProjectMatches && !bridgeContextInvalidatedRef.current) {
          setDownloadedImage((current) => current || { ...pendingDownload, targetViewId, targetProjectId: currentProject?.id });
        }
        if (pendingDownload.byteLength > 50 * 1024 * 1024) setBridgeMessage(t('bridge.downloadTooLarge'));
      }
    }).catch(() => {});
    return unsubscribe;
  }, [t, selectedViewId, currentProject?.id, projectViews]);

  const toggleMaterial = (mId: string) => {
    if (selectedMaterials.includes(mId)) {
      setSelectedMaterials(selectedMaterials.filter((id) => id !== mId));
    } else {
      setSelectedMaterials([...selectedMaterials, mId]);
    }
    setIsPromptCustomized(false);
  };

  const setSurfaceMaterial = (surface: keyof NonNullable<ApprovedProjectDesign['surfaceAssignments']>, materialId: string) => {
    setSurfaceAssignments((current) => ({ ...current, [surface]: materialId || undefined }));
    if (materialId && !selectedMaterials.includes(materialId)) setSelectedMaterials((current) => [...current, materialId]);
    setIsPromptCustomized(false);
  };

  // Recalculate prompt when configuration changes
  useEffect(() => {
    if (!isPromptCustomized) {
      const selectedStyle = INTERIOR_STYLES.find((s) => s.id === styleId) || INTERIOR_STYLES[0];
      const params: PromptBuildParams = {
        roomType: roomType as any,
        style: selectedStyle,
        geometryMode: geometryMode,
        lightingId,
        atmosphereId,
        selectedMaterials,
        materialReferences: currentProject?.materialReferences || [],
        customMaterials,
        customStyle,
        customLighting,
        customDecor,
      };

      const basePrompt = buildArchitecturalPositivePrompt(params);
      const surfaceLabels: Record<string, string> = {
        floor: 'Floor', walls: 'Walls', cabinetry: 'Cabinet fronts', countertop: 'Countertops', furniture: 'Furniture', textile: 'Textiles',
      };
      const surfaceMap = Object.entries(surfaceAssignments)
        .filter(([, materialId]) => Boolean(materialId))
        .map(([surface, materialId]) => `${surfaceLabels[surface]} = ${MATERIAL_OPTIONS.find((material) => material.id === materialId)?.promptDescription || materialId}`)
        .join('; ');

      const cameraText = cameraOptics === 'tilt_shift_24mm'
        ? 'Shot on Hasselblad H6D-100c with 24mm f/3.5 tilt-shift architectural lens, perfectly vertical lines, zero optical distortion.'
        : cameraOptics === 'prime_35mm'
        ? 'Shot on Leica SL2 with Summicron 35mm f/2 ASPH architectural prime, natural human eye perspective.'
        : 'Shot on 50mm architectural lens, cinematic eye-level framing.';

      const geometryInstruction = geometryMode === 'strict'
        ? 'CRITICAL ARCHITECTURAL DIRECTIVE: The uploaded image is an exact 3D clay model from Archicad. You MUST PRESERVE 100% of the room geometry: the exact location, dimensions, and arrangement of all kitchen cabinetry, countertops, dining table, chairs, windows, and structural walls. DO NOT change furniture placement, do not invent new objects, and do not rotate the camera viewpoint. Your only role is to apply ultra-photorealistic PBR materials, natural daylight, soft contact shadows, and tactile reflections.'
        : geometryMode === 'balanced'
        ? 'ARCHITECTURAL DIRECTIVE: Maintain the core Archicad layout, kitchen cabinetry, and dining setup strictly aligned with the source render, while infusing luxurious designer textures and atmospheric lighting.'
        : 'CREATIVE DIRECTIVE: Use the source image as an architectural inspiration with stylish modern enhancements.';

      const masterInstruction = approvedDesign && selectedViewId !== approvedDesign.masterViewId
        ? `\n\nThe second attached image is the approved visual reference for this project. Match its overall material character, color palette, lighting mood and decor language where they agree with the current project specification. The current prompt and its locked surface-material map are the source of truth if any detail conflicts with the reference. Apply the same room design to the CURRENT clay view while preserving this view's own camera, perspective, architecture, furniture placement and object proportions. Do not copy the reference image's camera or composition.`
        : '';
      const viewOverride = projectViews.find((view) => view.id === selectedViewId)?.designOverride;
      const surfaceMapInstruction = surfaceMap ? `\n\nLOCKED SURFACE MATERIAL MAP (keep these assignments identical across all camera views): ${surfaceMap}. Do not swap materials between surfaces.` : '';
      const fullPrompt = `${geometryInstruction}\n\n${basePrompt}${surfaceMapInstruction}\n\nCamera Optics: ${cameraText}\n\nNegative Constraints: ${negativePrompt}${masterInstruction}${viewOverride ? `\n\nVIEW-SPECIFIC EXCEPTION: ${viewOverride}` : ''}`;

      setGeneratedPrompt(fullPrompt);
    }
  }, [
    roomType,
    styleId,
    geometryMode,
    lightingId,
    atmosphereId,
    selectedMaterials,
    surfaceAssignments,
    cameraOptics,
    negativePrompt,
    customMaterials,
    customStyle,
    customLighting,
    customDecor,
    isPromptCustomized,
    currentProject,
    approvedDesign,
    selectedViewId,
    projectViews,
  ]);

  // Keep source in sync with current project if available
  useEffect(() => {
    if (currentProject?.sourceImageBase64 && !sourceImage) {
      setSourceImage(currentProject.sourceImageBase64);
      setSourceMimeType('image/png');
    }
  }, [currentProject]);

  const handleCopyPrompt = async () => {
    const success = await geminiBridgeService.copyText(generatedPrompt);
    if (success) {
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2500);
    }
  };

  const handleCopyImage = async () => {
    if (!sourceImage) return;
    const success = await geminiBridgeService.copyImageToClipboard(sourceImage, sourceMimeType);
    if (success) {
      setCopiedImage(true);
      setTimeout(() => setCopiedImage(false), 2500);
    } else {
      // Fallback: prepare file and reveal
      handleOpenTempFile();
    }
  };

  const handleOpenTempFile = async () => {
    if (!sourceImage) return;
    setTempFileMessage(t('bridge.tempPreparing'));
    const ok = await geminiBridgeService.prepareTempFileAndReveal(
      sourceImage,
      `archicad_reference_${Date.now()}.png`,
      sourceMimeType
    );
    if (ok) {
      setTempFileMessage(t('bridge.tempReady'));
      setTimeout(() => setTempFileMessage(null), 5000);
    }
  };

  const handleOpenGemini = async () => {
    bridgeContextInvalidatedRef.current = false;
    activeBridgeViewIdRef.current = selectedViewId;
    activeBridgePromptRef.current = generatedPrompt;
    sessionStorage.setItem('geminiBridgePendingViewId', selectedViewId);
    sessionStorage.setItem('geminiBridgePendingProjectId', currentProject?.id || '');
    sessionStorage.setItem('geminiBridgePendingPrompt', generatedPrompt);
    sessionStorage.setItem('geminiBridgeOpenedAt', String(Date.now()));
    setBridgeMessage(t('bridge.opening'));
    const opened = await geminiBridgeService.openGeminiWeb();
    setBridgeMessage(opened ? t('bridge.windowReady') : t('bridge.openFailed'));
  };

  const handleOpenGeminiExternal = () => {
    bridgeContextInvalidatedRef.current = false;
    activeBridgeViewIdRef.current = selectedViewId;
    activeBridgePromptRef.current = generatedPrompt;
    sessionStorage.setItem('geminiBridgePendingViewId', selectedViewId);
    sessionStorage.setItem('geminiBridgePendingProjectId', currentProject?.id || '');
    sessionStorage.setItem('geminiBridgePendingPrompt', generatedPrompt);
    sessionStorage.setItem('geminiBridgeOpenedAt', String(Date.now()));
    geminiBridgeService.openGeminiExternal();
  };

  const handleImportDownloaded = async () => {
    if (!downloadedImage || !window.electronAPI?.readGeminiDownloadedImage) return;
    if (downloadedImage.targetProjectId && downloadedImage.targetProjectId !== currentProject?.id) {
      setDownloadedImage(null);
      setBridgeMessage(t('bridge.downloadWrongProject'));
      return;
    }
    if (downloadedImage.byteLength > 50 * 1024 * 1024) {
      setBridgeMessage(t('bridge.downloadTooLarge'));
      return;
    }
    const result = await window.electronAPI.readGeminiDownloadedImage(downloadedImage.filePath);
    if (!result.success || !result.base64 || !result.mimeType) {
      setBridgeMessage(result.error || t('bridge.importFailed'));
      return;
    }
    const bytes = Uint8Array.from(atob(result.base64), (char) => char.charCodeAt(0));
    const file = new File([bytes], result.fileName || downloadedImage.fileName, { type: result.mimeType });
    const imported = await processImportedFile(file, result.filePath, downloadedImage.targetViewId || selectedViewId, activeBridgePromptRef.current);
    if (imported) {
      setDownloadedImage(null);
      sessionStorage.removeItem('geminiBridgePendingViewId');
      sessionStorage.removeItem('geminiBridgePendingPrompt');
      sessionStorage.removeItem('geminiBridgePendingProjectId');
      sessionStorage.removeItem('geminiBridgeOpenedAt');
      setBridgeMessage(t('bridge.imported'));
    } else {
      setBridgeMessage(t('bridge.importFailed'));
    }
  };

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processImportedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processImportedFile(e.target.files[0]);
    }
  };

  const handleSourceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (!/\.(png|jpe?g|webp)$/i.test(file.name) || file.size > 50 * 1024 * 1024) {
        setBridgeMessage(t('bridge.invalidImageFile'));
        e.target.value = '';
        return;
      }
      const fileData = await geminiBridgeService.processImportedFile(file);
      const now = Date.now();
      const active = projectViews.find((view) => view.id === selectedViewId);
      const nextView: ProjectView = {
        id: active?.id || `view-${now}`,
        name: active?.name || file.name.replace(/\.[^.]+$/, ''),
        sourceImagePath: (file as File & { path?: string }).path,
        sourceImageBase64: fileData.imageBase64,
        sourceMimeType: fileData.mimeType,
        approved: active?.approved || false,
        createdAt: active?.createdAt || now,
        updatedAt: now,
      };
      const updated = active ? projectViews.map((view) => view.id === active.id ? nextView : view) : [...projectViews, nextView];
      setSelectedViewId(nextView.id);
      setViewOverrideText(nextView.designOverride || '');
      setSourceImage(fileData.imageBase64);
      setSourceMimeType(fileData.mimeType);
      await persistProjectViews(updated);
      setImportedResult(null);
    }
    e.target.value = '';
  };

  const processImportedFile = async (file: File, savedPath?: string, targetViewId = selectedViewId, promptUsed = generatedPrompt): Promise<boolean> => {
    try {
      if (file.size > 50 * 1024 * 1024 || !/\.(png|jpe?g|webp)$/i.test(file.name)) throw new Error('invalid-image');
      const data = await geminiBridgeService.processImportedFile(file);
      const newResult = geminiBridgeService.createBridgeGenerationResult({
        imageBase64: data.imageBase64,
        mimeType: data.mimeType,
        width: data.width,
        height: data.height,
        promptUsed,
        resolution: Math.max(data.width, data.height) >= 3000 ? '4k' : Math.max(data.width, data.height) >= 1800 ? '2k' : '1k',
      });

      setImportedResult(newResult);

      // Save generation record to SQLite / local database
      const targetView = projectViews.find((view) => view.id === targetViewId);
      const genRecord: GenerationRecord = {
        id: newResult.id,
        projectId: currentProject?.id || 'default_project',
        viewId: targetViewId || undefined,
        sourceImagePath: targetView?.sourceImagePath || currentProject?.sourceImagePath || 'archicad_reference.png',
        sourceImageBase64: targetView?.sourceImageBase64 || sourceImage || '',
        outputImagePath: savedPath || file.name,
        outputImageBase64: `data:${newResult.mimeType};base64,${newResult.imageBase64}`,
        prompt: promptUsed,
        styleId,
        roomType: roomType as any,
        geometryMode: 'strict',
        lighting: lightingId,
        materials: selectedMaterials,
        atmosphere: atmosphereId,
        provider: 'gemini_bridge',
        model: 'gemini-web-personal',
        width: newResult.width,
        height: newResult.height,
        latencyMs: 0,
        createdAt: Date.now(),
        resolution: newResult.resolution,
        costUsd: 0.0,
      };
      await dbService.saveGeneration(genRecord);

      const activeView = targetView;
      if (activeView) {
        setSelectedViewId(activeView.id);
        setSourceImage(activeView.sourceImageBase64);
        setSourceMimeType(activeView.sourceMimeType || 'image/png');
        await persistProjectViews(projectViews.map((view) => view.id === activeView.id ? {
          ...view,
          resultImageBase64: newResult.imageBase64,
          resultMimeType: newResult.mimeType,
          resultWidth: newResult.width,
          resultHeight: newResult.height,
          resultGenerationId: newResult.id,
          updatedAt: Date.now(),
        } : view));
      }

      // Update project state if present
      if (currentProject && onUpdateProject) {
        onUpdateProject({
          ...currentProject,
          updatedAt: Date.now(),
        });
      }
      return true;
    } catch (err) {
      console.error('Failed to import Gemini result:', err);
      setBridgeMessage(t('bridge.invalidImageFile'));
      return false;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-studio-bg overflow-hidden text-studio-text select-none">
      {/* 1. Header Banner */}
      <div className="h-14 border-b border-studio-border bg-studio-surface px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-1.5 bg-indigo-500/15 border border-indigo-500/30 rounded-lg">
            <Sparkles className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-semibold tracking-wide text-white uppercase">
                Gemini Bridge
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                {t('bridge.accountLimits')}
              </span>
            </div>
            <p className="text-[11px] text-studio-textSubtle">
              {t('bridge.tagline')}
            </p>
          </div>
        </div>

        {/* Security & Privacy Badge */}
        <div className="flex items-center space-x-2 text-[11px] bg-studio-surfaceLight px-3 py-1.5 rounded-lg border border-studio-border/70 text-studio-textMuted">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>{t('bridge.security')}</span>
        </div>
      </div>

      {/* 2. Main 3-Column Handoff Workspace */}
      <div className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
        {/* LEFT COLUMN: Source Archicad Model & Handoff Actions (3 cols) */}
        <div className="col-span-3 flex flex-col space-y-3 bg-studio-surface border border-studio-border rounded-xl p-3.5 overflow-y-auto">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white tracking-wide uppercase">
              {t('bridge.sourceTitle')} (Archicad)
            </span>
            <button
              onClick={() => sourceInputRef.current?.click()}
              className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium"
            >
              {t('bridge.replaceFile')}
            </button>
            <input
              type="file"
              ref={sourceInputRef}
              onChange={handleSourceUpload}
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
            />
          </div>

          {/* Source Image Canvas / Box */}
          <div className="relative aspect-video rounded-lg overflow-hidden bg-studio-bg border border-studio-border flex items-center justify-center group">
            {sourceImage && !sourceImageFailed ? (
              <img
                src={toImageDataUrl(sourceImage, sourceMimeType)}
                alt={t('bridge.sourceImageAlt')}
                className="w-full h-full object-contain"
                onError={() => setSourceImageFailed(true)}
              />
            ) : (
              <div
                onClick={() => sourceInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-4 text-center cursor-pointer hover:text-indigo-400"
              >
                <UploadCloud className="w-8 h-8 text-studio-textSubtle mb-2" />
                <span className="text-xs font-medium">{sourceImageFailed ? t('bridge.sourceImageLoadFailed') : t('bridge.uploadClay')}</span>
                <span className="text-[10px] text-studio-textSubtle mt-1">{t('bridge.imageFormats')}</span>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-studio-border bg-studio-bg/60 p-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-studio-textMuted">{t('bridge.projectAngles')} ({projectViews.length})</span>
              <div className="flex items-center gap-2">
                {currentProject && hydratedProjectId === currentProject.id && (draftSaved ? <span className="inline-flex items-center gap-1 text-[9px] text-emerald-300"><Check className="w-3 h-3" />{t('bridge.draftAutoSaved')}</span> : <span className="text-[9px] text-studio-textSubtle">{t('bridge.draftSaving')}</span>)}
                <button onClick={() => anglesInputRef.current?.click()} className="text-[10px] text-indigo-300 hover:text-white">+ {t('bridge.addAngles')}</button>
              </div>
              <input ref={anglesInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={(event) => { void handleAddAngleFiles(event.target.files); event.target.value = ''; }} />
            </div>
            {projectViews.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {projectViews.map((view, index) => (
                  <button key={view.id} onClick={() => handleSelectView(view)} title={t(view.approved && approvedDesign?.masterViewId === view.id ? 'bridge.viewStatusMaster' : view.resultGenerationId || view.resultImageBase64 ? 'bridge.viewStatusResult' : 'bridge.viewStatusSource')} className={`inline-flex items-center gap-1.5 text-[10px] rounded-md px-2 py-1 border ${selectedViewId === view.id ? 'border-indigo-400 bg-indigo-500/20 text-white' : 'border-studio-border bg-studio-surface text-studio-textMuted'}`}>
                    <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full shrink-0 ${view.approved && approvedDesign?.masterViewId === view.id ? 'bg-emerald-400' : view.resultGenerationId || view.resultImageBase64 ? 'bg-sky-400' : 'bg-studio-textSubtle'}`} />
                    <span>{index + 1}. {view.name}</span>
                  </button>
                ))}
              </div>
            ) : <div className="text-[10px] text-studio-textSubtle">{t('bridge.addAnglesHint')}</div>}
            {projectViews.length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-studio-textSubtle" aria-label={t('bridge.viewStatusLegend')}>
                <span className="inline-flex items-center gap-1"><i aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-studio-textSubtle" />{t('bridge.viewStatusSource')}</span>
                <span className="inline-flex items-center gap-1"><i aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-sky-400" />{t('bridge.viewStatusResult')}</span>
                <span className="inline-flex items-center gap-1"><i aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{t('bridge.viewStatusMaster')}</span>
              </div>
            )}
            {approvedDesign && (
              <div className="flex items-center justify-between gap-1 border-t border-studio-border pt-2">
                <span className="text-[10px] text-emerald-300">{t('bridge.masterAvailable')}</span>
                <button onClick={handleCopyMasterImage} className="text-[10px] text-indigo-300 hover:text-white">{t('bridge.copyMasterImage')}</button>
              </div>
            )}
            {approvedDesign && selectedViewId !== approvedDesign.masterViewId && (
              <div className="space-y-1.5 border-t border-studio-border pt-2">
                <textarea value={viewOverrideText} onChange={(event) => setViewOverrideText(event.target.value)} rows={2} placeholder={t('bridge.viewOverridePlaceholder')} className="w-full resize-y rounded-md border border-studio-border bg-studio-surface px-2 py-1.5 text-[10px] text-white placeholder:text-studio-textSubtle" />
                <button onClick={handleSaveViewOverride} className="text-[10px] text-indigo-300 hover:text-white">{t('bridge.saveViewOverride')}</button>
              </div>
            )}
            {designVariants.length > 0 && (
              <div className="border-t border-studio-border pt-2 space-y-1">
                <span className="text-[10px] font-semibold text-studio-textMuted">{t('bridge.savedVariants')} ({designVariants.length})</span>
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                  {designVariants.map((variant) => (
                    <button key={variant.id} onClick={() => { void handleApplyDesignVariant(variant); }} className="text-[10px] rounded-md px-2 py-1 border border-amber-500/40 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20">{variant.name}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick Handoff Buttons for Image */}
          <div className="space-y-2 pt-1">
            <button
              onClick={handleCopyImage}
              disabled={!sourceImage || sourceImageFailed}
              className={`w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all shadow-sm ${
                copiedImage
                  ? 'bg-emerald-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50'
              }`}
            >
              {copiedImage ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>{t('bridge.copiedImage')}</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>{t('bridge.copyImage')}</span>
                </>
              )}
            </button>

            <button
              onClick={handleOpenTempFile}
              disabled={!sourceImage || sourceImageFailed}
              className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-lg bg-studio-surfaceLight hover:bg-studio-surfaceHover border border-studio-border text-xs font-medium text-studio-textMuted hover:text-white transition-all disabled:opacity-50"
            >
              <FolderOpen className="w-4 h-4 text-studio-textSubtle" />
              <span>{t('bridge.revealFile')}</span>
            </button>

            {tempFileMessage && (
              <div className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2 rounded text-center">
                {tempFileMessage}
              </div>
            )}
          </div>

          {/* Launch Gemini Button */}
          <div className="pt-2 border-t border-studio-border/60">
            <button
              onClick={handleOpenGemini}
              disabled={!sourceImage || sourceImageFailed}
              title={!sourceImage || sourceImageFailed ? t('bridge.sourceRequired') : undefined}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 active:scale-[0.98]"
            >
              <ExternalLink className="w-4 h-4" />
                <span>{t('bridge.openEmbedded')}</span>
            </button>
            <button onClick={handleOpenGeminiExternal} disabled={!sourceImage || sourceImageFailed} title={!sourceImage || sourceImageFailed ? t('bridge.sourceRequired') : undefined} className="w-full mt-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-lg bg-studio-surfaceLight hover:bg-studio-surfaceHover disabled:opacity-50 disabled:cursor-not-allowed border border-studio-border text-[11px] font-medium text-studio-textMuted hover:text-white">
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{t('bridge.openExternal')}</span>
            </button>
            {(!sourceImage || sourceImageFailed) && <div className="text-[10px] text-center text-amber-300">{t('bridge.sourceRequired')}</div>}
            {bridgeMessage && <div className="text-[10px] text-center text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-lg">{bridgeMessage}</div>}
            <span className="block text-[10px] text-center text-studio-textSubtle mt-1.5">
              {t('bridge.openHint')}
            </span>
          </div>

          {downloadedImage && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 space-y-2">
              <div className="text-[10px] text-emerald-200 break-all">{t('bridge.downloadReady')}: {downloadedImage.fileName} ({(downloadedImage.byteLength / 1024 / 1024).toFixed(1)} MB)</div>
              <button disabled={downloadedImage.byteLength > 50 * 1024 * 1024} onClick={handleImportDownloaded} className="w-full rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11px] font-semibold py-2">{t('bridge.importDownloaded')}</button>
              {downloadedImage.byteLength > 50 * 1024 * 1024 && <div className="text-[10px] text-amber-300">{t('bridge.downloadTooLarge')}</div>}
            </div>
          )}

          {/* Step checklist guide */}
          <div className="mt-auto bg-studio-surfaceLight/60 border border-studio-border/70 rounded-lg p-2.5 space-y-1.5 text-[11px]">
            <span className="font-semibold text-white block mb-1">{t('bridge.stepsTitle')}:</span>
            <div className="flex items-start space-x-1.5 text-studio-textMuted">
              <span className="font-mono text-indigo-400 font-bold">1.</span>
              <span>{t('bridge.stepCopy')}</span>
            </div>
            <div className="flex items-start space-x-1.5 text-studio-textMuted">
              <span className="font-mono text-indigo-400 font-bold">2.</span>
              <span>{t('bridge.stepOpen')}</span>
            </div>
            <div className="flex items-start space-x-1.5 text-studio-textMuted">
              <span className="font-mono text-indigo-400 font-bold">3.</span>
              <span>{approvedDesign ? t('bridge.stepPasteWithMaster') : t('bridge.stepPaste')}</span>
            </div>
            <div className="flex items-start space-x-1.5 text-studio-textMuted">
              <span className="font-mono text-indigo-400 font-bold">4.</span>
              <span>{t('bridge.stepPrompt')}</span>
            </div>
            <div className="flex items-start space-x-1.5 text-studio-textMuted">
              <span className="font-mono text-indigo-400 font-bold">5.</span>
              <span>{t('bridge.stepDownload')}</span>
            </div>
          </div>
        </div>

        {/* CENTER COLUMN: Architectural Parameters & Prompt Builder (5 cols) */}
        <div className="col-span-5 flex flex-col space-y-3 bg-studio-surface border border-studio-border rounded-xl p-3.5 overflow-hidden">
          {/* Header with Copy & Controls */}
          <div className="flex items-center gap-2 shrink-0 min-w-0">
            <div className="grid grid-cols-4 flex-1 min-w-0 items-center gap-0.5 bg-studio-bg p-1 rounded-lg border border-studio-border text-xs">
              <button
                onClick={() => setActiveParamTab('architecture')}
                  className={`min-w-0 whitespace-nowrap px-1.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                  activeParamTab === 'architecture'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-studio-textMuted hover:text-white'
                }`}
              >
                {t('bridge.tabArchitecture')}
              </button>
              <button
                onClick={() => setActiveParamTab('materials')}
                  className={`min-w-0 whitespace-nowrap px-1.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                  activeParamTab === 'materials'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-studio-textMuted hover:text-white'
                }`}
              >
                {t('bridge.tabMaterials', { count: selectedMaterials.length })}
              </button>
              <button
                onClick={() => setActiveParamTab('specs')}
                  className={`min-w-0 whitespace-nowrap px-1.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                  activeParamTab === 'specs'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-studio-textMuted hover:text-white'
                }`}
              >
                {t('bridge.tabSpecs')}
              </button>
              <button
                onClick={() => setActiveParamTab('prompt')}
                  className={`min-w-0 whitespace-nowrap px-1.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                  activeParamTab === 'prompt'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-studio-textMuted hover:text-white'
                }`}
              >
                {t('bridge.tabPrompt')}
              </button>
            </div>

            <button
              onClick={handleCopyPrompt}
              className={`shrink-0 flex items-center space-x-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all shadow-sm ${
                copiedPrompt
                  ? 'bg-emerald-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-[0.98]'
              }`}
            >
              {copiedPrompt ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span>{t('bridge.copied')}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>{t('bridge.copy')}</span>
                </>
              )}
            </button>
          </div>

          {/* TAB 1: Architecture & Style & Geometry Mode */}
          {activeParamTab === 'architecture' && (
            <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 text-xs">
              {/* Geometry Preservation Mode */}
              <div className="space-y-1.5 bg-studio-bg/60 border border-studio-border p-2.5 rounded-xl">
                <span className="text-[11px] font-bold text-white uppercase tracking-wider block">
                  {t('bridge.geometryModeTitle')}
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => { setGeometryMode('strict'); setIsPromptCustomized(false); }}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      geometryMode === 'strict'
                        ? 'border-emerald-500 bg-emerald-500/15 text-white shadow-sm'
                        : 'border-studio-border bg-studio-surface text-studio-textMuted hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-[11px] text-emerald-400">
                      <span>MODE 1</span>
                      <span className="text-[9px] bg-emerald-500/20 px-1.5 py-0.5 rounded">{t('bridge.strictScore')}</span>
                    </div>
                    <div className="font-semibold text-white mt-0.5">{t('bridge.strictName')}</div>
                    <p className="text-[10px] text-zinc-400 mt-1 leading-tight">
                      {t('bridge.strictDesc')}
                    </p>
                  </button>

                  <button
                    onClick={() => { setGeometryMode('balanced'); setIsPromptCustomized(false); }}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      geometryMode === 'balanced'
                        ? 'border-indigo-500 bg-indigo-500/15 text-white shadow-sm'
                        : 'border-studio-border bg-studio-surface text-studio-textMuted hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-[11px] text-indigo-400">
                      <span>MODE 2</span>
                      <span className="text-[9px] bg-indigo-500/20 px-1.5 py-0.5 rounded">{t('bridge.balancedScore')}</span>
                    </div>
                    <div className="font-semibold text-white mt-0.5">{t('bridge.balancedName')}</div>
                    <p className="text-[10px] text-zinc-400 mt-1 leading-tight">
                      {t('bridge.balancedDesc')}
                    </p>
                  </button>

                  <button
                    onClick={() => { setGeometryMode('creative'); setIsPromptCustomized(false); }}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      geometryMode === 'creative'
                        ? 'border-amber-500 bg-amber-500/15 text-white shadow-sm'
                        : 'border-studio-border bg-studio-surface text-studio-textMuted hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-[11px] text-amber-400">
                      <span>MODE 3</span>
                      <span className="text-[9px] bg-amber-500/20 px-1.5 py-0.5 rounded">{t('bridge.creativeScore')}</span>
                    </div>
                    <div className="font-semibold text-white mt-0.5">{t('bridge.creativeName')}</div>
                    <p className="text-[10px] text-zinc-400 mt-1 leading-tight">
                      {t('bridge.creativeDesc')}
                    </p>
                  </button>
                </div>
              </div>

              {/* Room Type Selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-white">
                  {t('bridge.roomType')}
                </label>
                <select
                  value={roomType}
                  onChange={(e) => { setRoomType(e.target.value); setIsPromptCustomized(false); }}
                  className="w-full bg-studio-bg border border-studio-border focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                >
                  {ROOM_TYPES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {language === 'uk' ? r.labelUk : language === 'en' ? r.labelEn : r.labelRu}
                    </option>
                  ))}
                </select>
              </div>

              {/* Interior Style Grid */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-white">
                  {t('bridge.interiorStyle')}
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {INTERIOR_STYLES.map((st) => {
                    const isSelected = styleId === st.id;
                    return (
                      <button
                        key={st.id}
                        onClick={() => { setStyleId(st.id); setIsPromptCustomized(false); }}
                        className={`p-2 rounded-lg border text-left flex items-start space-x-2 transition-all ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-500/20 text-white font-semibold'
                            : 'border-studio-border bg-studio-bg text-studio-textMuted hover:text-white'
                        }`}
                      >
                        <div
                          className="w-3.5 h-3.5 rounded-full shrink-0 mt-0.5"
                          style={{ backgroundColor: st.previewColor || '#6366f1' }}
                        />
                        <div className="truncate">
                          <div className="text-xs truncate">{STYLE_NAMES[st.id]?.[language] || st.name}</div>
                          <div className="text-[9px] text-zinc-400 truncate opacity-80">{language === 'uk' ? st.descriptionUk : language === 'en' ? st.descriptionEn : st.descriptionRu}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Lighting & Atmosphere Selectors */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-studio-textMuted">
                    💡 {t('bridge.lighting')}
                  </label>
                  <select
                    value={lightingId}
                    onChange={(e) => { setLightingId(e.target.value); setIsPromptCustomized(false); }}
                    className="w-full bg-studio-bg border border-studio-border focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  >
                    {LIGHTING_OPTIONS.map((l) => (
                      <option key={l.id} value={l.id}>
                        {language === 'uk' ? l.labelUk : language === 'en' ? l.labelEn : l.labelRu}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-studio-textMuted">
                    ✨ {t('bridge.atmosphere')}
                  </label>
                  <select
                    value={atmosphereId}
                    onChange={(e) => { setAtmosphereId(e.target.value); setIsPromptCustomized(false); }}
                    className="w-full bg-studio-bg border border-studio-border focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  >
                    {ATMOSPHERE_OPTIONS.map((a) => (
                      <option key={a.id} value={a.id}>
                        {language === 'uk' ? a.labelUk : language === 'en' ? a.labelEn : a.labelRu}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Materials Palette Chips */}
          {activeParamTab === 'materials' && (
            <div className="flex-1 min-h-0 flex flex-col space-y-3 pr-1 text-xs overflow-hidden">
              <div className="flex items-center justify-between pb-1 border-b border-studio-border/60 shrink-0">
                <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                  {t('bridge.materialPalette')}
                </span>
                <span className="text-[10px] text-indigo-400">
                  {t('bridge.selectedCount', { count: selectedMaterials.length })}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 content-start auto-rows-max">
                {MATERIAL_OPTIONS.map((mat) => {
                  const isChecked = selectedMaterials.includes(mat.id);
                  return (
                    <button
                      key={mat.id}
                      onClick={() => toggleMaterial(mat.id)}
                      className={`min-w-0 p-2.5 rounded-lg border text-left flex items-start space-x-2.5 transition-all ${
                        isChecked
                          ? 'border-indigo-500 bg-indigo-500/15 text-white'
                          : 'border-studio-border bg-studio-bg text-studio-textMuted hover:text-white'
                      }`}
                    >
                      <div className="shrink-0 mt-0.5">
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-indigo-400" />
                        ) : (
                          <Square className="w-4 h-4 text-zinc-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-xs text-white whitespace-normal break-words leading-snug">{language === 'uk' ? mat.labelUk : language === 'en' ? mat.labelEn : mat.labelRu}</div>
                        <div className="text-[10px] text-zinc-400 whitespace-normal break-words leading-snug opacity-80 mt-0.5">{mat.promptDescription}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: Architect's Custom Manual Specifications & Camera Optics */}
          {activeParamTab === 'specs' && (
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {/* Camera Optics */}
              <div className="space-y-1.5 bg-studio-bg/60 border border-studio-border p-2.5 rounded-xl">
                <div className="flex items-center space-x-1.5 font-semibold text-white text-[11px]">
                  <Camera className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{t('bridge.cameraOptics')}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => { setCameraOptics('tilt_shift_24mm'); setIsPromptCustomized(false); }}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      cameraOptics === 'tilt_shift_24mm'
                        ? 'border-indigo-500 bg-indigo-500/20 text-white'
                        : 'border-studio-border bg-studio-surface text-studio-textMuted hover:text-white'
                    }`}
                  >
                    <div className="font-bold text-[11px]">24mm Tilt-Shift</div>
                    <div className="text-[9px] text-zinc-400 mt-0.5">{t('bridge.opticsTiltShift')}</div>
                  </button>

                  <button
                    onClick={() => { setCameraOptics('prime_35mm'); setIsPromptCustomized(false); }}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      cameraOptics === 'prime_35mm'
                        ? 'border-indigo-500 bg-indigo-500/20 text-white'
                        : 'border-studio-border bg-studio-surface text-studio-textMuted hover:text-white'
                    }`}
                  >
                    <div className="font-bold text-[11px]">35mm Prime</div>
                    <div className="text-[9px] text-zinc-400 mt-0.5">{t('bridge.opticsPrime')}</div>
                  </button>

                  <button
                    onClick={() => { setCameraOptics('50mm'); setIsPromptCustomized(false); }}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      cameraOptics === '50mm'
                        ? 'border-indigo-500 bg-indigo-500/20 text-white'
                        : 'border-studio-border bg-studio-surface text-studio-textMuted hover:text-white'
                    }`}
                  >
                    <div className="font-bold text-[11px]">50mm Lens</div>
                    <div className="text-[9px] text-zinc-400 mt-0.5">{t('bridge.opticsCinematic')}</div>
                  </button>
                </div>
              </div>

              {/* Architect's Custom Manual Specifications */}
              <div className="space-y-2 bg-studio-surfaceLight/80 border border-studio-border rounded-xl p-3">
                <span className="text-[11px] font-semibold text-indigo-300 block">
                  {t('bridge.manualInputs')}
                </span>

                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-studio-textMuted uppercase tracking-wider block">
                    🎨 {t('bridge.customMaterials')}
                  </label>
                  <input
                    type="text"
                    value={customMaterials}
                    onChange={(e) => {
                      setCustomMaterials(e.target.value);
                      setIsPromptCustomized(false);
                    }}
                    placeholder={t('bridge.customMaterialsPlaceholder')}
                    className="w-full bg-studio-bg border border-studio-border rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-studio-textSubtle focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-2 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-2.5">
                  <div>
                    <span className="text-[10px] font-semibold text-indigo-200 block">{t('bridge.surfaceMapTitle')}</span>
                    <span className="text-[9px] leading-tight text-studio-textSubtle">{t('bridge.surfaceMapDesc')}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {surfaceFields.map((surface) => (
                      <label key={surface.id} className="min-w-0 space-y-1">
                        <span className="text-[9px] text-studio-textMuted">{surface.label}</span>
                        <select
                          value={surfaceAssignments[surface.id] || ''}
                          onChange={(event) => setSurfaceMaterial(surface.id, event.target.value)}
                          className="w-full min-w-0 bg-studio-bg border border-studio-border rounded-md px-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-indigo-500"
                        >
                          <option value="">{t('bridge.surfaceUnassigned')}</option>
                          {MATERIAL_OPTIONS.map((material) => (
                            <option key={material.id} value={material.id}>{language === 'uk' ? material.labelUk : language === 'en' ? material.labelEn : material.labelRu}</option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-studio-textMuted uppercase tracking-wider block">
                    💡 {t('bridge.customLighting')}
                  </label>
                  <input
                    type="text"
                    value={customLighting}
                    onChange={(e) => {
                      setCustomLighting(e.target.value);
                      setIsPromptCustomized(false);
                    }}
                    placeholder={t('bridge.customLightingPlaceholder')}
                    className="w-full bg-studio-bg border border-studio-border rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-studio-textSubtle focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-studio-textMuted uppercase tracking-wider block">
                    🏺 {t('bridge.customDecor')}
                  </label>
                  <input
                    type="text"
                    value={customDecor}
                    onChange={(e) => {
                      setCustomDecor(e.target.value);
                      setIsPromptCustomized(false);
                    }}
                    placeholder={t('bridge.customDecorPlaceholder')}
                    className="w-full bg-studio-bg border border-studio-border rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-studio-textSubtle focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Negative Prompt */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-studio-textMuted uppercase tracking-wider block">
                  🚫 {t('bridge.negativePrompt')}
                </label>
                <textarea
                  value={negativePrompt}
                  onChange={(e) => { setNegativePrompt(e.target.value); setIsPromptCustomized(false); }}
                  rows={2}
                  className="w-full bg-studio-bg border border-studio-border rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-300 focus:outline-none focus:border-indigo-500 resize-none font-mono"
                />
              </div>
            </div>
          )}

          {/* TAB 4: Final Prompt Display / Full Editor */}
          {activeParamTab === 'prompt' && (
            <div className="flex-1 flex flex-col space-y-2 overflow-hidden text-xs">
              <div className="flex items-center justify-between text-[11px] text-studio-textMuted">
                <span>{t('bridge.finalPrompt')}</span>
                <button
                  onClick={() => setIsPromptCustomized(false)}
                  className="flex items-center space-x-1 text-indigo-400 hover:text-indigo-300 text-[10px]"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>{t('bridge.regeneratePrompt')}</span>
                </button>
              </div>

              <textarea
                value={generatedPrompt}
                onChange={(e) => {
                  setGeneratedPrompt(e.target.value);
                  setIsPromptCustomized(true);
                }}
                className="w-full flex-1 bg-studio-bg border border-studio-border rounded-xl p-3 text-xs text-studio-text font-mono leading-relaxed resize-none focus:outline-none focus:border-indigo-500 select-text"
              />
            </div>
          )}

          {/* Mini Prompt Preview Bar when on other tabs */}
          {activeParamTab !== 'prompt' && (
            <div className="mt-auto shrink-0 bg-studio-bg/90 border border-studio-border rounded-xl p-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-studio-textMuted">
                <span className="font-semibold text-white">{t('bridge.promptPreview')}</span>
                <button
                  onClick={() => setActiveParamTab('prompt')}
                  className="text-indigo-400 hover:underline flex items-center space-x-1"
                >
                  <span>{t('bridge.expandEditor')}</span>
                  <Maximize2 className="w-2.5 h-2.5" />
                </button>
              </div>
              <p className="text-[11px] font-mono text-zinc-300 line-clamp-2 leading-tight opacity-90 select-text">
                {generatedPrompt}
              </p>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Import Result & Before/After Comparison (4 cols) */}
        <div className="col-span-4 flex flex-col space-y-3 bg-studio-surface border border-studio-border rounded-xl p-3.5 overflow-y-auto">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white tracking-wide uppercase">
              {t('bridge.resultTitle')}
            </span>
            {importedResult && (
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                {t('bridge.projectLinked')}
              </span>
            )}
          </div>

          {/* Import Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 ${
              isDragging
                ? 'border-indigo-500 bg-indigo-500/10'
                : 'border-studio-border hover:border-studio-borderHover bg-studio-surfaceLight/50'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              accept="image/*"
              className="hidden"
            />
            <div className="p-2.5 rounded-full bg-indigo-500/10 text-indigo-400">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
                <span className="text-xs font-semibold text-white block">{t('bridge.dropResult')}</span>
              <span className="text-[10px] text-studio-textSubtle block mt-0.5">
                {t('bridge.selectResult')}
              </span>
            </div>
          </div>

          {/* Display Result / Comparison */}
          {importedResult ? (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-white">{t('bridge.compareTitle')}</span>
                <span className="text-[10px] text-studio-textSubtle">
                  {importedResult.width} × {importedResult.height} px
                  {' · '}{importedResult.mimeType}
                </span>
              </div>

              {/* Before/After Split View */}
              <div className="relative aspect-video rounded-xl overflow-hidden border border-studio-border bg-black select-none">
                {/* Result Image (Bottom) */}
                <img
                  src={toImageDataUrl(importedResult.imageBase64, importedResult.mimeType)}
                  alt="Gemini Render"
                  className="absolute inset-0 w-full h-full object-cover"
                />

                {/* Original Image (Top clipped by slider) */}
                {sourceImage && !sourceImageFailed && (
                  <div
                    className="absolute inset-0 overflow-hidden"
                    style={{ width: `${sliderPosition}%` }}
                  >
                    <img
                      src={toImageDataUrl(sourceImage, sourceMimeType)}
                      alt="Archicad Reference"
                      className="absolute inset-0 w-full h-full object-cover max-w-none"
                      style={{ width: '100%', height: '100%' }}
                    />
                    <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm text-[9px] font-mono px-2 py-0.5 rounded text-white border border-white/10">
                      {t('bridge.sourceLabel')} (Archicad)
                    </div>
                  </div>
                )}

                <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-[9px] font-mono px-2 py-0.5 rounded text-emerald-400 border border-emerald-500/20">
                  {t('bridge.renderLabel')}
                </div>

                {/* Slider bar */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] cursor-ew-resize"
                  style={{ left: `${sliderPosition}%` }}
                >
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white text-black flex items-center justify-center text-[9px] font-bold shadow-md">
                    ↔
                  </div>
                </div>

                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sliderPosition}
                  onChange={(e) => setSliderPosition(Number(e.target.value))}
                  className="absolute inset-0 opacity-0 cursor-ew-resize w-full h-full z-10"
                />
              </div>

              {/* Action Buttons for Imported Result */}
              <div className="grid grid-cols-2 gap-2">
              <button onClick={handleApproveDesign} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-[11px] font-semibold text-emerald-200">
                <CheckSquare className="w-3.5 h-3.5" />
                {t('bridge.approveAsMaster')}
              </button>
              <button onClick={() => { void handleSaveDesignVariant(); }} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-[11px] font-semibold text-amber-100">
                <Layers className="w-3.5 h-3.5" />
                {t('bridge.saveVariant')}
              </button>
              </div>
              <div className="flex items-center space-x-2 pt-1">
                <button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = `data:${importedResult.mimeType};base64,${importedResult.imageBase64}`;
                    const extension = importedResult.mimeType === 'image/jpeg' ? 'jpg' : importedResult.mimeType === 'image/webp' ? 'webp' : 'png';
                    link.download = `Gemini_Render_${Date.now()}.${extension}`;
                    link.click();
                  }}
                  className="flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg bg-studio-surfaceLight hover:bg-studio-surfaceHover border border-studio-border text-xs font-medium text-white transition-all"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{t('bridge.saveImage')}</span>
                </button>

                {onNavigateStudio && (
                  <button
                    onClick={onNavigateStudio}
                    className="flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all shadow-sm"
                  >
                    <span>{t('bridge.toGenerationStudio')}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-studio-border/50 rounded-xl bg-studio-surfaceLight/30 text-studio-textSubtle">
              <ImageIcon className="w-8 h-8 opacity-40 mb-2" />
              <span className="text-xs">{t('bridge.waitingResult')}</span>
              <span className="text-[10px] mt-1 max-w-[200px] leading-relaxed">
                {t('bridge.waitingHint')}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
