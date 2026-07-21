import React, { useState, useEffect, useCallback, memo } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  FileText, 
  CreditCard, 
  Settings, 
  Sun, 
  Moon, 
  Search, 
  ChevronLeft, 
  ChevronRight
} from 'lucide-react';
import { useTheme } from '@/shared/hooks/useTheme';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { Avatar } from '@/shared/ui/Containers';
import { UjratLogo } from '@/shared/ui/UjratLogo';
import { CommandPalette } from './CommandPalette';
import { MobileLayout } from './MobileLayout';

// ─── Module-level constant — never recreated on render ────────────────────────
const NAV_ITEMS = [
  { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
  { id: 'clients',   name: 'Clients',   icon: Users },
  { id: 'projects',  name: 'Projects',  icon: Briefcase },
  { id: 'invoices',  name: 'Invoices',  icon: FileText },
  { id: 'payments',  name: 'Payments',  icon: CreditCard },
  { id: 'settings',  name: 'Settings',  icon: Settings },
] as const;

// ─── NavButton extracted + memoized ──────────────────────────────────────────
interface NavButtonProps {
  item: { id: string; name: string; icon: React.ElementType };
  isActive: boolean;
  expanded: boolean;
  mobile?: boolean;
  onViewChange: (id: string) => void;
  onMobileClose?: () => void;
}

const NavButton = memo(({ item, isActive, expanded, mobile = false, onViewChange, onMobileClose }: NavButtonProps) => {
  const Icon = item.icon;
  return (
    <button
      onClick={() => { onViewChange(item.id); if (mobile && onMobileClose) onMobileClose(); }}
      title={item.name}
      className={`group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-all duration-150 cursor-pointer ${
        isActive ? 'bg-primary-muted text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-surface/60'
      }`}
    >
      <Icon className={`h-4 w-4 shrink-0 transition-transform ${isActive ? 'text-primary' : 'group-hover:scale-105'}`} strokeWidth={2} />
      {(expanded || mobile) && <span className="truncate">{item.name}</span>}
      {isActive && !expanded && !mobile && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3.5 bg-primary rounded-full" aria-hidden="true" />
      )}
    </button>
  );
});
NavButton.displayName = 'NavButton';

interface DashboardLayoutProps {
  children: React.ReactNode;
  currentView: string;
  onViewChange: (view: string) => void;
  breadcrumbs: string[];
  user?: any;
  workspaceId: string;
  profileId: string;
  onQuickAction?: (actionType: 'client' | 'project' | 'invoice') => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  currentView,
  onViewChange,
  breadcrumbs,
  user,
  workspaceId,
  profileId,
  onQuickAction,
}) => {
  const isMobile = useIsMobile(768);
  const { theme, toggleTheme } = useTheme();
  const [expanded, setExpanded] = useState(() => {
    const saved = localStorage.getItem('ujrat_sidebar_expanded');
    return saved !== 'false';
  });
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Freelancer';
  const userEmail = user?.email || '';
  const pageTitle = breadcrumbs[breadcrumbs.length - 1] || 'Workspace';

  useEffect(() => {
    localStorage.setItem('ujrat_sidebar_expanded', String(expanded));
  }, [expanded]);

  // Handle Ctrl+K globally
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleExpandSidebar = useCallback(() => setExpanded(true), []);
  const handleCollapseSidebar = useCallback(() => setExpanded(false), []);
  const handleOpenCommandPalette = useCallback(() => setCommandPaletteOpen(true), []);
  const handleCloseCommandPalette = useCallback(() => setCommandPaletteOpen(false), []);

  // Delegate mobile viewport rendering to dedicated MobileLayout
  if (isMobile) {
    return (
      <MobileLayout
        currentView={currentView}
        onViewChange={onViewChange}
        pageTitle={pageTitle}
        breadcrumbs={breadcrumbs}
        user={user}
        workspaceId={workspaceId}
        profileId={profileId}
        onQuickAction={onQuickAction}
      >
        {children}
      </MobileLayout>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col fixed inset-y-0 left-0 z-30 bg-surface border-r border-border transition-all duration-200 ease-out select-none ${
          expanded ? 'w-[220px]' : 'w-[60px]'
        }`}
      >
        {/* Sidebar Header */}
        <div className="flex h-14 items-center justify-between px-3.5 shrink-0 border-b border-border-subtle">
          <div className="flex items-center gap-2.5 min-w-0">
            <UjratLogo size={28} />
            {expanded && (
              <span className="font-display font-semibold text-[14px] text-foreground tracking-tight truncate animate-fade-in">
                Ujrat
              </span>
            )}
          </div>
          {expanded && (
            <button
              onClick={handleCollapseSidebar}
              className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
              title="Collapse sidebar"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Global Search shortcut trigger */}
        <div className="px-2 pt-3 pb-1 shrink-0">
          <button
            onClick={handleOpenCommandPalette}
            className={`flex items-center gap-2 w-full rounded border border-border bg-card px-2.5 py-1.5 text-left text-[11px] text-muted-foreground/60 hover:border-muted-foreground/35 hover:text-muted-foreground cursor-pointer transition-all duration-150 ${
              expanded ? 'justify-between' : 'justify-center'
            }`}
          >
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
              {expanded && <span className="truncate">Search workspace</span>}
            </div>
            {expanded && (
              <span className="text-[9px] font-bold border border-border px-1 py-0.5 rounded bg-surface font-mono shrink-0 uppercase tracking-widest leading-none">
                ⌘K
              </span>
            )}
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 px-2 py-3.5 space-y-0.5 overflow-hidden">
          {NAV_ITEMS.map(item => (
            <NavButton key={item.id} item={item} isActive={currentView === item.id} expanded={expanded} onViewChange={onViewChange} />
          ))}

          {/* Collapsed Expand Toggle */}
          {!expanded && (
            <div className="pt-2 border-t border-border-subtle mt-2 flex justify-center">
              <button
                onClick={handleExpandSidebar}
                className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
                title="Expand sidebar"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </nav>

        {/* Sidebar Footer */}
        <div className="px-2 py-3 space-y-1.5 shrink-0 border-t border-border-subtle">
          <button
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-muted-foreground hover:text-foreground hover:bg-surface/60 transition-colors cursor-pointer text-[13px] font-medium"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 shrink-0 text-warning" strokeWidth={2} />
            ) : (
              <Moon className="h-4 w-4 shrink-0 text-primary" strokeWidth={2} />
            )}
            {expanded && <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
          </button>

          <div className={`flex items-center gap-2 px-2 py-1.5 ${expanded ? '' : 'justify-center border-t border-border-subtle pt-2'}`}>
            <Avatar name={userName} size="sm" />
            {expanded && (
              <div className="min-w-0 animate-fade-in">
                <p className="text-[12px] font-semibold text-foreground truncate m-0 leading-tight">{userName}</p>
                <p className="text-[10px] text-muted-foreground truncate m-0 leading-tight mt-0.5">{userEmail}</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content viewport column */}
      <div className={`flex-1 flex flex-col min-w-0 ${expanded ? 'md:ml-[220px]' : 'md:ml-[60px]'} transition-all duration-200`}>
        {/* Sticky Page Header */}
        <header className="sticky top-0 z-20 h-14 flex items-center justify-between px-4 md:px-8 bg-background/90 backdrop-blur-md border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <h1 className="text-[14px] font-display font-semibold text-foreground m-0 truncate select-none">{pageTitle}</h1>
              {breadcrumbs.length > 1 && (
                <nav className="hidden sm:flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground/80 mt-0.5" aria-label="Breadcrumb">
                  {breadcrumbs.slice(0, -1).map((crumb, idx) => (
                    <React.Fragment key={crumb}>
                      {idx > 0 && <span aria-hidden="true" className="text-muted-foreground/40">/</span>}
                      <span className="truncate">{crumb}</span>
                    </React.Fragment>
                  ))}
                </nav>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Main Area */}
        <main className="flex-1 px-4 md:px-8 py-6 md:py-8 pb-24 md:pb-8 overflow-y-auto">
          <div className="page-container mx-auto animate-slide-up">
            {children}
          </div>
        </main>
      </div>

      {/* Command Palette */}
      {commandPaletteOpen && (
        <CommandPalette
          open={commandPaletteOpen}
          onClose={handleCloseCommandPalette}
          workspaceId={workspaceId}
          profileId={profileId}
        />
      )}
    </div>
  );
};

export default DashboardLayout;
