import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Clipboard, Copy, Download, ExternalLink, FolderOpen, ImageIcon, Layers, Plus, Sparkles, UploadCloud } from 'lucide-react';
import { GeminiDownload } from '../types/electron';
import { CloudUpscalePanel } from '../components/CloudUpscalePanel';
import { ProjectMaterials } from '../components/ProjectMaterials';
import { MaterialZones } from '../components/MaterialZones';
import { BridgeAsset, buildSwatchSheet, buildZoneGuide, flowUrl, fluxUrl, materialDescription, openBridgePage, saveBridgeFile } from '../services/bridgeFiles';
import { Project, ProjectView, ApprovedProjectDesign, ProjectDesignDraft, ProjectDesignVariant, GenerationRecord, MaterialReference, MaterialZone, RoomType } from '../types/project';
import { GenerationResult } from '../types/ai';
import { geminiBridgeService } from '../services/ai/GeminiBridgeService';
import {
  ROOM_TYPES,
  INTERIOR_STYLES,
  LIGHTING_OPTIONS,
  ATMOSPHERE_OPTIONS,
  MATERIAL_OPTIONS,
  buildArchitecturalPositivePrompt,
} from '../services/promptBuilder';
import { dbService } from '../services/db';
import { useI18n } from '../i18n/i18nContext';

interface GeminiBridgeViewProps {
  currentProject: Project | null;
  onUpdateProject?: (project: Project) => void;
  onNewProject: () => void;
  onNavigateSettings: () => void;
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

type BridgeStep = 'source' | 'design' | 'gemini' | 'result';
type DownloadMode = 'browser' | 'embedded' | 'flow' | 'flux';

interface BridgeHandoff {
  projectId: string;
  viewId: string;
  mode: DownloadMode;
  since: number;
  prompt: string;
  parentId?: string;
  copiedImage: boolean;
  copiedReference: boolean;
  copiedPrompt: boolean;
  design: ProjectDesignDraft;
  materials?: MaterialReference[];
  master?: boolean;
  imported?: boolean;
}

const handoffKey = 'visual-ai-gemini-handoff';
const recentImportKey = 'visual-ai-gemini-imported-downloads';
const steps: BridgeStep[] = ['source', 'design', 'gemini', 'result'];
const imageAccept = 'image/png,image/jpeg,image/webp';
const negativeDefaults = 'blur, distorted geometry, warped perspective, duplicate objects, cartoon, low quality';

function readSession<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(sessionStorage.getItem(key) || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}

function imageFileFromBase64(base64: string, name: string, mimeType: string): File {
  const decoded = atob(base64);
  return new File([Uint8Array.from(decoded, (character) => character.charCodeAt(0))], name, { type: mimeType });
}

const buttonClass = 'bridge-button';
const primaryClass = 'bridge-button bridge-primary';
const controlClass = 'studio-control w-full px-3 py-2.5 text-sm';

const toImageDataUrl = (image: string, mimeType: string): string => {
  if (/^data:image\/[\w.+-]+;base64,/i.test(image)) return image;
  const cleanBase64 = image.replace(/^data:[^,]+,/, '').replace(/\s/g, '');
  const normalizedMime = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;
  return `data:${normalizedMime};base64,${cleanBase64}`;
};

export const GeminiBridgeView: React.FC<GeminiBridgeViewProps> = ({
  currentProject,
  onUpdateProject,
  onNewProject,
  onNavigateSettings,
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

  const [customMaterials, setCustomMaterials] = useState('');
  const [customStyle, setCustomStyle] = useState('');
  const [customLighting, setCustomLighting] = useState('');
  const [customDecor, setCustomDecor] = useState('');
  const [negativePrompt, setNegativePrompt] = useState(negativeDefaults);
  const [promptOverride, setPromptOverride] = useState<string | null>(null);

  const [step, setStep] = useState<BridgeStep>('source');
  const [handoff, setHandoff] = useState(() => readSession<BridgeHandoff | null>(handoffKey, null));
  const [downloads, setDownloads] = useState<GeminiDownload[]>([]);
  const [importedPaths, setImportedPaths] = useState(() => readSession<string[]>(recentImportKey, []));
  const [bridgeMessage, setBridgeMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resultLoading, setResultLoading] = useState(false);
  const [importedResult, setImportedResult] = useState<GenerationResult | null>(null);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [refinementText, setRefinementText] = useState('');
  const [upscaleOpen, setUpscaleOpen] = useState(false);
  const [flowUpscaleOpen, setFlowUpscaleOpen] = useState(false);
  const [flowUpscalePicker, setFlowUpscalePicker] = useState(false);
  const [draggingSource, setDraggingSource] = useState(false);
  const [draggingResult, setDraggingResult] = useState(false);
  const busyRef = useRef(false);
  const alive = useRef(false);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const anglesInputRef = useRef<HTMLInputElement>(null);
  const viewSelectionRequestRef = useRef(0);
  const currentProjectRef = useRef(currentProject);

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
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    setSourceImageFailed(false);
    setSliderPosition(50);
    setRefinementText('');
    setUpscaleOpen(false);
    setFlowUpscaleOpen(false);
    setFlowUpscalePicker(false);
    setPromptOverride(null);
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
    setViewOverrideText('');

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
    setNegativePrompt(design?.negativePrompt ?? negativeDefaults);
    setCustomStyle(design?.customStyle || '');
    setCustomMaterials(design?.customMaterials || '');
    setCustomLighting(design?.customLighting || '');
    setCustomDecor(design?.customDecor || '');

    const pending = handoff?.projectId === currentProject?.id ? handoff : null;
    const first = views.find((view) => view.id === pending?.viewId) || views[0];
    if (pending && first?.id === pending.viewId && !pending.imported) setStep('gemini');
    else if (first?.resultGenerationId || first?.resultImageBase64) setStep('result');
    if (first) {
      setSelectedViewId(first.id);
      setViewOverrideText(first.designOverride || '');
      setSourceImage(first.sourceImageBase64);
      setSourceMimeType(first.sourceMimeType || 'image/png');
      void loadViewResult(first);
    } else {
      setSelectedViewId('');
      setSourceImage(currentProject?.sourceImageBase64 || null);
      setSourceMimeType('image/png');
    }
    setHydratedProjectId(currentProject?.id || null);
  }, [currentProject?.id]);

  useEffect(() => {
    if (!currentProject || hydratedProjectId !== currentProject.id) return;
    const timer = window.setTimeout(() => {
      const latestProject = currentProjectRef.current;
      if (!latestProject || latestProject.id !== currentProject.id || busyRef.current) return;
      const designDraft = buildDesignDraft();
      const { updatedAt: _timestamp, ...draftFields } = designDraft;
      const { updatedAt: _previousTimestamp, ...previousFields } = latestProject.designDraft || {};
      if (JSON.stringify(draftFields) === JSON.stringify(previousFields)) return;
      const updatedProject = { ...latestProject, designDraft, updatedAt: Date.now() };
      void dbService.saveProject(updatedProject, true).then(() => {
        if (alive.current && currentProjectRef.current === latestProject) {
          currentProjectRef.current = updatedProject;
          onUpdateProject?.(updatedProject);
        }
      }).catch(() => setErrorMessage(t('bridgeFlow.saveFailed')));
    }, 250);
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
    const project = currentProjectRef.current;
    if (!project) return;
    const storedViews = views.map((view) => view.resultGenerationId ? { ...view, resultImageBase64: undefined } : view);
    const storedDesign = design?.masterGenerationId ? { ...design, masterImageBase64: undefined } : design;
    const updatedProject: Project = {
      ...project,
      views: storedViews,
      approvedDesign: storedDesign,
      designDraft: buildDesignDraft(),
      designVariants: variants,
      sourceImageBase64: storedViews[0] ? toImageDataUrl(storedViews[0].sourceImageBase64, storedViews[0].sourceMimeType) : project.sourceImageBase64,
      sourceImagePath: storedViews[0] ? storedViews[0].sourceImagePath : project.sourceImagePath,
      updatedAt: Date.now(),
    };
    await dbService.saveProject(updatedProject, true);
    currentProjectRef.current = updatedProject;
    setProjectViews(views);
    if (alive.current) onUpdateProject?.(updatedProject);
  };

  const handleAddAngleFiles = async (files: File[]) => {
    if (!files?.length) return;
    const remaining = Math.max(0, 12 - projectViews.length);
    if (remaining === 0) {
      setBridgeMessage(t('bridge.viewLimitReached'));
      return;
    }
    const additions: ProjectView[] = [];
    for (const file of files.slice(0, remaining)) {
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
    viewSelectionRequestRef.current++;
    setSelectedViewId(firstNewView.id);
    setViewOverrideText('');
    setSourceImage(firstNewView.sourceImageBase64);
    setSourceMimeType(firstNewView.sourceMimeType);
    setImportedResult(null);
    setResultLoading(false);
  };

  const handleSelectView = async (view: ProjectView) => {
    setSelectedViewId(view.id);
    setViewOverrideText(view.designOverride || '');
    setSourceImage(view.sourceImageBase64);
    setSourceMimeType(view.sourceMimeType || 'image/png');
    await loadViewResult(view);
  };

  const loadViewResult = async (view: ProjectView) => {
    const requestId = ++viewSelectionRequestRef.current;
    setImportedResult(null);
    setResultLoading(Boolean(view.resultGenerationId));
    let promptUsed = '';
    let resultBase64 = view.resultImageBase64;
    let resultMime = view.resultMimeType || 'image/png';
    let resultWidth = view.resultWidth || 1024;
    let resultHeight = view.resultHeight || 768;
    let provider = 'gemini_bridge';
    let model = 'gemini-web-personal';
    if (!resultBase64 && view.resultGenerationId) {
      const record = await dbService.getGenerationById(view.resultGenerationId);
      if (record?.outputImageBase64) {
        const match = record.outputImageBase64.match(/^data:(image\/[\w+.-]+);base64,/);
        resultMime = match?.[1] || 'image/png';
        resultBase64 = record.outputImageBase64.replace(/^data:image\/[\w+.-]+;base64,/, '');
        promptUsed = record.prompt;
        resultWidth = record.width;
        resultHeight = record.height;
        provider = record.provider;
        model = record.model;
      }
    }
    if (requestId !== viewSelectionRequestRef.current || !alive.current) return;
    setResultLoading(false);
    if (resultBase64) {
      const result = geminiBridgeService.createBridgeGenerationResult({
        imageBase64: resultBase64,
        mimeType: resultMime,
        width: resultWidth,
        height: resultHeight,
        promptUsed,
      });
      setImportedResult({ ...result, provider, model, id: view.resultGenerationId || 'gemini_bridge_legacy_' + view.id });
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
      masterGenerationId: importedResult.id.startsWith('gemini_bridge_legacy_') ? undefined : importedResult.id,
      masterImageBase64: importedResult.imageBase64,
      masterMimeType: importedResult.mimeType,
      decisions,
      materialReferences: currentProject?.materialReferences?.map(({ imageBase64: _image, ...item }) => item),
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
    await persistProjectViews(projectViews.map((item) => ({ ...item, approved: item.id === view.id })), design);
    setApprovedDesign(design);
    setBridgeMessage(t('bridge.masterApproved'));
  };

  const handleSaveDesignVariant = async () => {
    if (!currentProject || !importedResult || !selectedViewId) return;
    const variant: ProjectDesignVariant = {
      id: `variant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: `${t('bridge.designVariant')} ${designVariants.length + 1}`,
      masterViewId: selectedViewId,
      masterGenerationId: importedResult.id.startsWith('gemini_bridge_legacy_') ? undefined : importedResult.id,
      masterImageBase64: importedResult.id.startsWith('gemini_bridge_legacy_') ? importedResult.imageBase64 : undefined,
      masterMimeType: importedResult.mimeType,
      decisions: [customStyle, customMaterials, customLighting, customDecor].filter(Boolean).join('\n'),
      materialReferences: currentProject.materialReferences?.map(({ imageBase64: _image, ...item }) => item),
      styleId, materialIds: [...selectedMaterials], surfaceAssignments: { ...surfaceAssignments },
      lightingId, atmosphereId, roomType, geometryMode, cameraOptics, negativePrompt,
      customStyle, customMaterials, customLighting, customDecor, approvedAt: Date.now(),
    };
    const updated = [...designVariants, variant];
    await persistProjectViews(projectViews, approvedDesign, updated);
    setDesignVariants(updated);
    setBridgeMessage(t('bridge.variantSaved'));
  };

  const handleApplyDesignVariant = async (variant: ProjectDesignVariant) => {
    if (variant.materialReferences) {
      await saveMaterials(variant.materialReferences.map((item) => {
        const original = currentProject?.materialReferences?.find((ref) => ref.id === item.id && materialDescription(ref) === materialDescription(item));
        return { ...item, imageBase64: original?.imageBase64 };
      }), true);
    }
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
    setPromptOverride(null);
    const view = projectViews.find((item) => item.id === variant.masterViewId);
    if (view && view.id !== selectedViewId) await handleSelectView(view);
    if (variant.masterImageBase64) {
      setImportedResult(geminiBridgeService.createBridgeGenerationResult({
        imageBase64: variant.masterImageBase64, mimeType: variant.masterMimeType,
        width: view?.resultWidth || 1024, height: view?.resultHeight || 768, promptUsed: '',
      }));
    } else if (variant.masterGenerationId) {
      const record = await dbService.getGenerationById(variant.masterGenerationId);
      const match = record?.outputImageBase64?.match(/^data:(image\/[\w+.-]+);base64,/);
      if (record?.outputImageBase64) {
        setImportedResult({ ...geminiBridgeService.createBridgeGenerationResult({
          imageBase64: record.outputImageBase64.replace(/^data:image\/[\w+.-]+;base64,/, ''),
          mimeType: match?.[1] || variant.masterMimeType,
          width: record.width, height: record.height, promptUsed: record.prompt,
        }), id: record.id, provider: record.provider, model: record.model });
      }
    }
    setBridgeMessage(t('bridge.variantRestored', { name: variant.name }));
  };

  const loadMasterImage = async (): Promise<BridgeAsset> => {
    if (!approvedDesign) throw new Error('No approved design');
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
      throw new Error(t('bridge.masterCopyFailed'));
    }
    return { name: '02-approved-design', image, mime: mimeType };
  };

  const handleCopyMasterImage = async () => {
    const asset = await loadMasterImage();
    const copied = await geminiBridgeService.copyImageToClipboard(asset.image, asset.mime);
    if (!copied) throw new Error(t('bridge.masterCopyFailed'));
    updateHandoffFlags({ copiedReference: true });
    setBridgeMessage(t('bridge.masterCopied'));
  };

  const toggleMaterial = (mId: string) => {
    if (selectedMaterials.includes(mId)) {
      setSelectedMaterials(selectedMaterials.filter((id) => id !== mId));
    } else {
      setSelectedMaterials([...selectedMaterials, mId]);
    }
    setPromptOverride(null);
  };

  const setSurfaceMaterial = (surface: keyof NonNullable<ApprovedProjectDesign['surfaceAssignments']>, materialId: string) => {
    setSurfaceAssignments((current) => ({ ...current, [surface]: materialId || undefined }));
    if (materialId && !selectedMaterials.includes(materialId)) setSelectedMaterials((current) => [...current, materialId]);
    setPromptOverride(null);
  };

  const view = projectViews.find((item) => item.id === selectedViewId);
  const materialReferences = currentProject?.materialReferences || [];
  const zones = (view?.materialZones || []).filter((zone) => materialReferences.some((item) => item.id === zone.materialId));
  const ready = Boolean(view && sourceImage && !sourceImageFailed);
  const reference = Boolean(approvedDesign && approvedDesign.masterViewId !== view?.id);
  const pending = handoff?.projectId === currentProject?.id && handoff?.viewId === view?.id ? handoff : null;
  const packageHandoff = pending && (pending.mode === 'flow' || pending.mode === 'flux');
  const label = (item: { labelRu: string; labelUk: string; labelEn: string }) =>
    language === 'ru' ? item.labelRu : language === 'uk' ? item.labelUk : item.labelEn;
  const style = INTERIOR_STYLES.find((item) => item.id === styleId) || INTERIOR_STYLES[0];
  const baseline = buildArchitecturalPositivePrompt({
    roomType: roomType as RoomType, style, geometryMode, lightingId, atmosphereId, selectedMaterials,
    customStyle, customMaterials, customLighting, customDecor,
  });
  const scope = {
    strict: 'Preserve the exact camera, architecture and furniture placement. Change finishes and lighting only.',
    balanced: 'Preserve the camera, architecture and furniture layout. Adjust small decor and finishes.',
    creative: 'Use this room as the basis for a new design concept.',
  };
  const assignments = surfaceFields.flatMap(({ id }) => {
    const material = MATERIAL_OPTIONS.find((item) => item.id === surfaceAssignments[id]);
    return material ? [id + ': ' + material.promptDescription] : [];
  });
  const assignedSurfaces = new Set(materialReferences.map((item) => item.targetSurface));
  const referenceAssignments = materialReferences.map((item, index) =>
    'M' + (index + 1) + ' · ' + item.targetSurface + ': ' + materialDescription(item));
  const swatchItems = materialReferences.filter((item) => item.imageBase64);
  const genericAssignments = assignments.filter((assignment) => !assignedSurfaces.has(assignment.split(':')[0] as MaterialReference['targetSurface']));
  const basePrompt = [
    'Generate a photorealistic interior visualization from the first attached image. Return the image.',
    scope[geometryMode],
    baseline.slice(baseline.indexOf('Space Type:')).split('Photographic & Rendering Standards:')[0].trim(),
    genericAssignments.length && 'Use these generic finishes where no product specification is given: ' + genericAssignments.join('; '),
    'Architectural photography, lens character: ' + ({ tilt_shift_24mm: '24mm tilt-shift', prime_35mm: '35mm prime', '50mm': '50mm' }[cameraOptics] || 'natural'),
    negativePrompt && 'Avoid: ' + negativePrompt,
    view?.designOverride && 'For this view: ' + view.designOverride,
  ].filter(Boolean).join('\n\n');
  const generatedPrompt = [
    promptOverride ?? basePrompt,
    reference && 'Use the second attached image as the approved material and lighting reference. Follow the composition of the first image.',
    referenceAssignments.length && 'Project material schedule. These assignments override generic palette suggestions: ' + referenceAssignments.join('; '),
    swatchItems.length && 'Use the attached numbered material sheet for color and texture. Never render its labels. ' +
      swatchItems.map((item) => 'M' + (materialReferences.indexOf(item) + 1) + ' → ' + item.targetSurface).join('; '),
    zones.length && 'Use the separate marked zone guide as an approximate location reference. Match materials within the indicated architectural surfaces and follow their real boundaries. Do not render colors, boxes or labels from the guide. ' +
      zones.map((zone, index) => 'Z' + (index + 1) + ' → M' + (materialReferences.findIndex((item) => item.id === zone.materialId) + 1)).join('; '),
  ].filter(Boolean).join('\n\n');

  function zoneGuide() {
    return buildZoneGuide(toImageDataUrl(sourceImage || '', sourceMimeType), zones, materialReferences);
  }

  async function saveZones(next: MaterialZone[]) {
    await persistProjectViews(projectViews.map((item) => item.id === selectedViewId ? { ...item, materialZones: next, updatedAt: Date.now() } : item));
    if (pending) setPending(null);
  }

  async function saveMaterials(items: MaterialReference[], inAction = false) {
    if (!inAction && busyRef.current) throw new Error('Bridge is busy');
    const project = currentProjectRef.current;
    if (!project) return;
    const updated = { ...project, materialReferences: items, designDraft: buildDesignDraft(), updatedAt: Date.now() };
    busyRef.current = true;
    try {
      await dbService.saveProject(updated, true);
      currentProjectRef.current = updated;
      if (alive.current) onUpdateProject?.(updated);
      setPromptOverride(null);
      if (pending) setPending(null);
    } finally {
      if (!inAction) busyRef.current = false;
    }
  }

  function setPending(value: BridgeHandoff | null) {
    setHandoff(value);
    if (value) sessionStorage.setItem(handoffKey, JSON.stringify(value));
    else sessionStorage.removeItem(handoffKey);
  }

  function updateHandoffFlags(flags: Partial<Pick<BridgeHandoff, 'copiedImage' | 'copiedReference' | 'copiedPrompt'>>) {
    if (pending) setPending({ ...pending, ...flags });
  }

  useEffect(() => {
    const api = window.electronAPI;
    if (!api || !pending || pending.mode === 'flow' || pending.mode === 'flux') {
      setDownloads([]);
      return;
    }
    const mode = pending.mode;
    let stopped = false;
    let checking = false;
    const refresh = async () => {
      if (checking) return;
      checking = true;
      try {
        const items = await api.listRecentGeminiImages(mode, pending.since);
        if (!stopped) setDownloads(items.filter((item) => !importedPaths.includes(item.filePath)));
      } catch {
        // Manual import is available when the download folder is unavailable.
      } finally {
        checking = false;
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 2500);
    window.addEventListener('focus', refresh);
    const unsubscribe = api.onGeminiImageDownloaded(refresh);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      unsubscribe();
    };
  }, [pending?.mode, pending?.since, importedPaths]);

  function goTo(next: BridgeStep) {
    setStep(next);
    workspaceRef.current?.scrollTo({ top: 0 });
    requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
  }

  async function run(action: () => Promise<void>, failure = t('bridgeFlow.saveFailed')) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setErrorMessage(null);
    setBridgeMessage(null);
    try {
      await action();
    } catch (error) {
      console.error('Gemini Bridge action failed', error);
      if (alive.current) setErrorMessage(failure);
    } finally {
      busyRef.current = false;
      if (alive.current) setBusy(false);
    }
  }

  async function uploadSource(file: File) {
    if (!currentProject) return;
    const data = await geminiBridgeService.processImportedFile(file).catch(() => null);
    if (!data) {
      setErrorMessage(t('bridge.invalidImageFile'));
      return;
    }
    const replace = view && !view.resultGenerationId && !view.resultImageBase64 && !view.approved;
    if (!replace && projectViews.length >= 12) {
      setErrorMessage(t('bridge.viewLimitReached'));
      return;
    }
    const now = Date.now();
    const next: ProjectView = {
      id: replace ? view.id : 'view-' + crypto.randomUUID(),
      name: file.name.replace(/\.[^.]+$/, ''), sourceImageBase64: data.imageBase64, sourceMimeType: data.mimeType,
      approved: false, designOverride: replace ? view.designOverride : undefined, createdAt: replace ? view.createdAt : now, updatedAt: now,
    };
    await persistProjectViews(replace ? projectViews.map((item) => item.id === next.id ? next : item) : [...projectViews, next]);
    if (pending) setPending(null);
    await handleSelectView(next);
    goTo('design');
  }

  async function startGemini(mode: DownloadMode, refine = false) {
    if (!currentProject || !view || !sourceImage) return;
    const parent = refine ? importedResult : null;
    const prompt = parent
      ? 'Edit this interior visualization. Keep the layout, camera and all unrelated details. Return the revised image.\n\n' + refinementText.trim()
      : generatedPrompt.trim();
    const since = Date.now();
    const externalPackage = mode === 'flow' || mode === 'flux';
    const opening = externalPackage ? openBridgePage(mode === 'flow' ? flowUrl : fluxUrl).then(() => true, () => false)
      : mode === 'embedded' ? geminiBridgeService.openGeminiWeb() : geminiBridgeService.openGeminiExternal();
    const copiedImage = !externalPackage && await geminiBridgeService.copyImageToClipboard(parent?.imageBase64 || sourceImage, parent?.mimeType || sourceMimeType);
    if (!await opening) throw new Error('open-gemini');
    setDownloads([]);
    setPending({ projectId: currentProject.id, viewId: view.id, mode, since, prompt, parentId: parent?.id,
      copiedImage, copiedReference: false, copiedPrompt: false, design: buildDesignDraft(), master: reference && !parent,
      materials: materialReferences.map(({ imageBase64: _swatch, ...item }) => item) });
    goTo('gemini');
    if (!externalPackage) {
      if (copiedImage) setBridgeMessage(t('bridgeFlow.sourceCopied'));
      else setErrorMessage(t('bridgeFlow.copyImageFailed'));
    }
  }

  function handoffImage() {
    if (pending?.parentId && importedResult?.id === pending.parentId) return { image: importedResult.imageBase64, mime: importedResult.mimeType };
    return { image: sourceImage || '', mime: sourceMimeType };
  }

  async function prepareFiles() {
    if (!pending || !window.electronAPI) return;
    const input = handoffImage();
    const files: BridgeAsset[] = [{ name: '01-source-render', ...input }];
    if (pending.master ?? (reference && !pending.parentId)) files.push(await loadMasterImage());
    const sheet = pending.parentId ? null : await buildSwatchSheet(materialReferences);
    if (sheet) files.push({ ...sheet, name: '03-material-swatches' });
    if (zones.length && !pending.parentId) files.push(await zoneGuide());
    await window.electronAPI.prepareBridgeFiles(files, pending.prompt);
  }

  async function importResult(file: File, downloadPath?: string, upscale = false) {
    if (!currentProject || !view || !ready) return;
    const data = await geminiBridgeService.processImportedFile(file).catch(() => null);
    if (!data) {
      setErrorMessage(t('bridge.invalidImageFile'));
      return;
    }
    const source = toImageDataUrl(view.sourceImageBase64, view.sourceMimeType);
    if (data.imageBase64 === source.split(',')[1] || data.imageBase64 === importedResult?.imageBase64) {
      setErrorMessage(t('bridgeFlow.sameSource'));
      return;
    }
    const design = pending?.design || buildDesignDraft();
    const size = Math.max(data.width, data.height);
    const isFlow = pending?.mode === 'flow' || upscale;
    if (upscale && importedResult && (data.width < importedResult.width || data.height < importedResult.height ||
        (data.width === importedResult.width && data.height === importedResult.height))) {
      setErrorMessage(t('flow.upscaleSize'));
      return;
    }
    const promptUsed = upscale ? '2K upscale of an existing visualization in Google Flow.' : pending?.prompt || generatedPrompt;
    const result = geminiBridgeService.createBridgeGenerationResult({
      ...data, promptUsed, resolution: size >= 3000 ? '4k' : size >= 1800 ? '2k' : '1k',
    });
    if (isFlow) {
      result.provider = 'google_flow';
      result.model = 'google-flow-web';
    } else if (pending?.mode === 'flux') {
      result.provider = 'flux_bridge';
      result.model = 'flux-2-klein-4b';
    }
    const record: GenerationRecord = {
      id: result.id, projectId: currentProject.id, viewId: view.id, parentId: upscale ? importedResult?.id : pending?.parentId,
      sourceImagePath: view.sourceImagePath || view.name, sourceImageBase64: source,
      outputImagePath: downloadPath || file.name, outputImageBase64: toImageDataUrl(result.imageBase64, result.mimeType),
      prompt: result.promptUsed, styleId: design.styleId || styleId, roomType: (design.roomType || roomType) as RoomType,
      geometryMode: design.geometryMode || geometryMode, lighting: design.lightingId, materials: design.materialIds,
      atmosphere: design.atmosphereId, provider: result.provider, model: result.model, width: result.width, height: result.height,
      materialReferences: pending?.materials ?? materialReferences.map(({ imageBase64: _swatch, ...item }) => item),
      latencyMs: 0, createdAt: result.timestamp, resolution: result.resolution, costUsd: 0,
    };
    await dbService.saveGeneration(record, true);
    await persistProjectViews(projectViews.map((item) => item.id === view.id ? {
      ...item, resultImageBase64: undefined, resultGenerationId: result.id, resultMimeType: result.mimeType,
      resultWidth: result.width, resultHeight: result.height, updatedAt: result.timestamp,
    } : item));
    if (downloadPath) {
      const paths = [...importedPaths, downloadPath].slice(-40);
      setImportedPaths(paths);
      sessionStorage.setItem(recentImportKey, JSON.stringify(paths));
    }
    if (pending) setPending(packageHandoff && !upscale ? { ...pending, imported: true } : null);
    setImportedResult(result);
    setUpscaleOpen(false);
    setFlowUpscaleOpen(false);
    setFlowUpscalePicker(false);
    setRefinementText('');
    setSliderPosition(50);
    setBridgeMessage(t('bridge.imported'));
    goTo('result');
  }

  function downloadResult(result: GenerationResult) {
    const link = document.createElement('a');
    link.href = toImageDataUrl(result.imageBase64, result.mimeType);
    const extension = result.mimeType === 'image/jpeg' ? 'jpg' : result.mimeType === 'image/webp' ? 'webp' : 'png';
    link.download = (result.provider === 'google_flow' ? 'Flow-' : result.provider === 'flux_bridge' ? 'FLUX-' : 'Gemini-') + result.timestamp + '.' + extension;
    link.click();
  }

  const selectFile = (event: React.ChangeEvent<HTMLInputElement>, action: (file: File) => Promise<void>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file) void run(() => action(file));
  };
  const dropFile = (event: React.DragEvent, action: (file: File) => Promise<void>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) void run(() => action(file));
  };
  const select = (name: string, value: string, setter: (value: string) => void, options: { id: string; text: string }[]) => (
    <label className="bridge-field">{name}<select className={controlClass} value={value} onChange={(event) => {
      setter(event.target.value);
      setPromptOverride(null);
    }}>{options.map((item) => <option key={item.id} value={item.id}>{item.text}</option>)}</select></label>
  );

  return (
    <div ref={workspaceRef} className="bridge-workspace min-w-0 flex-1 overflow-y-auto">
      <div className="bridge-container">
        <header className="bridge-header">
          <div><p className="bridge-eyebrow"><Sparkles size={15} />Gemini Bridge</p><h1>{t('bridgeFlow.title')}</h1><p className="bridge-muted">{t('flow.subtitle')}</p></div>
          {currentProject && <span className="bridge-project"><Layers size={16} /><span>{currentProject.name}</span></span>}
        </header>
        <nav aria-label={t('bridgeFlow.steps')} className="bridge-steps">
          {steps.map((item, index) => <button key={item} aria-current={step === item ? 'step' : undefined}
            disabled={busy || (item !== 'source' && !ready)} onClick={() => goTo(item)}><span>{index + 1}</span>{t(item === 'gemini' ? 'flow.step' : 'bridgeFlow.' + item)}</button>)}
        </nav>
        <input ref={sourceInputRef} type="file" accept={imageAccept} hidden onChange={(event) => selectFile(event, uploadSource)} />
        <input ref={fileInputRef} type="file" accept={imageAccept} hidden onChange={(event) => {
          selectFile(event, (file) => importResult(file, undefined, flowUpscalePicker));
          setFlowUpscalePicker(false);
        }} />
        <input ref={anglesInputRef} type="file" accept={imageAccept} multiple hidden onChange={(event) => {
          const files = Array.from(event.currentTarget.files || []);
          if (files?.length) void run(() => handleAddAngleFiles(files));
          event.currentTarget.value = '';
        }} />
        <section className="bridge-card" aria-busy={busy}>
          <div className="bridge-card-heading">
            <h2 ref={headingRef} tabIndex={-1}>{t(step === 'gemini' ? 'flow.heading' : 'bridgeFlow.' + step + 'Heading')}</h2>
            <p className="bridge-muted">{t(step === 'gemini' ? 'flow.hint' : 'bridgeFlow.' + step + 'Hint')}</p>
          </div>
          {step === 'source' && (!currentProject ? <button className={primaryClass} onClick={onNewProject}><Plus size={17} />{t('action.newProject')}</button> :
            <div className="bridge-source-layout">
              <button className={'bridge-dropzone' + (draggingSource ? ' is-dragging' : '')} disabled={busy}
                onClick={() => sourceInputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDraggingSource(true); }}
                onDragLeave={() => setDraggingSource(false)} onDrop={(event) => { setDraggingSource(false); dropFile(event, uploadSource); }}>
                {ready && sourceImage ? <img src={toImageDataUrl(sourceImage, sourceMimeType)} alt={t('bridge.sourceImageAlt')} onError={() => setSourceImageFailed(true)} /> :
                  <><UploadCloud size={30} /><strong>{t(sourceImageFailed ? 'bridge.sourceImageLoadFailed' : 'bridgeFlow.chooseSource')}</strong><span>{t('bridgeFlow.dropHint')}</span></>}
              </button>
              <div className="bridge-stack">
                {view && <>
                  <label className="bridge-field">{t('bridge.projectAngles')}<select className={controlClass} value={selectedViewId} disabled={busy}
                    onChange={(event) => { const next = projectViews.find((item) => item.id === event.target.value); if (next) void handleSelectView(next); }}>
                    {projectViews.map((item) => <option key={item.id} value={item.id}>{item.name}{item.resultGenerationId ? ' ✓' : ''}</option>)}
                  </select></label>
                  <button className={buttonClass} disabled={busy} onClick={() => anglesInputRef.current?.click()}><Plus size={16} />{t('bridge.addAngles')}</button>
                </>}
                {designVariants.length > 0 && <details className="bridge-details"><summary>{t('bridge.savedVariants')}<ChevronDown size={16} /></summary>
                  <div className="bridge-actions">{designVariants.map((variant) => <button key={variant.id} className={buttonClass} disabled={busy}
                    onClick={() => run(async () => { await handleApplyDesignVariant(variant); goTo('result'); })}>{variant.name}</button>)}</div>
                </details>}
              </div>
            </div>)}

          {step === 'design' && <fieldset disabled={busy} className="bridge-stack">
            <div className="bridge-field-grid">
              {select(t('bridge.roomType'), roomType, setRoomType, ROOM_TYPES.map((item) => ({ id: item.id, text: label(item) })))}
              {select(t('bridge.interiorStyle'), styleId, setStyleId, INTERIOR_STYLES.map((item) => ({ id: item.id, text: STYLE_NAMES[item.id]?.[language] || item.name })))}
              {select(t('bridge.lighting'), lightingId, setLightingId, LIGHTING_OPTIONS.map((item) => ({ id: item.id, text: label(item) })))}
            </div>
            <label className="bridge-field">{t('bridgeFlow.designNotes')}<textarea className={controlClass} rows={3} value={customStyle}
              onChange={(event) => { setCustomStyle(event.target.value); setPromptOverride(null); }} placeholder={t('bridgeFlow.designPlaceholder')} /></label>
            <div><h3>{t('bridgeFlow.geometry')}</h3><div className="bridge-field-grid mt-2">
              {(['strict', 'balanced', 'creative'] as const).map((mode) => <button key={mode} className="bridge-choice" aria-pressed={geometryMode === mode}
                onClick={() => { setGeometryMode(mode); setPromptOverride(null); }}><strong>{t('bridgeFlow.' + mode)}</strong><span>{t('bridgeFlow.' + mode + 'Hint')}</span></button>)}
            </div></div>
            <details className="bridge-details"><summary>{t('catalog.title')}<ChevronDown size={16} /></summary>
              <ProjectMaterials items={materialReferences} disabled={busy} onChange={saveMaterials} />
            </details>
            {sourceImage && <details className="bridge-details"><summary>{t('zones.title')}<ChevronDown size={16} /></summary>
              <MaterialZones source={toImageDataUrl(sourceImage, sourceMimeType)} materials={materialReferences} zones={zones}
                disabled={busy} onSave={(next) => { void run(() => saveZones(next)); }} />
            </details>}
            <details className="bridge-details"><summary>{t('bridgeFlow.materials')}<ChevronDown size={16} /></summary>
              <div className="bridge-stack">
                <div className="bridge-chips">{MATERIAL_OPTIONS.map((item) => <button key={item.id} className="bridge-chip"
                  aria-pressed={selectedMaterials.includes(item.id)} onClick={() => toggleMaterial(item.id)}>{label(item)}</button>)}</div>
                <div className="bridge-field-grid">{surfaceFields.map((field) => <div key={field.id}>{select(field.label, surfaceAssignments[field.id] || '',
                  (value) => setSurfaceMaterial(field.id, value), [{ id: '', text: t('bridge.surfaceUnassigned') }, ...MATERIAL_OPTIONS.map((item) => ({ id: item.id, text: label(item) }))])}</div>)}</div>
              </div>
            </details>
            <details className="bridge-details"><summary>{t('bridgeFlow.detailSettings')}<ChevronDown size={16} /></summary>
              <div className="bridge-stack">
                <div className="bridge-field-grid">
                  {select(t('bridge.atmosphere'), atmosphereId, setAtmosphereId, ATMOSPHERE_OPTIONS.map((item) => ({ id: item.id, text: label(item) })))}
                  {select(t('bridge.cameraOptics'), cameraOptics, setCameraOptics, [{ id: 'tilt_shift_24mm', text: '24 mm Tilt-Shift' }, { id: 'prime_35mm', text: '35 mm Prime' }, { id: '50mm', text: '50 mm' }])}
                </div>
                {([
                  ['customMaterials', customMaterials, setCustomMaterials], ['customLighting', customLighting, setCustomLighting],
                  ['customDecor', customDecor, setCustomDecor], ['negativePrompt', negativePrompt, setNegativePrompt],
                ] as const).map(([key, value, setter]) => <label key={key} className="bridge-field">{t('bridge.' + key)}<textarea rows={2} className={controlClass} value={value}
                  onChange={(event) => { setter(event.target.value); setPromptOverride(null); }} /></label>)}
                {reference && <><textarea aria-label={t('bridge.viewOverridePlaceholder')} placeholder={t('bridge.viewOverridePlaceholder')} className={controlClass}
                  value={viewOverrideText} onChange={(event) => setViewOverrideText(event.target.value)} />
                  <button className={buttonClass} onClick={() => run(handleSaveViewOverride)}>{t('bridge.saveViewOverride')}</button></>}
              </div>
            </details>
            <details className="bridge-details"><summary>{t('bridgeFlow.prompt')}<ChevronDown size={16} /></summary><div className="bridge-stack">
              <textarea aria-label={t('bridgeFlow.prompt')} className={controlClass} rows={8} value={promptOverride ?? basePrompt} onChange={(event) => setPromptOverride(event.target.value)} />
              {(referenceAssignments.length > 0 || reference) && <p className="bridge-muted">{t('catalog.promptHint')}</p>}
              {promptOverride !== null && <button className={buttonClass} onClick={() => setPromptOverride(null)}>{t('bridge.regeneratePrompt')}</button>}
            </div></details>
          </fieldset>}

          {step === 'gemini' && <div className="bridge-stack">
            {!pending ? <div className="bridge-actions">
              <button className={primaryClass} disabled={busy || !generatedPrompt.trim()} onClick={() => run(() => startGemini('browser'), t('bridge.openFailed'))}><ExternalLink size={17} />{t('bridge.openGemini')}</button>
              <button className={buttonClass} disabled={busy || !generatedPrompt.trim()} onClick={() => run(() => startGemini('flow'), t('flow.openFailed'))}><ExternalLink size={17} />{t('flow.open')}</button>
              <button className={buttonClass} disabled={busy || !generatedPrompt.trim()} onClick={() => run(() => startGemini('flux'), t('flux.openFailed'))}><ExternalLink size={17} />{t('flux.open')}</button>
              {window.electronAPI && <button className={buttonClass} disabled={busy || !generatedPrompt.trim()} onClick={() => run(() => startGemini('embedded'), t('bridge.openFailed'))}>{t('bridgeFlow.embedded')}</button>}
            </div> : packageHandoff ? <>
              <ol className="bridge-instructions">
                <li><div><strong>{t('flow.attach')}</strong><p>{t(pending.mode === 'flux' ? 'flux.attachHint' : 'flow.attachHint')}</p></div>
                  {window.electronAPI && <button className={buttonClass} disabled={busy} onClick={() => run(prepareFiles, t('flow.filesFailed'))}><FolderOpen size={16} />{t('flow.files')}</button>}</li>
                {!window.electronAPI && <li><div><strong>{t('flow.files')}</strong><p>{t('flow.browserFiles')}</p></div>
                  <button className={buttonClass} disabled={busy} onClick={() => run(async () => {
                    const input = handoffImage();
                    if (!await geminiBridgeService.prepareTempFileAndReveal(input.image, '01-source-render', input.mime)) throw new Error('source');
                  }, t('flow.filesFailed'))}>{t('bridgeFlow.source')}</button>
                  {reference && !pending.parentId && <button className={buttonClass} disabled={busy} onClick={() => run(async () => {
                    const image = await loadMasterImage();
                    if (!await geminiBridgeService.prepareTempFileAndReveal(image.image, image.name, image.mime)) throw new Error('reference');
                  }, t('flow.filesFailed'))}>{t('bridge.masterAvailable')}</button>}
                  {swatchItems.length > 0 && !pending.parentId && <button className={buttonClass} disabled={busy} onClick={() => run(async () => {
                    const image = await buildSwatchSheet(materialReferences);
                    if (!image || !await geminiBridgeService.prepareTempFileAndReveal(image.image, '03-material-swatches.png', image.mime)) throw new Error('swatches');
                  }, t('flow.filesFailed'))}>{t('catalog.sheet')}</button>}
                  {zones.length > 0 && !pending.parentId && <button className={buttonClass} disabled={busy} onClick={() => run(async () => {
                    const image = await zoneGuide();
                    saveBridgeFile(image.image, image.name + '.png');
                  }, t('flow.filesFailed'))}>{t('zones.title')}</button>}</li>}
                <li><div><strong>{t(pending.mode === 'flux' ? 'flux.generate' : 'flow.generate')}</strong><p>{t(pending.mode === 'flux' ? 'flux.generateHint' : 'flow.generateHint')}</p></div>
                  <button className={primaryClass} disabled={busy} onClick={() => run(async () => {
                    if (!await geminiBridgeService.copyText(pending.prompt)) throw new Error('clipboard');
                    updateHandoffFlags({ copiedPrompt: true });
                    setBridgeMessage(t(pending.mode === 'flux' ? 'flux.copied' : 'flow.copied'));
                  }, t('bridgeFlow.copyPromptFailed'))}>{pending.copiedPrompt ? <Check size={16} /> : <Copy size={16} />}{t('bridgeFlow.copyRequest')}</button></li>
                <li><div><strong>{t('flow.import')}</strong><p>{t(pending.mode === 'flux' ? 'flux.importHint' : 'flow.importHint')}</p></div>
                  <button className={buttonClass} disabled={busy} onClick={() => { setFlowUpscalePicker(false); fileInputRef.current?.click(); }}><Download size={16} />{t('bridge.importResult')}</button></li>
              </ol>
              <div className="bridge-actions">
                <button className={buttonClass} disabled={busy} onClick={() => run(() => openBridgePage(pending.mode === 'flux' ? fluxUrl : flowUrl), t(pending.mode === 'flux' ? 'flux.openFailed' : 'flow.openFailed'))}>{t(pending.mode === 'flux' ? 'flux.open' : 'flow.open')}</button>
                <button className={buttonClass} disabled={busy} onClick={() => setPending(null)}>{t('bridgeFlow.restart')}</button>
              </div>
              <details className="bridge-details"><summary>{t('bridgeFlow.prompt')}<ChevronDown size={16} /></summary><div>
                <textarea className={controlClass} aria-label={t('bridgeFlow.prompt')} rows={5} readOnly value={pending.prompt} onFocus={(event) => event.currentTarget.select()} />
              </div></details>
            </> : <>
              <ol className="bridge-instructions">
                <li><div><strong>{t('bridgeFlow.pasteSource')}</strong><p>{t('bridgeFlow.pasteSourceHint')}</p></div>
                  <button className={buttonClass} disabled={busy} onClick={() => run(async () => {
                    const input = handoffImage();
                    if (!await geminiBridgeService.copyImageToClipboard(input.image, input.mime)) throw new Error('clipboard');
                    updateHandoffFlags({ copiedImage: true }); setBridgeMessage(t('bridgeFlow.sourceCopied'));
                  }, t('bridgeFlow.copyImageFailed'))}>{pending.copiedImage ? <Check size={16} /> : <Copy size={16} />}{t('bridgeFlow.copyImage')}</button></li>
                {reference && !pending.parentId && <li><div><strong>{t('bridgeFlow.pasteReference')}</strong><p>{t('bridge.stepPasteWithMaster')}</p></div>
                  <button className={buttonClass} disabled={busy} onClick={() => run(handleCopyMasterImage, t('bridge.masterCopyFailed'))}>{pending.copiedReference && <Check size={16} />}{t('bridge.copyMasterImage')}</button></li>}
                {swatchItems.length > 0 && !pending.parentId && <li><div><strong>{t('catalog.sheet')}</strong><p>{t('catalog.sheetHint')}</p></div>
                  <button className={buttonClass} disabled={busy} onClick={() => run(async () => {
                    const image = await buildSwatchSheet(materialReferences);
                    if (!image || !await geminiBridgeService.copyImageToClipboard(image.image, image.mime)) throw new Error('swatches');
                    setBridgeMessage(t('catalog.sheetCopied'));
                  }, t('catalog.sheetFailed'))}><Copy size={16} />{t('catalog.copySheet')}</button></li>}
                {zones.length > 0 && !pending.parentId && <li><div><strong>{t('zones.title')}</strong><p>{t('zones.transfer')}</p></div>
                  <button className={buttonClass} disabled={busy} onClick={() => run(async () => {
                    const image = await zoneGuide();
                    if (!await geminiBridgeService.copyImageToClipboard(image.image, image.mime)) throw new Error('zone-guide');
                    setBridgeMessage(t('zones.copied'));
                  }, t('flow.filesFailed'))}><Copy size={16} />{t('zones.copy')}</button></li>}
                <li><div><strong>{t('bridgeFlow.pastePrompt')}</strong><p>{t('bridgeFlow.pastePromptHint')}</p></div>
                  <button className={primaryClass} disabled={busy} onClick={() => run(async () => {
                    if (!await geminiBridgeService.copyText(pending.prompt)) throw new Error('clipboard');
                    updateHandoffFlags({ copiedPrompt: true }); setBridgeMessage(t('bridgeFlow.promptCopied'));
                  }, t('bridgeFlow.copyPromptFailed'))}>{pending.copiedPrompt ? <Check size={16} /> : <Copy size={16} />}{t('bridgeFlow.copyRequest')}</button></li>
                <li><div><strong>{t('bridgeFlow.download')}</strong><p>{t('bridgeFlow.downloadHint')}</p></div>
                  <button className={buttonClass} disabled={busy} onClick={() => goTo('result')}><ArrowRight size={16} />{t('bridgeFlow.result')}</button></li>
              </ol>
              <details className="bridge-details"><summary>{t('bridgeFlow.transferOptions')}<ChevronDown size={16} /></summary><div className="bridge-stack">
                <div className="bridge-actions">
                  {window.electronAPI && <button className={buttonClass} disabled={busy} onClick={() => run(prepareFiles, t('flow.filesFailed'))}><FolderOpen size={16} />{t('flow.files')}</button>}
                  <button className={buttonClass} disabled={busy} onClick={() => run(async () => {
                    const input = handoffImage();
                    if (!await geminiBridgeService.prepareTempFileAndReveal(input.image, 'gemini-source.png', input.mime)) throw new Error('file');
                    setBridgeMessage(t('bridge.tempReady'));
                  }, t('bridgeFlow.copyImageFailed'))}><FolderOpen size={16} />{t('bridge.revealFile')}</button>
                  <button className={buttonClass} disabled={busy} onClick={() => setPending(null)}>{t('bridgeFlow.restart')}</button>
                </div>
                <textarea className={controlClass} aria-label={t('bridgeFlow.prompt')} rows={5} readOnly value={pending.prompt} onFocus={(event) => event.currentTarget.select()} />
              </div></details>
            </>}
          </div>}

          {(step === 'gemini' || step === 'result') && pending && !packageHandoff && downloads.length > 0 && <div className="bridge-downloads">
            <h3>{t('bridgeFlow.foundDownloads')}</h3>
            {downloads.map((item) => <div key={item.filePath} className="bridge-download">
              <span><Download size={16} />{item.fileName}</span><button className={primaryClass} disabled={busy || item.byteLength > 50 * 1024 * 1024}
                onClick={() => run(async () => {
                  if (pending.mode === 'flow' || pending.mode === 'flux') return;
                  const data = await window.electronAPI?.readRecentGeminiImage(pending.mode, pending.since, item.filePath);
                  if (!data) throw new Error('read-download');
                  await importResult(imageFileFromBase64(data.base64, data.fileName, data.mimeType), item.filePath);
                }, t('bridge.importFailed'))}>{t(item.byteLength > 50 * 1024 * 1024 ? 'bridgeFlow.tooLarge' : 'bridge.importResult')}</button>
            </div>)}
          </div>}

          {step === 'result' && <div className="bridge-stack">
            {resultLoading && <p role="status" className="bridge-muted">{t('app.loadingView')}</p>}
            {importedResult && sourceImage && <>
              <figure className="bridge-comparison">
                <div className="bridge-compare-images" style={{ aspectRatio: importedResult.width / importedResult.height }}>
                  <img src={toImageDataUrl(importedResult.imageBase64, importedResult.mimeType)} alt={t('bridge.renderLabel')} />
                  <img src={toImageDataUrl(sourceImage, sourceMimeType)} alt={t('bridge.sourceLabel')} style={{ clipPath: 'inset(0 ' + (100 - sliderPosition) + '% 0 0)' }} />
                  <span className="bridge-divider" style={{ left: sliderPosition + '%' }} />
                </div>
                <label className="bridge-range"><span>{t('bridge.sourceLabel')}</span><input aria-label={t('bridge.compareTitle')} type="range" min={0} max={100}
                  value={sliderPosition} onChange={(event) => setSliderPosition(Number(event.target.value))} /><span>{t('bridge.renderLabel')}</span></label>
              </figure>
              <div className="bridge-actions">
                <button className={primaryClass} onClick={() => downloadResult(importedResult)}><Download size={17} />{t('bridge.saveImage')}</button>
                <button className={buttonClass} aria-expanded={upscaleOpen} onClick={() => setUpscaleOpen((open) => !open)}><Sparkles size={16} />{t('cloudUpscale.title')}</button>
                <button className={buttonClass} aria-expanded={flowUpscaleOpen} onClick={() => setFlowUpscaleOpen((open) => !open)}><Sparkles size={16} />{t('flow.upscale')}</button>
              </div>
              {upscaleOpen && <CloudUpscalePanel key={importedResult.id} result={importedResult} onSettings={onNavigateSettings} />}
              {flowUpscaleOpen && <div className="bridge-cloud bridge-stack">
                <p className="bridge-muted">{t('flow.upscaleHint')}</p>
                <div className="bridge-actions">
                  <button className={buttonClass} disabled={busy} onClick={() => run(() => openBridgePage(flowUrl), t('flow.openFailed'))}><ExternalLink size={16} />{t('flow.open')}</button>
                  <button className={buttonClass} onClick={() => downloadResult(importedResult)}><Download size={16} />{t('bridge.saveImage')}</button>
                  <button className={buttonClass} disabled={busy} onClick={() => { setFlowUpscalePicker(true); fileInputRef.current?.click(); }}>{t('bridge.importResult')}</button>
                </div>
              </div>}
              <details className="bridge-details"><summary>{t('bridgeFlow.refine')}<ChevronDown size={16} /></summary><div className="bridge-stack">
                <textarea className={controlClass} aria-label={t('bridgeFlow.refine')} placeholder={t('bridgeFlow.refinePlaceholder')} rows={2}
                  value={refinementText} onChange={(event) => setRefinementText(event.target.value)} />
                <button className={primaryClass} disabled={busy || !refinementText.trim()} onClick={() => run(() => startGemini('browser', true), t('bridge.openFailed'))}>
                  <ExternalLink size={16} />{t('bridgeFlow.openRefinement')}</button>
                <button className={buttonClass} disabled={busy || !refinementText.trim()} onClick={() => run(() => startGemini('flow', true), t('flow.openFailed'))}><ExternalLink size={16} />{t('flow.refine')}</button>
              </div></details>
              <details className="bridge-details"><summary>{t('bridgeFlow.designActions')}<ChevronDown size={16} /></summary><div className="bridge-actions">
                <button className={buttonClass} disabled={busy} onClick={() => run(handleApproveDesign)}>{t('bridge.approveAsMaster')}</button>
                <button className={buttonClass} disabled={busy} onClick={() => run(handleSaveDesignVariant)}>{t('bridge.saveVariant')}</button>
              </div></details>
            </>}
            <button className={'bridge-dropzone bridge-result-drop' + (draggingResult ? ' is-dragging' : '')} disabled={busy || !ready}
              onClick={() => { setFlowUpscalePicker(false); fileInputRef.current?.click(); }} onDragOver={(event) => { event.preventDefault(); setDraggingResult(true); }}
              onDragLeave={() => setDraggingResult(false)} onDrop={(event) => { setDraggingResult(false); dropFile(event, importResult); }}>
              <ImageIcon size={25} /><strong>{t(importedResult ? 'bridgeFlow.importAnother' : 'bridgeFlow.chooseResult')}</strong><span>{t('bridgeFlow.dropHint')}</span>
            </button>
            {window.electronAPI && <button className={buttonClass} disabled={busy || !ready} onClick={() => run(async () => {
              if (pending && !pending.copiedPrompt) { setErrorMessage(t('bridgeFlow.clipboardPromptFirst')); return; }
              const image = await window.electronAPI?.readGeminiClipboardImage();
              if (!image) { setErrorMessage(t('bridgeFlow.noClipboardImage')); return; }
              await importResult(imageFileFromBase64(image, 'Gemini.png', 'image/png'));
            }, t('bridge.importFailed'))}><Clipboard size={16} />{t('bridgeFlow.pasteResult')}</button>}
          </div>}

          {(busy || errorMessage || bridgeMessage) && <div className="bridge-feedback" role={errorMessage ? 'alert' : 'status'}>
            {busy ? t('bridgeFlow.working') : errorMessage ? <span className="bridge-error">{errorMessage}</span> : <><Check size={16} />{bridgeMessage}</>}
          </div>}
          <footer className="bridge-footer">
            {step !== 'source' ? <button className={buttonClass} disabled={busy} onClick={() => goTo(steps[steps.indexOf(step) - 1])}><ArrowLeft size={16} />{t('bridgeFlow.back')}</button> : <span />}
            {step === 'source' && ready && <button className={primaryClass} disabled={busy} onClick={() => goTo('design')}>{t('bridgeFlow.nextDesign')}<ArrowRight size={17} /></button>}
            {step === 'design' && <button className={primaryClass} disabled={busy || !ready || !generatedPrompt.trim()} onClick={() => {
              if (pending && pending.prompt !== generatedPrompt) setPending(null);
              goTo('gemini');
            }}>{t('flow.next')}<ArrowRight size={17} /></button>}
          </footer>
        </section>
      </div>
    </div>
  );
};
