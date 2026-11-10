import React, { useState, useEffect, useRef } from 'react';
import {
  FolderKanban,
  Plus,
  CopyPlus,
  Upload,
  DatabaseZap,
  Download,
  Trash2,
  Calendar,
  Layers,
  ArrowRight,
  Search,
  Building,
  Image as ImageIcon
} from 'lucide-react';
import { GenerationRecord, Project, RoomType, RoomTypeOption } from '../types/project';
import { dbService } from '../services/db';
import { ROOM_TYPES } from '../services/promptBuilder';
import { useI18n } from '../i18n/i18nContext';

interface ProjectsViewProps {
  onSelectProject: (project: Project) => void;
  onNewProject: () => void;
  onLocalDataCleared: () => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  onSelectProject,
  onNewProject,
  onLocalDataCleared,
}) => {
  const { t, language } = useI18n();
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRoom, setFilterRoom] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [clearingData, setClearingData] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const getRoomLabel = (r: RoomTypeOption) => (language === 'uk' ? r.labelUk : language === 'en' ? r.labelEn : r.labelRu);

  const loadProjects = async () => {
    setLoading(true);
    const data = await dbService.getAllProjects();
    setProjects(data);
    setLoading(false);
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(t('projects.deleteConfirm'))) {
      await dbService.deleteProject(id);
      loadProjects();
    }
  };

  const handleDuplicate = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    const now = Date.now();
    const cloneId = crypto.randomUUID();
    const viewIdMap = new Map((project.views || []).map((view) => [view.id, crypto.randomUUID()]));
    const clone: Project = {
      ...project,
      id: cloneId,
      name: `${project.name} — ${t('projects.copySuffix')}`,
      createdAt: now,
      updatedAt: now,
      thumbnailPath: '',
      generationsCount: 0,
      views: project.views?.map((view) => ({ ...view, id: viewIdMap.get(view.id)!, updatedAt: now })),
      approvedDesign: project.approvedDesign ? { ...project.approvedDesign, masterViewId: '', masterGenerationId: undefined, approvedAt: now } : undefined,
    };
    await dbService.saveProject(clone);
    const generations = await dbService.getGenerationsForProject(project.id);
    const idMap = new Map(generations.map((generation) => [generation.id, crypto.randomUUID()]));
    if (clone.views) clone.views = clone.views.map((view) => ({ ...view, resultGenerationId: view.resultGenerationId ? idMap.get(view.resultGenerationId) : undefined }));
    for (const generation of generations) {
      await dbService.saveGeneration({
        ...generation,
        id: idMap.get(generation.id)!,
        projectId: cloneId,
        parentId: generation.parentId ? idMap.get(generation.parentId) : undefined,
        viewId: generation.viewId ? viewIdMap.get(generation.viewId) : undefined,
      });
    }
    if (clone.approvedDesign) {
      clone.approvedDesign.masterGenerationId = project.approvedDesign?.masterGenerationId ? idMap.get(project.approvedDesign.masterGenerationId) : undefined;
      clone.approvedDesign.masterViewId = project.approvedDesign ? viewIdMap.get(project.approvedDesign.masterViewId) || '' : '';
    }
    clone.updatedAt = now;
    await dbService.saveProject(clone);
    await loadProjects();
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 500 * 1024 * 1024) throw new Error(t('projects.importTooLarge'));
      const data = JSON.parse(await file.text());
      const isProjectBundle = data?.format === 'interior-ai-studio-project' && data?.version === 1 && data?.project?.name && Array.isArray(data.generations);
      const bundles = isProjectBundle ? [data] : data?.format === 'interior-ai-studio-backup' && data?.version === 1 && Array.isArray(data.projects) ? data.projects : null;
      if (!bundles || bundles.length > 200 || bundles.some((item: any) => !item?.project?.name || !Array.isArray(item.generations)) || bundles.reduce((sum: number, item: any) => sum + item.generations.length, 0) > 10000) {
        throw new Error(t('projects.invalidBackup'));
      }
      for (const bundle of bundles) {
        const sourceProject = bundle.project as Project;
        const projectId = crypto.randomUUID();
        const viewIdMap = new Map((sourceProject.views || []).map((view) => [view.id, crypto.randomUUID()]));
        const project: Project = {
          ...sourceProject,
          id: projectId,
          name: `${sourceProject.name} — ${t('projects.importedSuffix')}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          views: sourceProject.views?.map((view) => ({ ...view, id: viewIdMap.get(view.id)!, updatedAt: Date.now() })),
          approvedDesign: sourceProject.approvedDesign ? { ...sourceProject.approvedDesign, masterViewId: viewIdMap.get(sourceProject.approvedDesign.masterViewId) || '' } : undefined,
        };
        const generations = (bundle.generations as GenerationRecord[]).filter((generation) => generation?.id && generation?.prompt && generation?.outputImageBase64);
        const idMap = new Map<string, string>(generations.map((generation) => [generation.id, crypto.randomUUID()]));
        if (project.views) project.views = project.views.map((view) => ({ ...view, resultGenerationId: view.resultGenerationId ? idMap.get(view.resultGenerationId) : undefined }));
        if (project.approvedDesign?.masterGenerationId) project.approvedDesign.masterGenerationId = idMap.get(project.approvedDesign.masterGenerationId);
        await dbService.saveProject(project);
        for (const generation of generations) {
          await dbService.saveGeneration({
            ...generation,
            id: idMap.get(generation.id)!,
            projectId,
            parentId: generation.parentId ? idMap.get(generation.parentId) : undefined,
            viewId: generation.viewId ? viewIdMap.get(generation.viewId) : undefined,
          });
        }
        project.updatedAt = Date.now();
        await dbService.saveProject(project);
      }
      await loadProjects();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : t('projects.invalidBackup'));
    }
  };

  const handleClearLocalData = async () => {
    if (!window.confirm(t('projects.clearConfirm'))) return;
    if (!window.confirm(t('projects.clearConfirmAgain'))) return;
    setClearingData(true);
    try {
      await dbService.clearAllProjectData();
      setProjects([]);
      onLocalDataCleared();
      setSearchQuery('');
      setFilterRoom('all');
    } catch (error) {
      window.alert(error instanceof Error ? error.message : t('projects.clearFailed'));
    } finally {
      setClearingData(false);
    }
  };

  const handleExport = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    const generations = await dbService.getGenerationsForProject(project.id);
    const bundle = { format: 'interior-ai-studio-project', version: 1, exportedAt: new Date().toISOString(), project: { ...project, thumbnailPath: '' }, generations };
    const content = JSON.stringify(bundle);
    const blob = new Blob([content], { type: 'application/json' });
    if (blob.size > 500 * 1024 * 1024) {
      window.alert(t('projects.backupExportTooLarge'));
      return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${project.name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim() || 'Interior-AI-Project'}.interior-ai.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleExportAll = async () => {
    const bundles = await Promise.all(projects.map(async (project) => ({
      project: { ...project, thumbnailPath: '' },
      generations: await dbService.getGenerationsForProject(project.id),
    })));
    const backup = { format: 'interior-ai-studio-backup', version: 1, exportedAt: new Date().toISOString(), projects: bundles };
    const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
    if (blob.size > 500 * 1024 * 1024) {
      window.alert(t('projects.backupExportTooLarge'));
      return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `Interior-AI-Studio_Backup_${new Date().toISOString().slice(0, 10)}.interior-ai.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const filtered = projects.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterRoom === 'all' || p.roomType === filterRoom;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-studio-bg text-studio-text select-none">
      {/* Top Header */}
      <div className="h-14 border-b border-studio-border px-6 flex items-center justify-between bg-studio-surface/60">
        <div className="flex items-center space-x-3">
          <FolderKanban className="w-5 h-5 text-indigo-400" />
          <h1 className="text-base font-semibold text-white">{t('projects.title')}</h1>
          <span className="text-xs text-studio-textSubtle bg-studio-surfaceLight px-2 py-0.5 rounded-full font-mono">
            {projects.length}
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleExportAll}
            disabled={projects.length === 0}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            title={t('projects.backupAll')}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('projects.backupAll')}</span>
          </button>
          <input ref={importInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImport} />
          <button
            onClick={() => importInputRef.current?.click()}
            className="px-3 py-1.5 bg-studio-surfaceHover hover:bg-studio-border text-studio-text rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{t('projects.import')}</span>
          </button>
          <button
            onClick={handleClearLocalData}
            disabled={clearingData}
            className="px-3 py-1.5 bg-rose-950/50 hover:bg-rose-900/70 border border-rose-800/60 disabled:opacity-50 text-rose-200 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            title={t('projects.clearLocalData')}
          >
            <DatabaseZap className="w-3.5 h-3.5" />
            <span>{clearingData ? t('projects.clearing') : t('projects.clearLocalData')}</span>
          </button>
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-studio-textSubtle absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('projects.searchPlaceholder')}
              className="bg-studio-bg border border-studio-border focus:border-indigo-500 rounded-lg pl-8 pr-3 py-1.5 text-xs text-studio-text focus:outline-none w-48 transition-colors"
            />
          </div>

          {/* Room filter */}
          <select
            value={filterRoom}
            onChange={(e) => setFilterRoom(e.target.value)}
            className="bg-studio-bg border border-studio-border focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs text-studio-text focus:outline-none"
          >
            <option value="all">{t('projects.allRooms')}</option>
            {ROOM_TYPES.map((r) => (
              <option key={r.id} value={r.id}>
                {getRoomLabel(r)}
              </option>
            ))}
          </select>

          {/* New Project CTA */}
          <button
            onClick={onNewProject}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md flex items-center space-x-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('projects.createProject')}</span>
          </button>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-studio-surfaceHover flex items-center justify-center text-studio-textSubtle mb-4">
              <FolderKanban className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">{t('projects.emptyTitle')}</h3>
            <p className="text-xs text-studio-textMuted max-w-sm mb-4">
              {t('projects.emptyDesc')}
            </p>
            <button
              onClick={onNewProject}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium shadow-md transition-colors"
            >
              {t('projects.createFirst')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((project) => {
              const room = ROOM_TYPES.find((r) => r.id === project.roomType) || ROOM_TYPES[0];
              const dateStr = new Date(project.updatedAt).toLocaleDateString(
                language === 'uk' ? 'uk-UA' : language === 'en' ? 'en-US' : 'ru-RU',
                {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                }
              );

              return (
                <div
                  key={project.id}
                  onClick={() => onSelectProject(project)}
                  className="group bg-studio-surface hover:bg-studio-surfaceHover border border-studio-border hover:border-indigo-500/50 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 shadow-sm flex flex-col justify-between"
                >
                  {/* Thumbnail */}
                  <div className="h-40 bg-studio-bg relative overflow-hidden flex items-center justify-center">
                    {project.thumbnailPath ? (
                      <img
                        src={project.thumbnailPath}
                        alt={project.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : project.sourceImageBase64 ? (
                      <img
                        src={project.sourceImageBase64}
                        alt={project.name}
                        className="w-full h-full object-cover opacity-70 group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="text-center text-studio-textSubtle">
                        <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-40" />
                        <span className="text-[11px]">{t('projects.noRender')}</span>
                      </div>
                    )}

                    <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono text-white/90">
                      {getRoomLabel(room)}
                    </div>

                    <button
                      onClick={(e) => handleExport(project, e)}
                      className="absolute top-2 right-11 p-1.5 bg-black/60 hover:bg-indigo-600 rounded text-white/80 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                      title={t('projects.export')}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDuplicate(project, e)}
                      className="absolute top-2 right-20 p-1.5 bg-black/60 hover:bg-indigo-600 rounded text-white/80 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                      title={t('projects.duplicate')}
                    >
                      <CopyPlus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(project.id, e)}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-studio-danger rounded text-white/80 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                      title={t('action.delete')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="p-3.5">
                    <h3 className="font-semibold text-xs text-white truncate mb-1">
                      {project.name}
                    </h3>
                    <div className="flex items-center justify-between text-[11px] text-studio-textSubtle mt-2">
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>{dateStr}</span>
                      </span>
                      <span className="font-mono text-indigo-400">
                        {t('projects.versionsCount', { count: project.generationsCount || 0 })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
