import React, { lazy, Suspense, useState, useEffect } from 'react';
import { TitleBar } from './components/layout/TitleBar';
import { Sidebar, ActiveTab } from './components/layout/Sidebar';
const GenerationStudioView = lazy(() => import('./views/GenerationStudioView').then((module) => ({ default: module.GenerationStudioView })));
const ProjectsView = lazy(() => import('./views/ProjectsView').then((module) => ({ default: module.ProjectsView })));
const HistoryView = lazy(() => import('./views/HistoryView').then((module) => ({ default: module.HistoryView })));
const SettingsView = lazy(() => import('./views/SettingsView').then((module) => ({ default: module.SettingsView })));
const GeminiBridgeView = lazy(() => import('./views/GeminiBridgeView').then((module) => ({ default: module.GeminiBridgeView })));
const TrainingStudioView = lazy(() => import('./views/TrainingStudioView').then((module) => ({ default: module.TrainingStudioView })));
import { AuthModal } from './views/AuthModal';
const UpscaleModal = lazy(() => import('./components/UpscaleModal').then((module) => ({ default: module.UpscaleModal })));
import { Project, RoomType } from './types/project';
import { dbService } from './services/db';
import { geminiProvider } from './services/ai/GeminiProvider';
import { authService } from './services/authService';
import { ROOM_TYPES } from './services/promptBuilder';
import { X } from 'lucide-react';
import { useI18n } from './i18n/i18nContext';

export const App: React.FC = () => {
  const { t, language } = useI18n();
  const [activeTab, setActiveTab] = useState<ActiveTab>('studio');
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState<boolean>(false);
  const [isGlobalUpscaleOpen, setIsGlobalUpscaleOpen] = useState<boolean>(false);
  const [pendingArchicadFile, setPendingArchicadFile] = useState<string | null>(null);

  // New project modal form state
  const [newProjectName, setNewProjectName] = useState<string>('');
  const [newProjectRoomType, setNewProjectRoomType] = useState<RoomType>('living_room');

  useEffect(() => {
    // 1. Check API Key
    const checkApiKey = async () => {
      let key = '';
      if (window.electronAPI) {
        key = (await window.electronAPI.getSecureItem('gemini_api_key')) || '';
      } else {
        key = localStorage.getItem('gemini_api_key') || '';
      }
      if (key) {
        geminiProvider.setApiKey(key);
      }
    };
    checkApiKey();

    // 2. Check Auth Status: If first launch and not authenticated, show welcome auth modal
    void authService.whenReady().then(() => {
      const authState = authService.getState();
      if (!authState.isAuthenticated && !authState.isGuest) setIsAuthModalOpen(true);
    });

    // 3. Load or initialize default project
    dbService.getAllProjects().then((projects) => {
      if (projects.length > 0) {
        setCurrentProject(projects[0]);
      } else if (localStorage.getItem('interior_ai_projects_cleared') !== 'true') {
        // Create initial default project
        const defaultProj: Project = {
          id: 'proj_' + Date.now(),
          name: 'Archicad // Perspective 01',
          description: 'Default interior visualization project',
          roomType: 'living_room',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        dbService.saveProject(defaultProj);
        setCurrentProject(defaultProj);
      }
    });
  }, []);

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onArchicadFileDetected((event) => {
      setPendingArchicadFile(event.path);
      setActiveTab('studio');
    });
    return () => unsubscribe?.();
  }, []);

  const handleCreateNewProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    const newProj: Project = {
      id: 'proj_' + Date.now(),
      name: newProjectName.trim(),
      roomType: newProjectRoomType,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await dbService.saveProject(newProj);
    localStorage.removeItem('interior_ai_projects_cleared');
    setCurrentProject(newProj);
    setIsNewProjectModalOpen(false);
    setNewProjectName('');
    setActiveTab('studio');
  };

  const handleSelectProject = (project: Project) => {
    setCurrentProject(project);
    setActiveTab('studio');
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-studio-bg font-sans">
      {/* Native-feel Studio Titlebar */}
      <TitleBar
        currentProjectName={currentProject?.name}
        onOpenSettings={() => setActiveTab('settings')}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenUpscale={() => setIsGlobalUpscaleOpen(true)}
      />

      {/* Main App Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onNewProject={() => setIsNewProjectModalOpen(true)}
        />

        {/* Dynamic View Panes */}
        <main className="flex-1 flex overflow-hidden">
          <Suspense fallback={<div className="flex-1 grid place-items-center text-studio-textMuted text-sm">{t('app.loadingView')}</div>}>
          {activeTab === 'studio' && (
            <GenerationStudioView
              currentProject={currentProject}
              onUpdateProject={setCurrentProject}
              onNavigateSettings={() => setActiveTab('settings')}
              pendingArchicadFile={pendingArchicadFile}
              onArchicadFileLoaded={() => setPendingArchicadFile(null)}
            />
          )}

          {activeTab === 'gemini_bridge' && (
            <GeminiBridgeView
              currentProject={currentProject}
              onUpdateProject={setCurrentProject}
              onNavigateStudio={() => setActiveTab('studio')}
            />
          )}

          {activeTab === 'projects' && (
            <ProjectsView
              onSelectProject={handleSelectProject}
              onNewProject={() => setIsNewProjectModalOpen(true)}
              onLocalDataCleared={() => setCurrentProject(null)}
            />
          )}

          {activeTab === 'training' && <TrainingStudioView />}

          {activeTab === 'history' && <HistoryView />}

          {activeTab === 'settings' && <SettingsView />}
          </Suspense>
        </main>
      </div>

      {/* Welcome Google Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* New Project Creation Modal */}
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-studio-surface border border-studio-border rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-studio-border">
              <h3 className="font-semibold text-sm text-white">{t('projects.newProjectModalTitle')}</h3>
              <button
                onClick={() => setIsNewProjectModalOpen(false)}
                className="text-studio-textMuted hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewProject} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-studio-textMuted">
                  {t('projects.projectNameLabel')}
                </label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder={t('projects.projectNamePlaceholder')}
                  className="w-full bg-studio-bg border border-studio-border focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-studio-text focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-studio-textMuted">
                  {t('inspector.roomType')}
                </label>
                <select
                  value={newProjectRoomType}
                  onChange={(e) => setNewProjectRoomType(e.target.value as RoomType)}
                  className="w-full bg-studio-bg border border-studio-border focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-studio-text focus:outline-none"
                >
                  {ROOM_TYPES.map((r) => {
                    const roomLabel =
                      language === 'uk'
                        ? r.labelUk || r.labelRu
                        : language === 'en'
                        ? r.labelEn || r.labelRu
                        : r.labelRu;
                    return (
                      <option key={r.id} value={r.id}>
                        {roomLabel}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewProjectModalOpen(false)}
                  className="px-3 py-2 rounded-lg text-xs text-studio-textMuted hover:text-white"
                >
                  {t('action.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md transition-colors"
                >
                  {t('action.createProject')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Global AI 4K Upscale Modal */}
      {isGlobalUpscaleOpen && (
        <Suspense fallback={null}>
          <UpscaleModal
            isOpen={isGlobalUpscaleOpen}
            onClose={() => setIsGlobalUpscaleOpen(false)}
            imageBase64={currentProject?.sourceImageBase64 || ''}
            sourceWidth={1344}
            sourceHeight={768}
          />
        </Suspense>
      )}
    </div>
  );
};
