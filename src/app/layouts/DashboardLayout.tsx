import React, { useState, useEffect, useCallback, memo } from 'react';
import { 
  LayoutDashboard,
  Briefcase, 
  Users, 
  FileText, 
  CreditCard, 
  Settings, 
  Sun, 
  Moon, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  Plus
} from 'lucide-react';
import { useTheme } from '@/shared/hooks/useTheme';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { Avatar } from '@/shared/ui/Containers';
import { Button } from '@/shared/ui/Button';
import { CommandPalette } from './CommandPalette';
import { MobileLayout } from './MobileLayout';
import { UjratLogo } from '@/shared/ui/UjratLogo';

interface NavItem {
  id: string;
  name: string;
  icon: React.ElementType;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
  { id: 'projects',  name: 'Projects',  icon: Briefcase },
  { id: 'clients',   name: 'Clients',   icon: Users },
  { id: 'invoices',  name: 'Invoices',  icon: FileText },
  { id: 'payments',  name: 'Payments',  icon: CreditCard },
  { id: 'settings',  name: 'Settings',  icon: Settings },
];

// ─── NavButton extracted + memoized ──────────────────────────────────────────
interface NavButtonProps {
  item: NavItem;
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
      className={`group relative flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors duration-150 cursor-pointer ${
        isActive
          ? 'bg-primary/10 text-primary font-semibold'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Icon
          className={`h-4.5 w-4.5 shrink-0 transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}
          strokeWidth={isActive ? 2.2 : 1.75}
        />
        {(expanded || mobile) && (
          <span className="truncate">{item.name}</span>
        )}
      </div>
      {(expanded || mobile) && item.badge && (
        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/15">
          {item.badge}
        </span>
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
  const userEmail = user?.email || 'user@ujrat.in';
  const pageTitle = currentView === 'dashboard' ? 'Dashboard' : (breadcrumbs[breadcrumbs.length - 1] || 'Workspace');

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
    <div className="flex min-h-screen bg-background text-foreground font-sans">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col fixed inset-y-0 left-0 z-30 bg-surface/90 backdrop-blur-md border-r border-border transition-all duration-200 ease-out select-none ${
          expanded ? 'w-56' : 'w-18'
        }`}
      >
        {/* Sidebar Header */}
        <div className="flex h-13 items-center justify-between px-3.5 shrink-0 border-b border-border-subtle">
          <div className="flex items-center gap-2.5 min-w-0">
            <UjratLogo size={22} />
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
        <div className="px-3 pb-2 shrink-0">
          <button
            onClick={handleOpenCommandPalette}
            className={`flex items-center gap-2 w-full rounded-xl border border-border/80 bg-card hover:bg-surface px-3 py-2 text-left text-[12px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors ${
              expanded ? 'justify-between' : 'justify-center'
            }`}
          >
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
              {expanded && <span className="truncate">Search</span>}
            </div>
            {expanded && (
              <span className="kbd-badge shrink-0 text-[10px]">
                ⌘K
              </span>
            )}
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 px-3 py-1 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = (item.id === 'dashboard' && currentView === 'dashboard') ||
              (item.id === 'invoices' && currentView === 'invoices') ||
              (item.id === 'clients' && currentView === 'clients') ||
              (item.id === 'payments' && currentView === 'payments') ||
              (item.id === 'settings' && currentView === 'settings') ||
              (item.id === 'projects' && (currentView === 'projects' || currentView === 'project-details'));
            return (
              <NavButton
                key={item.id}
                item={item}
                isActive={isActive}
                expanded={expanded}
                onViewChange={onViewChange}
              />
            );
          })}

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
        <div className="p-3 space-y-1.5 shrink-0 border-t border-border-subtle bg-surface">
          <button
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer text-[12px] font-medium"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 shrink-0 text-warning" strokeWidth={2} />
            ) : (
              <Moon className="h-4 w-4 shrink-0 text-primary" strokeWidth={2} />
            )}
            {expanded && <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
          </button>

          <div className={`flex items-center gap-2.5 p-1.5 rounded-xl ${expanded ? 'hover:bg-secondary/60' : 'justify-center border-t border-border-subtle pt-2'} transition-colors`}>
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
      <div className={`flex-1 flex flex-col min-w-0 ${expanded ? 'md:ml-56' : 'md:ml-18'} transition-all duration-200`}>
        {/* Sticky Page Header */}
        <header className="sticky top-0 z-20 h-14 flex items-center justify-between px-5 md:px-8 bg-background/80 backdrop-blur-md border-b border-border-subtle">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[13px] font-medium text-muted-foreground truncate">
              Ujrat
            </span>
            <span className="text-muted-foreground/50 text-xs">/</span>
            <h1 className="text-[13px] font-bold text-foreground m-0 truncate select-none tracking-tight">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                if (onQuickAction) {
                  onQuickAction('invoice');
                } else {
                  onViewChange('invoices');
                }
              }}
              className="font-semibold rounded-xl px-4 h-9 shadow-xs"
              icon={<Plus className="h-4 w-4" />}
            >
              New Invoice
            </Button>
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
