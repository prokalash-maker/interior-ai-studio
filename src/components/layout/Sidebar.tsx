import React from 'react';
import {
  Wand2,
  FolderKanban,
  History,
  Settings,
  Plus,
  Cpu,
  Globe,
  PanelTop,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/i18nContext';

export type ActiveTab = 'studio' | 'gemini_bridge' | 'projects' | 'history' | 'training' | 'settings';

interface SidebarProps {
  activeTab: ActiveTab;
  expertMode: boolean;
  onTabChange: (tab: ActiveTab) => void;
  onNewProject: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, expertMode, onTabChange, onNewProject }) => {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('studio_sidebar_collapsed') === 'true');
  useEffect(() => {
    localStorage.setItem('studio_sidebar_collapsed', String(collapsed));
  }, [collapsed]);
  const groups = [
    {
      title: t('sidebar.workspace'),
      items: [
        { id: 'gemini_bridge' as ActiveTab, label: t('sidebar.geminiBridge'), icon: Globe },
        { id: 'projects' as ActiveTab, label: t('sidebar.myProjects'), icon: FolderKanban },
        { id: 'history' as ActiveTab, label: t('sidebar.history'), icon: History },
      ],
    },
    ...(expertMode ? [{
      title: t('sidebar.tools'),
      items: [
        { id: 'studio' as ActiveTab, label: t('sidebar.generation'), icon: Wand2 },
        { id: 'training' as ActiveTab, label: t('sidebar.loraStudio'), icon: Cpu },
      ],
    }] : []),
  ];

  return (
    <aside className={`${collapsed ? 'w-[68px]' : 'w-[232px]'} max-[900px]:w-[68px] shrink-0 bg-studio-surface border-r border-studio-border flex flex-col justify-between select-none transition-[width] duration-200`}>
      <div className={`${collapsed ? 'p-2.5' : 'p-4'} max-[900px]:p-2.5 space-y-7`}>
        <div className="space-y-4">
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} max-[900px]:justify-center px-1 pt-1`}>
            <div className="w-9 h-9 rounded-xl bg-studio-accent/15 border border-studio-accent/25 flex items-center justify-center text-studio-accent">
              <PanelTop className="w-4 h-4" />
            </div>
            {!collapsed && <div className="min-w-0 max-[900px]:hidden">
              <div className="text-[12px] font-semibold tracking-tight text-studio-text">AI Designer</div>
              <div className="text-[9px] tracking-[0.12em] uppercase text-studio-textSubtle">V1PERCOREJZ</div>
            </div>}
          </div>
          <button
            onClick={onNewProject}
            title={t('action.newProject')}
            aria-label={t('action.newProject')}
            className={`w-full flex items-center ${collapsed ? 'justify-center' : 'justify-center gap-2'} py-2.5 px-2 rounded-lg bg-studio-accent hover:bg-studio-accentHover text-[#171a14] font-semibold text-xs transition-colors active:scale-[0.99]`}
          >
            <Plus className="w-4 h-4" />
            {!collapsed && <span className="max-[900px]:hidden">{t('action.newProject')}</span>}
          </button>
        </div>

        <nav className="space-y-6">
          {groups.map((group) => (
            <div key={group.title} className="space-y-1">
              {!collapsed && <div className="px-3 mb-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-studio-textSubtle max-[900px]:hidden">{group.title}</div>}
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    title={item.label}
                    aria-label={item.label}
                    aria-current={isActive ? 'page' : undefined}
                    className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-3'} max-[900px]:justify-center px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-studio-accent/12 text-studio-text ring-1 ring-inset ring-studio-accent/25'
                        : 'text-studio-textMuted hover:text-studio-text hover:bg-studio-surfaceLight'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-studio-accent' : 'text-studio-textSubtle'}`} />
                    {!collapsed && <span className="max-[900px]:hidden">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      <div className={`${collapsed ? 'p-2.5' : 'p-4'} border-t border-studio-border space-y-2`}>
        <button
          onClick={() => setCollapsed((value) => !value)}
          className="w-full flex items-center justify-center gap-2 px-2 py-2 rounded-lg text-studio-textSubtle hover:text-studio-text hover:bg-studio-surfaceLight transition-colors max-[900px]:hidden"
          title={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
          aria-label={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <><PanelLeftClose className="w-4 h-4" /><span className="text-[10px]">{t('sidebar.collapse')}</span></>}
        </button>
        <button
          onClick={() => onTabChange('settings')}
          title={t('sidebar.settings')}
          aria-label={t('sidebar.settings')}
          className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-3'} max-[900px]:justify-center px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'settings'
              ? 'bg-studio-accent/12 text-studio-text ring-1 ring-inset ring-studio-accent/25'
              : 'text-studio-textMuted hover:text-studio-text hover:bg-studio-surfaceLight'
          }`}
        >
          <Settings className={`w-4 h-4 ${activeTab === 'settings' ? 'text-studio-accent' : 'text-studio-textSubtle'}`} />
          {!collapsed && <span className="max-[900px]:hidden">{t('sidebar.settings')}</span>}
        </button>
      </div>
    </aside>
  );
};
