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
  Sparkles,
  X,
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
    className={`group relative flex flex-col justify-between rounded-xl border border-border/80 bg-card p-5 transition-all duration-200 hover:shadow-xs hover:border-border ${
      onClick ? 'cursor-pointer' : ''
    }`}
  >
    <div className="flex items-center justify-between">
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconBg}`}>
        <Icon className={`h-4.5 w-4.5 ${iconColor}`} strokeWidth={2} />
      </div>
      {trend ? (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
            trend.positive
              ? 'text-success bg-success/10 border border-success/20'
              : 'text-destructive bg-destructive/10 border border-destructive/20'
          }`}
        >
          {trend.positive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
          <span>{trend.label}</span>
        </span>
      ) : (
        <div className="h-2 w-2 rounded-full bg-border" />
      )}
    </div>
    <div className="mt-3">
      <p className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight tabular-nums m-0">
        {value}
      </p>
      <p className="text-[12px] font-semibold text-muted-foreground mt-0.5 m-0">
        {label}
      </p>
    </div>
    <div className="pt-3 mt-3 border-t border-border-subtle/70 flex items-center justify-between">
      <p className="text-[11px] text-muted-foreground/90 leading-tight m-0 truncate">
        {sub}
      </p>
      {onClick && (
        <ArrowRight className="h-3 w-3 text-muted-foreground/40 transition-transform group-hover:text-primary group-hover:translate-x-0.5 shrink-0 ml-2" />
      )}
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const DashboardTemplate: React.FC<DashboardTemplateProps> = ({ workspaceId, profileId }) => {
  const { metrics, isLoading, isPending, isError, error, refetch } = useDashboard(workspaceId, profileId);
  const navigate = useNavigate();
  const [chartRange, setChartRange] = useState<'month' | 'week'>('month');
  const [hoveredChartIdx, setHoveredChartIdx] = useState<number | null>(null);
  const [dismissOnboarding, setDismissOnboarding] = useState(false);
  const todayFormatted = useMemo(() => new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), []);

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
        chartValuesList.push(monthlyRevenue[d.getMonth()] ? Math.round(monthlyRevenue[d.getMonth()] / 30) : 0);
      }
    }

    const isDataPresent = chartValuesList.some(v => v > 0);
    const rawMax = Math.max(...chartValuesList);
    // When no data, use benchmark scale ceiling (50,000) so axis labels show ₹50k, ₹25k, ₹0
    const maxVal = isDataPresent && rawMax > 0 ? Math.max(Math.ceil(rawMax * 1.15), 1000) : 50000;
    const W = 500;
    const H = 130;
    const padLeft = 52;
    const padRight = 16;
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
      barHeight: Math.max(2, (val / maxVal) * chartH),
      barY: padTop + chartH - Math.max(2, (val / maxVal) * chartH),
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

    const gl = [0, 1, 2, 3, 4].map(i => {
      const v = i * (maxVal / 4);
      let label = '₹0';
      if (v >= 100000) {
        label = `₹${(v / 100000).toFixed(1)}L`;
      } else if (v >= 1000) {
        label = `₹${Math.round(v / 1000)}k`;
      } else if (v > 0) {
        label = `₹${Math.round(v)}`;
      }
      return {
        y: padTop + chartH - (v / maxVal) * chartH,
        label,
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
    return { hasComparison: false, isPositive: true, pctLabel: '—', diffLabel: 'Direct UPI & bank settlements' };
  }, [metrics?.monthlyRevenue, metrics?.earnedThisMonth]);

  // ─── Loading / Error States ─────────────────────────────────────────────────
  if (isLoading || isPending || !workspaceId || (!metrics && !isError)) {
    return <DashboardSkeleton />;
  }

  if (isError && !metrics) {
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

  if (!metrics) {
    return <DashboardSkeleton />;
  }

  // ─── Derived Values ─────────────────────────────────────────────────────────
  const firstName = metrics.profileName.split(' ')[0] || metrics.profileName;
  const hasActions = actionItems.length > 0;
  const outstandingProposalsCount = metrics.pipeline.find(p => p.label === 'Proposal Sent')?.count || 0;
  const unpaidInvoicesCount = metrics.pipeline.find(p => p.label === 'Invoice Shared')?.count || 0;
  const totalPipelineItems = actionItems.reduce((s, i) => s + i.count, 0);

  const isNewWorkspace = metrics.totalClients === 0 && metrics.activeProjects === 0 && metrics.outstanding === 0 && metrics.earnedThisMonth === 0;

  return (
    <div className="space-y-7 animate-slide-up">

      {/* ── Workspace Header ──────────────────────────────────────────────────── */}
      <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-1">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground select-none m-0">
            {todayFormatted}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-foreground tracking-tight m-0 leading-tight">
            {getGreeting()}, {firstName}
          </h1>
          <p className="text-[13px] text-muted-foreground m-0 leading-normal">
            {hasActions
              ? `You have ${totalPipelineItems} pipeline item${totalPipelineItems !== 1 ? 's' : ''} requiring attention.`
              : 'Your workspace is clear — pipeline is fully in sync.'}
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <Button variant="outline" size="sm" onClick={() => navigate('/clients')} className="rounded-xl h-9 font-semibold text-xs px-3.5" icon={<Plus className="h-3.5 w-3.5" />}>
            Add Client
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate('/projects')} className="rounded-xl h-9 font-semibold text-xs px-3.5 shadow-xs" icon={<Plus className="h-3.5 w-3.5" />}>
            New Project
          </Button>
        </div>
      </header>

      {/* ── Day 0 Quick Setup Guide ───────────────────────────────────────────── */}
      {isNewWorkspace && !dismissOnboarding && (
        <div className="rounded-2xl border border-primary/25 bg-linear-to-br from-primary/5 via-card to-card p-6 space-y-4 shadow-xs relative overflow-hidden">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                <Sparkles className="h-3 w-3" />
                <span>Quick Setup Guide</span>
              </div>
              <h2 className="text-base sm:text-lg font-bold font-display text-foreground tracking-tight m-0">
                Welcome to Ujrat! Let's get your freelance business set up
              </h2>
              <p className="text-[13px] text-muted-foreground m-0 max-w-2xl">
                Organize clients, execute IT Act compliant digital agreements, and collect payments with zero gateway fees.
              </p>
            </div>
            <button
              onClick={() => setDismissOnboarding(true)}
              className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-secondary transition-colors cursor-pointer shrink-0"
              title="Dismiss guide"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
            <div
              onClick={() => navigate('/clients')}
              className="p-4 rounded-xl border border-border/70 bg-card hover:border-primary/50 hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-7 w-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <Users className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <h3 className="text-[13px] font-semibold text-foreground m-0">Add your first Client</h3>
                <p className="text-[11px] text-muted-foreground m-0 leading-relaxed">
                  Store client contact info, GSTIN, and billing address.
                </p>
              </div>
              <div className="pt-3 mt-3 border-t border-border-subtle/80 flex items-center text-[11px] font-semibold text-primary gap-1">
                <span>Add Client</span>
                <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>

            <div
              onClick={() => navigate('/projects')}
              className="p-4 rounded-xl border border-border/70 bg-card hover:border-primary/50 hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <Briefcase className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <h3 className="text-[13px] font-semibold text-foreground m-0">Create a Project</h3>
                <p className="text-[11px] text-muted-foreground m-0 leading-relaxed">
                  Set deliverables, milestone dates, and attach agreements.
                </p>
              </div>
              <div className="pt-3 mt-3 border-t border-border-subtle/80 flex items-center text-[11px] font-semibold text-primary gap-1">
                <span>New Project</span>
                <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>

            <div
              onClick={() => navigate('/invoices')}
              className="p-4 rounded-xl border border-border/70 bg-card hover:border-primary/50 hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-7 w-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-xs">
                    3
                  </div>
                  <FileText className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <h3 className="text-[13px] font-semibold text-foreground m-0">Send a UPI Invoice</h3>
                <p className="text-[11px] text-muted-foreground m-0 leading-relaxed">
                  Collect payments directly to your bank with 0% fees.
                </p>
              </div>
              <div className="pt-3 mt-3 border-t border-border-subtle/80 flex items-center text-[11px] font-semibold text-primary gap-1">
                <span>Create Invoice</span>
                <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </div>
        </div>
      )}

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
          iconColor="text-amber-500"
          iconBg="bg-amber-500/10"
          onClick={() => navigate('/invoices')}
        />
        <StatCard
          label="Active Projects"
          value={metrics.activeProjects}
          sub="Projects currently in active execution phase"
          icon={Briefcase}
          iconColor="text-emerald-500"
          iconBg="bg-emerald-500/10"
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
          <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-2xs">
            {/* Card Header */}
            <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
              <div className="space-y-0.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider select-none m-0">Monthly Revenue</p>
                <div className="flex items-center gap-2.5 mt-1">
                  <span className="font-display text-3xl font-bold tracking-tight text-foreground tabular-nums">
                    ₹{metrics.earnedThisMonth.toLocaleString('en-IN')}
                  </span>
                  {revenueComparison.hasComparison && (
                    <div
                      className={`flex items-center gap-0.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
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
                <p className="text-[11px] text-muted-foreground m-0">{revenueComparison.diffLabel}</p>
              </div>

              {/* Range Toggle */}
              <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-border shrink-0">
                {(['week', 'month'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setChartRange(r)}
                    className={`text-[11px] font-semibold px-3 py-1 rounded-lg cursor-pointer transition-all ${
                      chartRange === r
                        ? 'bg-card text-foreground shadow-xs border border-border/80'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {r === 'week' ? 'Week' : '8 Months'}
                  </button>
                ))}
              </div>
            </div>

            {/* SVG Chart */}
            <div className="w-full px-4 pb-4 select-none">
              <svg className="w-full" viewBox="0 0 500 130" preserveAspectRatio="none" style={{ height: 190 }}>
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
                      x1="50" y1={gl.y} x2="488" y2={gl.y}
                      stroke="hsl(var(--border-subtle))" strokeWidth="0.75"
                      strokeDasharray={idx === 0 ? '0' : '3 4'}
                    />
                    <text
                      x="6" y={gl.y + 3.5}
                      fontSize="8" fontFamily="ui-monospace,monospace"
                      fill="hsl(var(--muted-foreground))" fillOpacity="0.75"
                      fontWeight="500"
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
                        rx={4}
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
                    fontSize="8"
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
                        <circle cx={p.x} cy={p.y} r="12" fill="hsl(var(--primary))" fillOpacity="0.1" />
                      )}
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={isHov ? 4.5 : 3}
                        fill="hsl(var(--card))"
                        stroke="hsl(var(--primary))"
                        strokeWidth={isHov ? 2.5 : 1.5}
                        style={{ transition: 'r 0.15s' }}
                      />
                      {/* Tooltip */}
                      {isHov && (
                        <g transform={`translate(${p.x}, ${Math.max(16, p.y - 14)})`}>
                          <rect x="-42" y="-20" width="84" height="20" rx="5"
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
          <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-2xs">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
              <div>
                <h3 className="text-[13px] font-semibold text-foreground tracking-tight m-0">Needs Attention</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5 m-0">Pipeline milestones waiting on your action</p>
              </div>
              <div className={`flex h-5 min-w-5 items-center justify-center rounded-full px-2 text-[10px] font-bold ${
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
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary">
                        <ItemIcon className={`h-4.5 w-4.5 ${meta.color}`} strokeWidth={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-foreground leading-tight m-0">{meta.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug m-0">{meta.description}</p>
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
              <div className="flex flex-col items-center justify-center gap-2.5 py-10 text-center px-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-success/10 border border-success/20">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-foreground m-0">All Milestones Clear</p>
                  <p className="text-[11px] text-muted-foreground max-w-xs mt-0.5 m-0">
                    All proposals, contracts, deliverables, and invoices are up to date.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Activity Feed & Highlights ─────────────────────────────────── */}
        <div className="space-y-5">

          {/* Earned this month highlight */}
          <div className="rounded-xl border border-border/80 bg-card p-5 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider m-0">Earned This Month</p>
              <span className="text-[10px] font-bold text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full">
                Direct Settlement
              </span>
            </div>
            <p className="font-display text-3xl font-bold text-foreground tracking-tight tabular-nums m-0">
              ₹{metrics.earnedThisMonth.toLocaleString('en-IN')}
            </p>
            <div className="space-y-1.5 pt-1">
              <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-700"
                  style={{
                    width: `${Math.min(100, metrics.earnedThisMonth > 0 ? Math.max(8, (metrics.earnedThisMonth / Math.max(metrics.earnedThisMonth + 20000, 10000)) * 100) : 0)}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{revenueComparison.diffLabel}</span>
                {metrics.earnedThisMonth > 0 && (
                  <span className="font-semibold text-foreground">100% Retained</span>
                )}
              </div>
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-2xs">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-[12px] font-bold text-foreground tracking-tight select-none">
                  Activity Feed
                </span>
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">
                Real-time
              </span>
            </div>

            {metrics.activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center px-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-[13px] font-semibold text-foreground m-0">No recent activity</p>
                <p className="text-[11px] text-muted-foreground m-0 max-w-xs">
                  Activity will appear here as proposals, projects, and invoices are updated.
                </p>
              </div>
            ) : (
              <div className="max-h-75 overflow-y-auto divide-y divide-border-subtle">
                {metrics.activities.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-surface/50 transition-colors"
                  >
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-foreground leading-snug m-0">{a.action}</p>
                    </div>
                    <span className="shrink-0 text-[10px] font-mono text-muted-foreground select-none pt-0.5">
                      {new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-2xs">
            <div className="px-5 py-3.5 border-b border-border-subtle">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider select-none">Quick Actions</span>
            </div>
            <div className="p-2.5 space-y-1">
              {[
                { label: 'View all clients', path: '/clients', icon: Users },
                { label: 'Manage projects', path: '/projects', icon: Briefcase },
                { label: 'Create an invoice', path: '/invoices', icon: FileText },
                { label: 'Record payment', path: '/payments', icon: BarChart3 },
              ].map(({ label, path, icon: QIcon }) => (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[12px] font-medium text-muted-foreground hover:bg-surface hover:text-foreground transition-colors cursor-pointer"
                >
                  <QIcon className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" strokeWidth={2} />
                  <span className="flex-1 text-left">{label}</span>
                  <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0 text-primary" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
