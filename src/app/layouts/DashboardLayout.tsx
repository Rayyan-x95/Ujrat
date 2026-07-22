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
      title={expanded ? undefined : item.name}
      aria-current={isActive ? 'page' : undefined}
      className={`group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors duration-120 cursor-pointer ${
        isActive
          ? 'bg-primary/6 text-primary'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
      }`}
    >
      {/* Active left indicator */}
      {isActive && (
        <span
          className="absolute left-0 inset-y-1.5 w-0.75 bg-primary rounded-r-full"
          aria-hidden="true"
        />
      )}
      <Icon
        className={`h-4 w-4 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}
        strokeWidth={isActive ? 2.2 : 1.9}
      />
      {(expanded || mobile) && (
        <span className={`truncate ${isActive ? 'font-semibold' : ''}`}>{item.name}</span>
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
          expanded ? 'w-55' : 'w-15'
        }`}
      >
        {/* Sidebar Header */}
        <div className="flex h-13 items-center justify-between px-3 shrink-0 border-b border-border-subtle">
          <div className="flex items-center gap-2 min-w-0">
            <UjratLogo size={20} />
            {expanded && (
              <span className="font-display font-semibold text-[13px] text-foreground tracking-tight truncate animate-fade-in">
                Ujrat
              </span>
            )}
          </div>
          {expanded && (
            <button
              onClick={handleCollapseSidebar}
              className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors shrink-0"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Global Search shortcut trigger */}
        <div className="px-2 pt-3 pb-1 shrink-0">
          <button
            onClick={handleOpenCommandPalette}
            className={`flex items-center gap-2 w-full rounded-md border border-border bg-card hover:bg-surface px-2.5 py-1.5 text-left text-[11px] text-muted-foreground hover:border-border hover:text-foreground cursor-pointer transition-colors ${
              expanded ? 'justify-between' : 'justify-center'
            }`}
          >
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
              {expanded && <span className="truncate">Search workspace</span>}
            </div>
            {expanded && (
              <span className="kbd-badge shrink-0">
                ⌘K
              </span>
            )}
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-hidden">
          {NAV_ITEMS.map(item => (
            <NavButton key={item.id} item={item} isActive={currentView === item.id} expanded={expanded} onViewChange={onViewChange} />
          ))}

          {/* Collapsed Expand Toggle */}
          {!expanded && (
            <div className="pt-2 border-t border-border-subtle mt-2 flex justify-center">
              <button
                onClick={handleExpandSidebar}
                className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                title="Expand sidebar"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </nav>

        {/* Sidebar Footer */}
        <div className="px-2 py-3 space-y-1 shrink-0 border-t border-border-subtle bg-surface">
          <button
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer text-[13px] font-medium"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 shrink-0 text-warning" strokeWidth={2} />
            ) : (
              <Moon className="h-4 w-4 shrink-0 text-primary" strokeWidth={2} />
            )}
            {expanded && <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
          </button>

          <div className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md ${expanded ? 'hover:bg-secondary' : 'justify-center border-t border-border-subtle pt-2'} transition-colors`}>
            <Avatar name={userName} size="sm" />
            {expanded && (
              <div className="min-w-0 animate-fade-in">
                <p className="text-[12px] font-semibold text-foreground truncate m-0 leading-tight">{userName}</p>
                <p className="text-[10px] text-muted-foreground truncate m-0 leading-tight mt-0.5 font-mono">{userEmail}</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content viewport column */}
      <div className={`flex-1 flex flex-col min-w-0 ${expanded ? 'md:ml-55' : 'md:ml-15'} transition-all duration-200`}>
        {/* Sticky Page Header */}
        <header className="sticky top-0 z-20 h-13 flex items-center justify-between px-5 md:px-8 bg-background border-b border-border-subtle">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-[13px] font-semibold text-foreground m-0 truncate select-none tracking-tight">
              {pageTitle}
            </h1>
            {breadcrumbs.length > 1 && (
              <nav
                className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground/60"
                aria-label="Breadcrumb"
              >
                <span aria-hidden="true">/</span>
                {breadcrumbs.slice(0, -1).map((crumb, idx) => (
                  <React.Fragment key={crumb}>
                    {idx > 0 && <span aria-hidden="true" className="text-muted-foreground/40">/</span>}
                    <span className="truncate">{crumb}</span>
                  </React.Fragment>
                ))}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleOpenCommandPalette}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-surface text-[11px] text-muted-foreground hover:text-foreground hover:border-border cursor-pointer transition-colors"
              aria-label="Open command palette"
            >
              <Search className="h-3 w-3" />
              <span>Search</span>
              <kbd className="kbd-badge">⌘K</kbd>
            </button>
          </div>
        </header>

        {/* Scrollable Main Area */}
        <main className="flex-1 px-4 md:px-8 py-6 md:py-8 pb-24 md:pb-8 overflow-y-auto bg-background">
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
