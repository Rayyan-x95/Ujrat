import React, { useEffect, useId, useRef, useState } from 'react';
import { Button } from './Button';

/* ── Dialog ──────────────────────────────────────────────────────────────── */

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  ariaLabel?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const sizeClasses: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

export const Dialog: React.FC<DialogProps> = ({
  open, onClose, title, description, ariaLabel, size = 'md', children, footer,
}) => {
  const overlayRef  = useRef<HTMLDivElement>(null);
  const dialogRef   = useRef<HTMLDivElement>(null);
  const prevElRef   = useRef<HTMLElement | null>(null);
  const titleId     = useId();
  const descId      = useId();

  const getFocusable = () => {
    if (!dialogRef.current) return [];
    return Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter(el => el.getAttribute('aria-hidden') !== 'true' && el.tabIndex >= 0);
  };

  useEffect(() => {
    if (!open) return;
    prevElRef.current = document.activeElement as HTMLElement;
    const focusable = getFocusable();
    (focusable[0] ?? dialogRef.current)?.focus();

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const els = getFocusable();
      if (!els.length) { e.preventDefault(); return; }
      const first = els[0]!;
      const last  = els[els.length - 1]!;
      if (!dialogRef.current?.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      prevElRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      style={{ backgroundColor: 'hsl(var(--overlay) / 0.65)' }}
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        ref={dialogRef}
        className={`w-full ${sizeClasses[size]} bg-card border border-border sm:rounded-xl shadow-dialog flex flex-col animate-scale-in max-h-[90vh] sm:max-h-[82vh]`}
        role="dialog"
        aria-modal="true"
        aria-label={title ? undefined : (ariaLabel ?? 'Dialog')}
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
      >
        {/* Header */}
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4 border-b border-border-subtle shrink-0">
            <div className="space-y-0.5 min-w-0">
              {title && (
                <h2 id={titleId} className="text-[15px] font-semibold text-foreground m-0 tracking-tight">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descId} className="text-[13px] text-muted-foreground m-0">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 h-7 w-7 flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="px-5 py-4 flex-1 overflow-y-auto">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-5 py-4 flex items-center justify-end gap-2 border-t border-border-subtle shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

/* ── ConfirmDialog ───────────────────────────────────────────────────────── */

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  danger?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open, onClose, onConfirm, title, message,
  confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  loading = false, danger = false,
}) => (
  <Dialog
    open={open}
    onClose={onClose}
    title={title}
    size="sm"
    footer={
      <>
        <Button variant="ghost" onClick={onClose}>{cancelLabel}</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    <p className="text-[13px] text-muted-foreground m-0">{message}</p>
  </Dialog>
);

/* ── Drawer ──────────────────────────────────────────────────────────────── */

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  side?: 'right' | 'left';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const drawerWidths: Record<string, string> = {
  sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg',
};

export const Drawer: React.FC<DrawerProps> = ({
  open, onClose, title, side = 'right', size = 'md', children, footer,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const drawerRef  = useRef<HTMLDivElement>(null);
  const prevElRef  = useRef<HTMLElement | null>(null);

  const getFocusable = () => {
    if (!drawerRef.current) return [];
    return Array.from(
      drawerRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    );
  };

  useEffect(() => {
    if (!open) return;
    prevElRef.current = document.activeElement as HTMLElement;
    getFocusable()[0]?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const els   = getFocusable();
      const first = els[0];
      const last  = els[els.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => { window.removeEventListener('keydown', handler); prevElRef.current?.focus(); };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div ref={overlayRef} className="fixed inset-0 z-50 flex overflow-hidden">
      <div
        className="absolute inset-0 animate-fade-in"
        style={{ backgroundColor: 'hsl(var(--overlay) / 0.6)' }}
        onClick={onClose}
      />
      <div
        ref={drawerRef}
        className={`absolute ${
          side === 'right' ? 'right-0' : 'left-0'
        } top-0 bottom-0 flex flex-col w-full ${drawerWidths[size]} bg-card border-l border-border shadow-lg animate-slide-in-right`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'drawer-title' : undefined}
      >
        {/* Drawer header */}
        <div className="flex items-center h-14 px-5 border-b border-border-subtle shrink-0">
          {title && (
            <h2 id="drawer-title" className="text-[15px] font-semibold text-foreground m-0 tracking-tight flex-1 min-w-0 truncate">
              {title}
            </h2>
          )}
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors ml-auto cursor-pointer shrink-0"
            aria-label="Close drawer"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <div className="px-5 py-4 border-t border-border-subtle flex items-center justify-end gap-2 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Tooltip ─────────────────────────────────────────────────────────────── */

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const Tooltip: React.FC<TooltipProps> = ({ children, content, position = 'top' }) => {
  const [visible, setVisible] = useState(false);
  const pos: Record<string, string> = {
    top:    'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
    left:   'right-full top-1/2 -translate-y-1/2 mr-1.5',
    right:  'left-full top-1/2 -translate-y-1/2 ml-1.5',
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          className={`absolute z-50 whitespace-nowrap rounded-md bg-foreground/95 text-background text-[11px] px-2 py-1 shadow-md pointer-events-none animate-fade-in ${pos[position]}`}
          role="tooltip"
        >
          {content}
        </div>
      )}
    </div>
  );
};

/* ── Popover ─────────────────────────────────────────────────────────────── */

interface PopoverProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right';
  items?: unknown[];
}

export const Popover: React.FC<PopoverProps> = ({ trigger, children, align = 'left' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative inline-flex">
      <div onClick={() => setOpen(v => !v)}>{trigger}</div>
      {open && (
        <div
          className={`absolute top-full mt-1.5 z-50 w-52 rounded-lg bg-card border border-border shadow-md overflow-hidden animate-scale-in ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
};

export default Dialog;
