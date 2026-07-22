import React, { useEffect } from 'react';
import { useToastStore } from '@/shared/hooks/useToastStore';

/* ── Spinner ─────────────────────────────────────────────────────────────── */

export const Spinner: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({
  size = 'md',
  className = '',
}) => {
  const sizes = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-7 w-7' };
  return (
    <svg
      className={`animate-spin text-primary ${sizes[size]} ${className}`}
      fill="none"
      viewBox="0 0 24 24"
      role="status"
      aria-label="Loading"
    >
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
};

/* ── Skeleton ────────────────────────────────────────────────────────────── */

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={`animate-pulse rounded-md bg-secondary ${className}`}
    aria-hidden="true"
  />
);

export const SkeletonCard: React.FC = () => (
  <div className="bg-card border border-border rounded-lg p-5 space-y-3">
    <div className="flex items-center gap-3">
      <Skeleton className="h-8 w-8 rounded-md" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-2/5" />
        <Skeleton className="h-2.5 w-1/3" />
      </div>
    </div>
    <Skeleton className="h-3 w-full" />
    <Skeleton className="h-3 w-3/4" />
  </div>
);

/* ── ProgressBar ─────────────────────────────────────────────────────────── */

export const ProgressBar: React.FC<{
  value: number;
  max?: number;
  label?: string;
  showPercent?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}> = ({ value, max = 100, label, showPercent = true, variant = 'default' }) => {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  const trackColors = {
    default: 'bg-primary',
    success: 'bg-success',
    warning: 'bg-warning',
    danger:  'bg-destructive',
  };
  return (
    <div className="space-y-1.5 w-full">
      {(label || showPercent) && (
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          {label && <span className="truncate">{label}</span>}
          {showPercent && (
            <span className="font-mono font-medium text-foreground">{Math.round(percent)}%</span>
          )}
        </div>
      )}
      <div
        className="h-1.5 w-full bg-secondary rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Progress'}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${trackColors[variant]}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

/* ── AlertBanner ─────────────────────────────────────────────────────────── */

type AlertVariant = 'info' | 'success' | 'warning' | 'error';

const alertConfig: Record<
  AlertVariant,
  { wrapper: string; icon: string; path: string }
> = {
  info: {
    wrapper: 'bg-primary/5 border border-primary/15 text-foreground',
    icon:    'text-primary',
    path:    'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  success: {
    wrapper: 'bg-success/6 border border-success/15 text-foreground',
    icon:    'text-success',
    path:    'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  warning: {
    wrapper: 'bg-warning/7 border border-warning/20 text-foreground',
    icon:    'text-warning',
    path:    'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  },
  error: {
    wrapper: 'bg-destructive/5 border border-destructive/15 text-foreground',
    icon:    'text-destructive',
    path:    'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
};

export const AlertBanner: React.FC<{
  variant?: AlertVariant;
  title: string;
  message?: string;
  onDismiss?: () => void;
}> = ({ variant = 'info', title, message, onDismiss }) => {
  const c = alertConfig[variant];
  return (
    <div className={`flex gap-3 rounded-lg p-3.5 text-[13px] ${c.wrapper}`} role="alert">
      <svg
        className={`h-4 w-4 shrink-0 mt-0.5 ${c.icon}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={c.path} />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground m-0">{title}</p>
        {message && (
          <p className="mt-0.5 text-[12px] text-muted-foreground m-0 leading-normal">{message}</p>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="shrink-0 p-0.5 opacity-40 hover:opacity-80 transition-opacity cursor-pointer"
          aria-label="Dismiss"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
};

/* ── EmptyState ──────────────────────────────────────────────────────────── */

export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  secondaryGuidance?: string;
  tips?: string[];
}> = ({ icon, title, description, action, secondaryGuidance, tips }) => (
  <div className="flex flex-col items-center justify-center py-14 px-6 text-center max-w-sm mx-auto space-y-3 animate-fade-in">
    <div className="h-11 w-11 rounded-lg bg-surface border border-border flex items-center justify-center text-muted-foreground shrink-0">
      {icon ?? (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
      )}
    </div>
    <div className="space-y-1">
      <h3 className="text-[14px] font-semibold text-foreground m-0">{title}</h3>
      {description && (
        <p className="text-[12px] text-muted-foreground m-0 leading-normal">{description}</p>
      )}
    </div>
    {action && <div>{action}</div>}
    {secondaryGuidance && (
      <p className="text-[11px] text-muted-foreground/65 m-0">{secondaryGuidance}</p>
    )}
    {tips && tips.length > 0 && (
      <div className="text-left w-full bg-surface rounded-md p-3 space-y-1.5">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider m-0">
          Tips
        </p>
        <ul className="list-disc pl-4 text-[11px] text-muted-foreground space-y-1 m-0">
          {tips.map((tip, idx) => <li key={idx}>{tip}</li>)}
        </ul>
      </div>
    )}
  </div>
);

/* ── DashboardSkeleton ───────────────────────────────────────────────────── */

export const DashboardSkeleton: React.FC = () => (
  <div className="space-y-7 animate-pulse">
    {/* Header */}
    <div className="space-y-2 pb-1">
      <Skeleton className="h-2.5 w-32" />
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-3.5 w-72" />
    </div>
    {/* KPI row */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="border border-border bg-card rounded-lg p-5 space-y-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-2.5 w-24" />
          </div>
          <Skeleton className="h-2.5 w-full" />
        </div>
      ))}
    </div>
    {/* Chart + side */}
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2 space-y-4">
        <div className="border border-border bg-card rounded-lg p-6 space-y-4">
          <div className="flex justify-between">
            <div className="space-y-1.5">
              <Skeleton className="h-2.5 w-24" />
              <Skeleton className="h-7 w-36" />
            </div>
            <Skeleton className="h-7 w-28 rounded-lg" />
          </div>
          <Skeleton className="h-44 w-full rounded-md" />
        </div>
        <div className="border border-border bg-card rounded-lg p-5 space-y-3">
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-2.5 w-2/3" />
              </div>
              <Skeleton className="h-5 w-12 rounded-sm" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <div className="border border-border bg-card rounded-lg p-5 space-y-3">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
        <div className="border border-border bg-card rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle">
            <Skeleton className="h-2.5 w-24" />
          </div>
          <div className="divide-y divide-border-subtle">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3">
                <Skeleton className="h-1.5 w-1.5 rounded-full" />
                <Skeleton className="h-2.5 flex-1" />
                <Skeleton className="h-2 w-10" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

/* ── SettingsSkeleton ────────────────────────────────────────────────────── */

export const SettingsSkeleton: React.FC = () => (
  <div className="space-y-8 animate-pulse">
    <div className="space-y-2">
      <Skeleton className="h-6 w-36" />
      <Skeleton className="h-3.5 w-64" />
    </div>
    <div className="space-y-5">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  </div>
);

/* ── ClientPortalSkeleton ────────────────────────────────────────────────── */

export const ClientPortalSkeleton: React.FC = () => (
  <div className="space-y-8 max-w-3xl mx-auto animate-pulse">
    <div className="space-y-3">
      <Skeleton className="h-5 w-28 rounded-sm" />
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="h-3.5 w-1/4" />
    </div>
    <div className="flex gap-2 border-b border-border pb-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-20 rounded-md" />
      ))}
    </div>
    <div className="bg-card border border-border rounded-lg p-6 space-y-5">
      <Skeleton className="h-4 w-36" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-5 w-5 rounded-full shrink-0" />
          <div className="flex-1 space-y-2 pt-0.5">
            <Skeleton className="h-2.5 w-1/4" />
            <Skeleton className="h-2 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* ── Toast System ────────────────────────────────────────────────────────── */

export interface Toast {
  id: string;
  message: string;
  description?: string;
  type?: AlertVariant;
  duration?: number;
}

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const toastIconPaths: Record<AlertVariant, string> = {
  info:    'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  success: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  error:   'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
};

const toastIconColor: Record<AlertVariant, string> = {
  info:    'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  error:   'text-destructive',
};

const toastBorder: Record<AlertVariant, string> = {
  info:    'border-primary/20',
  success: 'border-success/25',
  warning: 'border-warning/25',
  error:   'border-destructive/25',
};

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const { id, message, description, type = 'info', duration = 4500 } = toast;

  useEffect(() => {
    const t = setTimeout(() => onDismiss(id), duration);
    return () => clearTimeout(t);
  }, [id, duration, onDismiss]);

  return (
    <div
      className={`flex gap-3 items-start rounded-lg p-4 shadow-md bg-card w-85 pointer-events-auto border ${toastBorder[type]} animate-slide-up`}
      role="alert"
    >
      <svg
        className={`h-4 w-4 shrink-0 mt-0.5 ${toastIconColor[type]}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={toastIconPaths[type]} />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-foreground m-0">{message}</p>
        {description && (
          <p className="text-[11px] text-muted-foreground mt-0.5 m-0 leading-normal">{description}</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(id)}
        className="shrink-0 p-0.5 opacity-35 hover:opacity-70 transition-opacity cursor-pointer"
        aria-label="Dismiss toast"
      >
        <svg className="h-3.5 w-3.5 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const toasts = useToastStore(state => state.toasts);
  const dismiss = useToastStore(state => state.dismissToast);

  return (
    <div className="fixed bottom-5 right-5 z-100 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <ToastItem key={t.id} toast={t as any} onDismiss={dismiss} />
      ))}
    </div>
  );
};

export default Spinner;
