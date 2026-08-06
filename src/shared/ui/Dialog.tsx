import React, { useEffect, useId, useRef } from 'react';

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

export default Dialog;
