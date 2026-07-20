import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClients } from '@/features/clients';
import { useProjects } from '@/features/projects';
import { useTheme } from '@/shared/hooks/useTheme';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  profileId: string;
}

interface CommandItem {
  id: string;
  category: 'Navigation' | 'Actions' | 'Clients' | 'Projects';
  title: string;
  subtitle?: string;
  shortcut?: string;
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  workspaceId,
  profileId,
}) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { clients } = useClients(workspaceId, profileId);
  const { projects } = useProjects(workspaceId, profileId);

  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Build the list of commands
  const defaultCommands: CommandItem[] = [
    {
      id: 'nav-dashboard',
      category: 'Navigation',
      title: 'Go to Dashboard',
      subtitle: 'View key metrics and attention pipeline',
      shortcut: 'G D',
      action: () => {
        navigate('/dashboard');
        onClose();
      },
    },
    {
      id: 'nav-clients',
      category: 'Navigation',
      title: 'Go to Clients',
      subtitle: 'Manage client details and contacts',
      shortcut: 'G C',
      action: () => {
        navigate('/clients');
        onClose();
      },
    },
    {
      id: 'nav-projects',
      category: 'Navigation',
      title: 'Go to Projects',
      subtitle: 'Track active, lead, and complete projects',
      shortcut: 'G P',
      action: () => {
        navigate('/projects');
        onClose();
      },
    },
    {
      id: 'nav-invoices',
      category: 'Navigation',
      title: 'Go to Invoices',
      subtitle: 'Review GST compliance and invoice status',
      shortcut: 'G I',
      action: () => {
        navigate('/invoices');
        onClose();
      },
    },
    {
      id: 'nav-payments',
      category: 'Navigation',
      title: 'Go to Payments',
      subtitle: 'Verify UPI payments and transactions',
      shortcut: 'G Y',
      action: () => {
        navigate('/payments');
        onClose();
      },
    },
    {
      id: 'nav-settings',
      category: 'Navigation',
      title: 'Go to Settings',
      subtitle: 'Configure GST settings, UPI ID, and profiles',
      shortcut: 'G S',
      action: () => {
        navigate('/settings');
        onClose();
      },
    },
    {
      id: 'action-theme',
      category: 'Actions',
      title: `Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`,
      subtitle: 'Toggle theme appearance',
      shortcut: 'T T',
      action: () => {
        toggleTheme();
        onClose();
      },
    },
  ];

  const clientCommands: CommandItem[] = (clients || []).map(client => ({
    id: `client-${client.id}`,
    category: 'Clients',
    title: client.name,
    subtitle: client.company ? `Client at ${client.company}` : 'Client',
    action: () => {
      navigate('/clients'); // Focuses clients template
      onClose();
    },
  }));

  const projectCommands: CommandItem[] = (projects || []).map(proj => ({
    id: `project-${proj.id}`,
    category: 'Projects',
    title: proj.name,
    subtitle: `Budget: ₹${proj.budget.toLocaleString('en-IN')} • Status: ${proj.status}`,
    action: () => {
      navigate(`/projects/${proj.id}`);
      onClose();
    },
  }));

  const allItems = [...defaultCommands, ...clientCommands, ...projectCommands];

  const filteredItems = allItems.filter(item => {
    const term = search.toLowerCase().trim();
    if (!term) return true;
    return (
      item.title.toLowerCase().includes(term) ||
      item.category.toLowerCase().includes(term) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(term))
    );
  });

  // Handle arrow key navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, selectedIndex, filteredItems, onClose]);

  // Adjust scroll when selection changes
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        const listHeight = listRef.current.clientHeight;
        const elemTop = selectedEl.offsetTop;
        const elemHeight = selectedEl.clientHeight;
        const currentScroll = listRef.current.scrollTop;

        if (elemTop < currentScroll) {
          listRef.current.scrollTop = elemTop;
        } else if (elemTop + elemHeight > currentScroll + listHeight) {
          listRef.current.scrollTop = elemTop + elemHeight - listHeight;
        }
      }
    }
  }, [selectedIndex]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 bg-overlay/40 backdrop-blur-[2px] animate-fade-in"
      onClick={e => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="w-full max-w-[540px] bg-card border border-border shadow-lg rounded-lg flex flex-col max-h-[440px] overflow-hidden animate-scale-in">
        {/* Search header */}
        <div className="flex items-center px-3.5 border-b border-border-subtle shrink-0">
          <svg className="h-4.5 w-4.5 text-muted-foreground/60 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search workspace..."
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            className="w-full h-11 pl-2.5 pr-3 text-body bg-transparent text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
          />
          <span className="text-[10px] font-bold text-muted-foreground/50 border border-border px-1.5 py-0.5 rounded bg-surface uppercase select-none shrink-0 font-mono">
            esc
          </span>
        </div>

        {/* Results list */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto py-2 divide-y divide-transparent"
        >
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-small text-muted-foreground select-none">
              No results found for "{search}"
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              // Show category header if it's the first item of this category
              const showCategory = idx === 0 || filteredItems[idx - 1]?.category !== item.category;

              return (
                <div key={item.id} className="flex flex-col">
                  {showCategory && (
                    <div className="px-3.5 pt-2.5 pb-1 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest select-none bg-surface/20">
                      {item.category}
                    </div>
                  )}
                  <div
                    onClick={() => item.action()}
                    className={`flex items-center justify-between px-3.5 py-2.5 cursor-pointer select-none transition-colors ${
                      isSelected
                        ? 'bg-primary-muted text-primary'
                        : 'text-foreground hover:bg-surface/50'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <p className={`text-small font-medium m-0 ${isSelected ? 'text-primary font-semibold' : 'text-foreground'}`}>
                        {item.title}
                      </p>
                      {item.subtitle && (
                        <p className={`text-[11px] mt-0.5 m-0 truncate ${isSelected ? 'text-primary/70' : 'text-muted-foreground'}`}>
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                    {item.shortcut && (
                      <span className={`text-[10px] font-semibold border px-1.5 py-0.5 rounded shrink-0 font-mono ${
                        isSelected ? 'border-primary/20 bg-primary/10 text-primary' : 'border-border bg-surface text-muted-foreground/80'
                      }`}>
                        {item.shortcut}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-3.5 py-2.5 border-t border-border-subtle bg-surface/50 text-[10px] text-muted-foreground flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-3">
            <span>
              Use <kbd className="font-semibold font-mono">↑↓</kbd> to navigate
            </span>
            <span>
              <kbd className="font-semibold font-mono">Enter</kbd> to select
            </span>
          </div>
          <span>
            {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'} available
          </span>
        </div>
      </div>
    </div>
  );
};
