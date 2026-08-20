import React, { useState, useRef, useEffect } from 'react';
import { Plus, ChevronDown, Briefcase, Users, FileText } from 'lucide-react';
import { Button } from '@/shared/ui/Button';

interface CreateMenuProps {
  onSelectAction: (action: 'project' | 'client' | 'invoice') => void;
  className?: string;
}

export const CreateMenu: React.FC<CreateMenuProps> = ({ onSelectAction, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleAction = (action: 'project' | 'client' | 'invoice') => {
    setIsOpen(false);
    onSelectAction(action);
  };

  return (
    <div className={`relative inline-block ${className}`} ref={menuRef}>
      <Button
        variant="primary"
        size="sm"
        onClick={() => setIsOpen(prev => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="font-semibold rounded-xl px-3.5 h-9 shadow-xs whitespace-nowrap"
        icon={<Plus className="h-4 w-4" />}
        iconRight={
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
        }
      >
        Create
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-border bg-card/95 backdrop-blur-md p-1.5 shadow-xl animate-fade-in z-50 select-none">
          <div className="px-3 py-1.5 mb-1 border-b border-border-subtle">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground m-0">Quick Actions</p>
          </div>

          <button
            type="button"
            onClick={() => handleAction('project')}
            className="flex items-start gap-3 w-full p-2.5 rounded-xl text-left hover:bg-secondary/70 transition-colors group cursor-pointer"
          >
            <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0 mt-0.5">
              <Briefcase className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-foreground m-0 leading-tight">New Project</p>
              <p className="text-[11px] text-muted-foreground m-0 leading-snug mt-0.5">Proposals, deliverables & contracts</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleAction('client')}
            className="flex items-start gap-3 w-full p-2.5 rounded-xl text-left hover:bg-secondary/70 transition-colors group cursor-pointer"
          >
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0 mt-0.5">
              <Users className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-foreground m-0 leading-tight">New Client</p>
              <p className="text-[11px] text-muted-foreground m-0 leading-snug mt-0.5">Client contacts, GSTIN & billing info</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleAction('invoice')}
            className="flex items-start gap-3 w-full p-2.5 rounded-xl text-left hover:bg-secondary/70 transition-colors group cursor-pointer"
          >
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0 mt-0.5">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-foreground m-0 leading-tight">New Invoice</p>
              <p className="text-[11px] text-muted-foreground m-0 leading-snug mt-0.5">Milestone tax split & UPI receipts</p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
