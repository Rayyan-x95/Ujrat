import React from 'react';

/* ── Card ──────────────────────────────────────────────────────────────── */

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  variant?: 'default' | 'ghost' | 'elevated';
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  padding = 'md',
  variant = 'default',
  ...props
}) => {
  const paddings = { none: '', sm: 'p-4', md: 'p-5 sm:p-6', lg: 'p-6 sm:p-8' };
  const variants = {
    default:  'border border-border bg-card rounded-xl shadow-xs transition-all duration-200',
    ghost:    'bg-surface/60 rounded-xl border border-transparent',
    elevated: 'bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all duration-200',
  };
  return (
    <div className={`${variants[variant]} ${paddings[padding]} ${className}`} {...props}>
      {children}
    </div>
  );
};

/* ── Metric ──────────────────────────────────────────────────────────────── */

interface MetricProps {
  label: string;
  value: string;
  hint?: string | undefined;
}

export const Metric: React.FC<MetricProps> = ({ label, value, hint }) => (
  <div className="space-y-1">
    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider m-0">
      {label}
    </p>
    <p className="font-mono text-2xl font-bold text-foreground tracking-tight m-0">
      {value}
    </p>
    {hint && (
      <p className="text-[12px] text-muted-foreground m-0 leading-normal">{hint}</p>
    )}
  </div>
);

export default Card;
