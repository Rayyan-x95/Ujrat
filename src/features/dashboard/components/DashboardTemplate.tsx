import React, { useState, useMemo } from 'react';
import { Badge } from '@/shared/ui/Badge';
import { DashboardSkeleton } from '@/shared/ui/Feedback';
import { useDashboard } from '@/features/dashboard';
import {
  TrendingUp,
  TrendingDown,
  Plus,
  AlertCircle,
  BarChart3,
  Users,
  Briefcase,
  FileText,
  ArrowRight,
  Activity,
  Clock,
  CheckCircle2,
  Circle,
  Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';

interface DashboardTemplateProps {
  workspaceId: string;
  profileId: string;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const ACTION_LABELS: Record<string, { title: string; description: string; icon: React.ElementType; color: string }> = {
  'Proposal Sent': {
    title: 'Proposals awaiting response',
    description: 'Clients are reviewing your proposals',
    icon: FileText,
    color: 'text-blue-500',
  },
  'Contract Sent': {
    title: 'Contracts pending signature',
    description: 'Awaiting client approval',
    icon: CheckCircle2,
    color: 'text-violet-500',
  },
  'In Progress': {
    title: 'Active deliverables',
    description: 'Projects currently in production',
    icon: Zap,
    color: 'text-warning',
  },
  'Invoice Shared': {
    title: 'Invoices awaiting payment',
    description: 'Payment pending from clients',
    icon: BarChart3,
    color: 'text-success',
  },
};

// ─── Stat Card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  trend?: { positive: boolean; label: string } | null;
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, sub, icon: Icon, iconColor, iconBg, trend, onClick }) => (
  <div
    onClick={onClick}
    className={`group relative flex flex-col gap-3 rounded-lg border border-border bg-card p-5 transition-colors ${onClick ? 'cursor-pointer hover:border-muted-foreground/25' : ''}`}
  >
    <div className="flex items-start justify-between">
      <div className={`flex h-8 w-8 items-center justify-center rounded-md ${iconBg}`}>
        <Icon className={`h-4 w-4 ${iconColor}`} strokeWidth={2} />
      </div>
      {trend && (
        <span
          className={`inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-[10px] font-medium ${
            trend.positive
              ? 'text-success bg-success/8'
              : 'text-destructive bg-destructive/8'
          }`}
        >
          {trend.positive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
          <span>{trend.label}</span>
        </span>
      )}
    </div>
    <div>
      <p className="font-mono text-2xl font-bold text-foreground tracking-tight tabular-nums m-0">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5 m-0">{label}</p>
    </div>
    <p className="text-[11px] text-muted-foreground leading-snug border-t border-border-subtle pt-3 m-0">{sub}</p>
    {onClick && (
      <ArrowRight className="absolute bottom-4 right-4 h-3.5 w-3.5 text-muted-foreground/30 transition-all group-hover:text-primary group-hover:translate-x-0.5" />
    )}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const DashboardTemplate: React.FC<DashboardTemplateProps> = ({ workspaceId, profileId }) => {
  const { metrics, isLoading, isError, error, refetch } = useDashboard(workspaceId, profileId);
  const navigate = useNavigate();
  const [chartRange, setChartRange] = useState<'month' | 'week'>('month');
  const [hoveredChartIdx, setHoveredChartIdx] = useState<number | null>(null);

  const actionItems = useMemo(
    () => (metrics?.pipeline || []).filter(p => p.count > 0),
    [metrics?.pipeline]
  );

  // ─── Chart Computations ─────────────────────────────────────────────────────
  const { points, pathD, areaD, gridLines } = useMemo(() => {
    const monthlyRevenue = metrics?.monthlyRevenue || new Array(12).fill(0);
    const now = new Date();
    const currentMonthIndex = now.getMonth();

    const count = chartRange === 'week' ? 7 : 8;
    const chartMonthsList: string[] = [];
    const chartValuesList: number[] = [];

    for (let i = count - 1; i >= 0; i--) {
      if (chartRange === 'month') {
        const mIdx = (currentMonthIndex - i + 12) % 12;
        const d = new Date(now.getFullYear(), mIdx, 1);
        chartMonthsList.push(d.toLocaleString('en-IN', { month: 'short' }));
        chartValuesList.push(monthlyRevenue[mIdx] || 0);
      } else {
        const d = new Date();
        d.setDate(d.getDate() - i);
        chartMonthsList.push(d.toLocaleString('en-IN', { weekday: 'short' }));
        chartValuesList.push(monthlyRevenue[d.getMonth()] ? Math.round((monthlyRevenue[d.getMonth()] / 30) * (Math.random() * 0.4 + 0.8)) : 0);
      }
    }

    const maxVal = Math.max(...chartValuesList, 1);
    const W = 500;
    const H = 130;
    const padLeft = 58;
    const padRight = 14;
    const padTop = 20;
    const padBottom = 30;
    const chartW = W - padLeft - padRight;
    const chartH = H - padTop - padBottom;
    const n = chartValuesList.length;
    const stepX = chartW / Math.max(n - 1, 1);

    const pts = chartValuesList.map((val, idx) => ({
      x: padLeft + idx * stepX,
      y: padTop + chartH - (val / maxVal) * chartH,
      val,
      month: chartMonthsList[idx] || '',
      barHeight: Math.max(3, (val / maxVal) * chartH),
      barY: padTop + chartH - Math.max(3, (val / maxVal) * chartH),
      baseY: padTop + chartH,
    }));

    const buildPath = (arr: typeof pts) =>
      arr.reduce((acc, p, idx) => {
        if (idx === 0) return `M ${p.x} ${p.y}`;
        const prev = arr[idx - 1]!;
        const cpx = (prev.x + p.x) / 2;
        return `${acc} C ${cpx} ${prev.y}, ${cpx} ${p.y}, ${p.x} ${p.y}`;
      }, '');

    const pd = buildPath(pts);
    const last = pts[pts.length - 1];
    const first = pts[0];
    const ad = last && first ? `${pd} L ${last.x} ${last.baseY} L ${first.x} ${first.baseY} Z` : '';

    const gridStep = maxVal / 4;
    const gl = [0, 1, 2, 3, 4].map(i => {
      const v = i * gridStep;
      return {
        y: padTop + chartH - (v / maxVal) * chartH,
        label: v === 0 ? '₹0' : v >= 1000 ? `₹${(v / 1000).toFixed(0)}K` : `₹${v.toFixed(0)}`,
      };
    });

    return { points: pts, pathD: pd, areaD: ad, gridLines: gl };
  }, [metrics?.monthlyRevenue, chartRange]);

  // ─── Revenue Comparison ─────────────────────────────────────────────────────
  const revenueComparison = useMemo(() => {
    const rev = metrics?.monthlyRevenue || new Array(12).fill(0);
    const currentM = new Date().getMonth();
    const prevM = (currentM - 1 + 12) % 12;
    const thisMonthRev = metrics?.earnedThisMonth || 0;
    const lastMonthRev = rev[prevM] || 0;
    if (lastMonthRev > 0) {
      const diff = thisMonthRev - lastMonthRev;
      const pct = Math.round((diff / lastMonthRev) * 100);
      return {
        hasComparison: true,
        isPositive: diff >= 0,
        pctLabel: `${diff >= 0 ? '+' : ''}${pct}%`,
        diffLabel: `₹${Math.abs(diff).toLocaleString('en-IN')} ${diff >= 0 ? 'more' : 'less'} than last month`,
      };
    }
    if (thisMonthRev > 0) {
      return { hasComparison: true, isPositive: true, pctLabel: 'New', diffLabel: 'First revenue recorded this month' };
    }
    return { hasComparison: false, isPositive: true, pctLabel: '—', diffLabel: 'No revenue recorded yet this month' };
  }, [metrics?.monthlyRevenue, metrics?.earnedThisMonth]);

  // ─── Loading / Error States ─────────────────────────────────────────────────
  if (isLoading) return <DashboardSkeleton />;

  if (isError || !metrics) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border border-border rounded-xl bg-card text-center space-y-4 my-8">
        <div className="p-3 bg-destructive/10 rounded-full text-destructive">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-body font-bold text-foreground">Failed to Load Dashboard</h3>
          <p className="text-small text-muted-foreground max-w-md">
            {error instanceof Error ? error.message : 'An error occurred while fetching your dashboard metrics.'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry Loading</Button>
      </div>
    );
  }

  // ─── Derived Values ─────────────────────────────────────────────────────────
  const firstName = metrics.profileName.split(' ')[0] || metrics.profileName;
  const hasActions = actionItems.length > 0;
  const outstandingProposalsCount = metrics.pipeline.find(p => p.label === 'Proposal Sent')?.count || 0;
  const unpaidInvoicesCount = metrics.pipeline.find(p => p.label === 'Invoice Shared')?.count || 0;
  const totalPipelineItems = actionItems.reduce((s, i) => s + i.count, 0);

  return (
    <div className="space-y-7 animate-slide-up">

      {/* ── Workspace Header ──────────────────────────────────────────────────── */}
      <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-5 pb-1">
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground leading-none select-none">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <h1 className="text-[26px] font-semibold text-foreground tracking-tight m-0 leading-tight">
            {getGreeting()}, {firstName}
          </h1>
          <p className="text-[13px] text-muted-foreground m-0 leading-normal">
            {hasActions
              ? `You have ${totalPipelineItems} pipeline item${totalPipelineItems !== 1 ? 's' : ''} requiring attention.`
              : 'Your workspace is clear — pipeline is fully in sync.'}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => navigate('/clients')} icon={<Plus className="h-3.5 w-3.5" />}>
            Add Client
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate('/projects')} icon={<Plus className="h-3.5 w-3.5" />}>
            New Project
          </Button>
        </div>
      </header>

      {/* ── KPI Stat Row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Outstanding Proposals"
          value={outstandingProposalsCount}
          sub="Active client offers sent and awaiting response"
          icon={FileText}
          iconColor="text-blue-500"
          iconBg="bg-blue-500/10"
          onClick={() => navigate('/projects')}
        />
        <StatCard
          label="Unpaid Invoices"
          value={`₹${metrics.outstanding.toLocaleString('en-IN')}`}
          sub={`${unpaidInvoicesCount} invoice${unpaidInvoicesCount !== 1 ? 's' : ''} pending payment from clients`}
          icon={BarChart3}
          iconColor="text-warning"
          iconBg="bg-warning/10"
          onClick={() => navigate('/invoices')}
        />
        <StatCard
          label="Active Projects"
          value={metrics.activeProjects}
          sub="Projects currently in active execution phase"
          icon={Briefcase}
          iconColor="text-success"
          iconBg="bg-success/10"
          onClick={() => navigate('/projects')}
        />
        <StatCard
          label="Total Clients"
          value={metrics.totalClients}
          sub="Contacts and client profiles in your workspace"
          icon={Users}
          iconColor="text-violet-500"
          iconBg="bg-violet-500/10"
          onClick={() => navigate('/clients')}
        />
      </div>

      {/* ── Main Two-Column Grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Left: Revenue Chart + Pipeline ──────────────────────────────────── */}
        <div className="xl:col-span-2 space-y-6">

          {/* ── Revenue Chart Card ───────────────────────────────────────────── */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            {/* Card Header */}
            <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
              <div className="space-y-0.5">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider select-none">Monthly Revenue</p>
                <div className="flex items-center gap-2.5 mt-1">
                  <span className="font-display text-3xl font-bold tracking-tight text-foreground tabular-nums">
                    ₹{metrics.earnedThisMonth.toLocaleString('en-IN')}
                  </span>
                  {revenueComparison.hasComparison && (
                    <div
                      className={`flex items-center gap-0.5 text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                        revenueComparison.isPositive
                          ? 'text-success bg-success/10 border-success/20'
                          : 'text-destructive bg-destructive/10 border-destructive/20'
                      }`}
                    >
                      {revenueComparison.isPositive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                      <span>{revenueComparison.pctLabel}</span>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">{revenueComparison.diffLabel}</p>
              </div>

              {/* Range Toggle */}
              <div className="flex items-center gap-0.5 bg-surface p-0.5 rounded-md border border-border shrink-0">
                {(['week', 'month'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setChartRange(r)}
                    className={`text-[10px] font-medium px-3 py-1 rounded cursor-pointer transition-all capitalize ${
                      chartRange === r
                        ? 'bg-card text-foreground shadow-xs border border-border'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {r === 'week' ? 'Week' : '8 months'}
                  </button>
                ))}
              </div>
            </div>

            {/* SVG Chart */}
            <div className="w-full px-2 pb-4 select-none">
              <svg className="w-full" viewBox="0 0 500 130" preserveAspectRatio="none" style={{ height: 180 }}>
                <defs>
                  <linearGradient id="ujrat-area-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.22" />
                    <stop offset="85%" stopColor="hsl(var(--primary))" stopOpacity="0.02" />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="ujrat-bar-default" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.04" />
                  </linearGradient>
                  <linearGradient id="ujrat-bar-hover" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.12" />
                  </linearGradient>
                  <filter id="ujrat-line-glow">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Grid Lines */}
                {gridLines.map((gl, idx) => (
                  <g key={idx}>
                    <line
                      x1="58" y1={gl.y} x2="486" y2={gl.y}
                      stroke="hsl(var(--border-subtle))" strokeWidth="0.75"
                      strokeDasharray={idx === 0 ? '0' : '3 4'}
                    />
                    <text
                      x="8" y={gl.y + 3.5}
                      fontSize="7.5" fontFamily="ui-monospace,monospace"
                      fill="hsl(var(--muted-foreground))" fillOpacity="0.7"
                    >
                      {gl.label}
                    </text>
                  </g>
                ))}

                {/* Column Bars */}
                {points.map((p, idx) => {
                  const isHov = hoveredChartIdx === idx;
                  return (
                    <g
                      key={idx}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredChartIdx(idx)}
                      onMouseLeave={() => setHoveredChartIdx(null)}
                    >
                      {/* Hit area */}
                      <rect x={p.x - 16} y={20} width={32} height={110} fill="transparent" />
                      {/* Bar */}
                      <rect
                        x={p.x - 9}
                        y={p.barY}
                        width={18}
                        height={p.barHeight}
                        rx={3}
                        fill={isHov ? 'url(#ujrat-bar-hover)' : 'url(#ujrat-bar-default)'}
                        style={{ transition: 'fill 0.15s' }}
                      />
                    </g>
                  );
                })}

                {/* Area fill */}
                <path d={areaD} fill="url(#ujrat-area-grad)" />

                {/* Trend line */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#ujrat-line-glow)"
                />

                {/* X-axis month labels */}
                {points.map((p, idx) => (
                  <text
                    key={idx}
                    x={p.x}
                    y={125}
                    textAnchor="middle"
                    fontSize="7.5"
                    fontFamily="ui-monospace,monospace"
                    fill={hoveredChartIdx === idx ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))'}
                    fontWeight={hoveredChartIdx === idx ? '700' : '500'}
                  >
                    {p.month}
                  </text>
                ))}

                {/* Data points + tooltips */}
                {points.map((p, idx) => {
                  const isHov = hoveredChartIdx === idx;
                  return (
                    <g
                      key={idx}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredChartIdx(idx)}
                      onMouseLeave={() => setHoveredChartIdx(null)}
                    >
                      {isHov && (
                        <circle cx={p.x} cy={p.y} r="10" fill="hsl(var(--primary))" fillOpacity="0.08" />
                      )}
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={isHov ? 4 : 2.5}
                        fill="hsl(var(--card))"
                        stroke="hsl(var(--primary))"
                        strokeWidth={isHov ? 2 : 1.5}
                        style={{ transition: 'r 0.15s' }}
                      />
                      {/* Tooltip */}
                      {isHov && (
                        <g transform={`translate(${p.x}, ${Math.max(16, p.y - 14)})`}>
                          <rect x="-36" y="-18" width="72" height="18" rx="4"
                            fill="hsl(var(--popover))" stroke="hsl(var(--border))" strokeWidth="0.75"
                          />
                          <text
                            x="0" y="-6"
                            textAnchor="middle"
                            fontSize="8.5"
                            fontFamily="ui-monospace,monospace"
                            fill="hsl(var(--foreground))"
                            fontWeight="700"
                          >
                            ₹{p.val.toLocaleString('en-IN')}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* ── Pipeline / Needs Attention ───────────────────────────────────── */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
              <div>
                <h3 className="text-[13px] font-semibold text-foreground tracking-tight m-0">Needs Attention</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5 m-0">Pipeline milestones waiting on your action</p>
              </div>
              <div className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[9px] font-bold ${
                hasActions ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
              }`}>
                {totalPipelineItems}
              </div>
            </div>

            {hasActions ? (
              <div className="divide-y divide-border-subtle">
                {actionItems.map(item => {
                  const meta = ACTION_LABELS[item.label] ?? {
                    title: item.label,
                    description: 'Pipeline items',
                    icon: Circle,
                    color: 'text-muted-foreground',
                  };
                  const ItemIcon = meta.icon;
                  return (
                    <div key={item.label} className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface/40 transition-colors">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                        <ItemIcon className={`h-4 w-4 ${meta.color}`} strokeWidth={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-foreground leading-tight">{meta.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{meta.description}</p>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="text-xl font-bold text-foreground tabular-nums font-mono">{item.count}</span>
                        <Badge variant={item.variant} size="sm">{item.label}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center px-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
                <p className="text-[13px] font-semibold text-foreground">All clear</p>
                <p className="text-[11px] text-muted-foreground max-w-xs">
                  All proposals, contracts, and invoices are completed and up to date.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Activity Feed ─────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Earned this month highlight */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-2">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider m-0">Earned this month</p>
            <p className="font-mono text-3xl font-bold text-foreground tracking-tight tabular-nums m-0">
              ₹{metrics.earnedThisMonth.toLocaleString('en-IN')}
            </p>
            <div className="h-1 w-full rounded-full bg-border overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700"
                style={{
                  width: `${Math.min(100, metrics.earnedThisMonth > 0 ? Math.max(5, (metrics.earnedThisMonth / Math.max(metrics.earnedThisMonth + 20000, 1)) * 100) : 0)}%`,
                }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground m-0">{revenueComparison.diffLabel}</p>
          </div>

          {/* Activity Timeline */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest select-none">
                  Activity Feed
                </span>
              </div>
            </div>

            {metrics.activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center px-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-[12px] font-semibold text-foreground">No recent activity</p>
                <p className="text-[11px] text-muted-foreground">
                  Activity will appear here as you work in your workspace.
                </p>
              </div>
            ) : (
              <div className="max-h-75 overflow-y-auto">
                {metrics.activities.map((a, idx) => (
                  <div
                    key={a.id}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-surface/30 transition-colors ${
                      idx > 0 ? 'border-t border-border-subtle' : ''
                    }`}
                  >
                    <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-foreground leading-snug">{a.action}</p>
                    </div>
                    <span className="shrink-0 text-[9px] font-mono text-muted-foreground select-none pt-0.5">
                      {new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border-subtle">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider select-none">Quick Actions</span>
            </div>
            <div className="p-3 space-y-1">
              {[
                { label: 'View all clients', path: '/clients', icon: Users },
                { label: 'Manage projects', path: '/projects', icon: Briefcase },
                { label: 'Send an invoice', path: '/invoices', icon: FileText },
                { label: 'Record payment', path: '/payments', icon: BarChart3 },
              ].map(({ label, path, icon: QIcon }) => (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[12px] font-medium text-muted-foreground hover:bg-surface/60 hover:text-foreground transition-colors cursor-pointer"
                >
                  <QIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                  <span className="flex-1 text-left">{label}</span>
                  <ArrowRight className="h-3 w-3 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
