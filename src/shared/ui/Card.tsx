import React from 'react';
import { Section } from './Section';

/* ── Card ────────────────────────────────────────────────────────────────── */

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
  const paddings = { none: '', sm: 'p-4', md: 'p-5', lg: 'p-6' };
  const variants = {
    default:  'border border-border bg-card rounded-lg',
    ghost:    'bg-surface/60 rounded-lg',
    elevated: 'bg-card rounded-lg border border-border shadow-sm',
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

/* ── StatCard ────────────────────────────────────────────────────────────── */

interface StatCardProps {
  label: string;
  value: string;
  sublabel?: string;
  trend?: { value: string; up: boolean };
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, sublabel, trend }) => (
  <div className="py-4 px-1">
    <Metric label={label} value={value} hint={sublabel} />
    {trend && (
      <span
        className={`inline-flex items-center gap-1 mt-2 text-[12px] font-medium ${
          trend.up ? 'text-success' : 'text-destructive'
        }`}
      >
        {trend.up ? '↑' : '↓'} {trend.value}
      </span>
    )}
  </div>
);

/* ── SummaryCard ─────────────────────────────────────────────────────────── */

interface SummaryCardProps {
  title: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({ title, badge, actions, children }) => (
  <Section
    title={title}
    actions={
      actions || badge ? (
        <div className="flex items-center gap-2">
          {badge}
          {actions}
        </div>
      ) : undefined
    }
  >
    {children}
  </Section>
);

export default Card;
