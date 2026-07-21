import React, { useState, useEffect } from 'react';
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
  Menu, 
  X,
  Plus,
  UserPlus,
  FolderPlus,
  FilePlus,
  ChevronRight
} from 'lucide-react';
import { useTheme } from '@/shared/hooks/useTheme';
import { Avatar } from '@/shared/ui/Containers';
import { UjratLogo } from '@/shared/ui/UjratLogo';
import { CommandPalette } from './CommandPalette';

export interface MobileNavItem {
  id: string;
  name: string;
  icon: React.ElementType;
  badge?: number | string;
}

export const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  { id: 'dashboard', name: 'Home',     icon: LayoutDashboard },
  { id: 'clients',   name: 'Clients',  icon: Users },
  { id: 'projects',  name: 'Projects', icon: Briefcase },
  { id: 'invoices',  name: 'Invoices', icon: FileText },
  { id: 'payments',  name: 'Pay',      icon: CreditCard },
  { id: 'settings',  name: 'Settings', icon: Settings },
];

export interface MobileLayoutProps {
  children: React.ReactNode;
  currentView: string;
  onViewChange: (view: string) => void;
  pageTitle?: string;
  breadcrumbs?: string[];
  user?: {
    email?: string;
    user_metadata?: { full_name?: string };
  };
  workspaceId: string;
  profileId: string;
  onQuickAction?: ((actionType: 'client' | 'project' | 'invoice') => void) | undefined;
}

export const MobileLayout: React.FC<MobileLayoutProps> = ({
  children,
  currentView,
  onViewChange,
  pageTitle = 'Dashboard',
  breadcrumbs = [],
  user,
  workspaceId,
  profileId,
  onQuickAction,
}) => {
  const { theme, toggleTheme } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Freelancer';
  const userEmail = user?.email || '';

  // Close FAB on outside click or navigation
  useEffect(() => {
    setFabOpen(false);
    setDrawerOpen(false);
  }, [currentView]);

  const handleNavClick = (viewId: string) => {
    onViewChange(viewId);
    setDrawerOpen(false);
  };

  const handleQuickAction = (action: 'client' | 'project' | 'invoice') => {
    setFabOpen(false);
    if (onQuickAction) {
      onQuickAction(action);
    } else {
      // Fallback navigation based on action
      if (action === 'client') onViewChange('clients');
      else if (action === 'project') onViewChange('projects');
      else if (action === 'invoice') onViewChange('invoices');
    }
  };

  return (
    <div className="flex flex-col min-h-screen min-h-[100dvh] bg-background text-foreground select-none md:hidden">
      {/* ─── Mobile Header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 h-14 flex items-center justify-between px-4 bg-background/95 backdrop-blur-md border-b border-border pt-[env(safe-area-inset-top,0px)] shadow-xs">
        {/* Left: Brand & Menu Trigger */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 -ml-1.5 rounded-lg hover:bg-surface text-muted-foreground active:scale-95 transition-transform cursor-pointer"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5.5 w-5.5 text-foreground" />
          </button>

          <div className="flex items-center gap-2 min-w-0" onClick={() => handleNavClick('dashboard')}>
            <UjratLogo size={24} />
            <div className="min-w-0">
              <h1 className="text-[14px] font-display font-semibold text-foreground m-0 truncate leading-tight">
                {pageTitle}
              </h1>
              {breadcrumbs.length > 0 && (
                <p className="text-[10px] text-muted-foreground m-0 truncate font-medium">
                  {breadcrumbs.join(' / ')}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right: Quick Tools */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="p-2 rounded-lg hover:bg-surface text-muted-foreground hover:text-foreground active:scale-95 transition-transform cursor-pointer"
            aria-label="Search workspace (Ctrl+K)"
            title="Search"
          >
            <Search className="h-4.5 w-4.5" />
          </button>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-surface text-muted-foreground hover:text-foreground active:scale-95 transition-transform cursor-pointer"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="h-4.5 w-4.5 text-warning" />
            ) : (
              <Moon className="h-4.5 w-4.5 text-primary" />
            )}
          </button>
        </div>
      </header>

      {/* ─── Mobile Scrollable Body ─────────────────────────────────────────── */}
      <main className="flex-1 px-4 py-4 pb-28 overflow-y-auto">
        <div className="w-full mx-auto animate-fade-in space-y-4">
          {children}
        </div>
      </main>

      {/* ─── Floating Action Button (FAB) Speed Dial ────────────────────────── */}
      <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-2.5">
        {fabOpen && (
          <div className="flex flex-col items-end gap-2 animate-scale-in">
            <button
              onClick={() => handleQuickAction('client')}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-surface-raised border border-border shadow-md text-[12px] font-semibold text-foreground hover:bg-surface active:scale-95 transition-all cursor-pointer"
            >
              <UserPlus className="h-4 w-4 text-primary" />
              <span>New Client</span>
            </button>
            <button
              onClick={() => handleQuickAction('project')}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-surface-raised border border-border shadow-md text-[12px] font-semibold text-foreground hover:bg-surface active:scale-95 transition-all cursor-pointer"
            >
              <FolderPlus className="h-4 w-4 text-success" />
              <span>New Project</span>
            </button>
            <button
              onClick={() => handleQuickAction('invoice')}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-surface-raised border border-border shadow-md text-[12px] font-semibold text-foreground hover:bg-surface active:scale-95 transition-all cursor-pointer"
            >
              <FilePlus className="h-4 w-4 text-warning" />
              <span>New Invoice</span>
            </button>
          </div>
        )}

        <button
          onClick={() => setFabOpen(prev => !prev)}
          className={`h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center transition-transform active:scale-90 cursor-pointer ${
            fabOpen ? 'rotate-45 bg-destructive text-destructive-foreground' : ''
          }`}
          aria-label={fabOpen ? 'Close quick actions' : 'Quick action menu'}
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </button>
      </div>

      {/* ─── Mobile Navigation Bar (Bottom Dock) ────────────────────────────── */}
      <nav
        className="fixed bottom-0 inset-x-0 h-16 bg-background/95 backdrop-blur-lg border-t border-border z-30 flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom,0px)] shadow-lg"
        aria-label="Mobile Bottom Navigation"
      >
        {MOBILE_NAV_ITEMS.slice(0, 5).map(item => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`relative flex flex-1 flex-col items-center justify-center py-1 gap-1 transition-all duration-150 active:scale-90 cursor-pointer ${
                isActive ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
              }`}
              style={{ minHeight: '48px' }}
            >
              <div className="relative flex items-center justify-center">
                <Icon className={`h-5 w-5 ${isActive ? 'scale-110' : ''}`} strokeWidth={isActive ? 2.5 : 1.75} />
                {item.badge && (
                  <span className="absolute -top-1 -right-2 h-4 min-w-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center leading-none">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight truncate max-w-[64px]">{item.name}</span>
              {isActive && (
                <span className="absolute top-0 w-8 h-0.5 bg-primary rounded-full animate-fade-in" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </nav>

      {/* ─── Mobile Navigation Drawer ───────────────────────────────────────── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-overlay/60 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={() => setDrawerOpen(false)}
          />

          {/* Drawer Body */}
          <aside className="relative flex w-72 max-w-[85vw] flex-col bg-surface-raised border-r border-border shadow-xl animate-slide-up z-10">
            {/* Drawer Header */}
            <div className="flex h-14 items-center justify-between px-4 border-b border-border-subtle shrink-0">
              <div className="flex items-center gap-2.5">
                <UjratLogo size={26} />
                <span className="font-display font-bold text-heading text-foreground">Ujrat</span>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground cursor-pointer"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Workspace & Navigation Links */}
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
              <div>
                <p className="px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Navigation
                </p>
                <nav className="space-y-1">
                  {MOBILE_NAV_ITEMS.map(item => {
                    const Icon = item.icon;
                    const isActive = currentView === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all cursor-pointer ${
                          isActive
                            ? 'bg-primary-muted text-primary font-semibold'
                            : 'text-foreground/80 hover:bg-secondary hover:text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                          <span>{item.name}</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Theme Selector inside Drawer */}
              <div className="pt-2 border-t border-border-subtle">
                <p className="px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Preferences
                </p>
                <button
                  onClick={toggleTheme}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-[13px] font-medium text-foreground/80 hover:bg-secondary transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    {theme === 'dark' ? (
                      <Sun className="h-4.5 w-4.5 text-warning" />
                    ) : (
                      <Moon className="h-4.5 w-4.5 text-primary" />
                    )}
                    <span>{theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Profile Footer */}
            <div className="p-4 border-t border-border-subtle bg-surface/50 shrink-0 space-y-3">
              <div className="flex items-center gap-3">
                <Avatar name={userName} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-foreground truncate m-0 leading-tight">
                    {userName}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate m-0 leading-tight mt-0.5">
                    {userEmail}
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ─── Command Palette ───────────────────────────────────────────────── */}
      {commandPaletteOpen && (
        <CommandPalette
          open={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          workspaceId={workspaceId}
          profileId={profileId}
        />
      )}
    </div>
  );
};

export default MobileLayout;
