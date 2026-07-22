import React, { useState, useMemo } from 'react';
import { Badge } from '@/shared/ui/Badge';
import { DashboardSkeleton } from '@/shared/ui/Feedback';
import { useDashboard } from '@/features/dashboard';
import { 
  TrendingUp, 
  Plus,
  AlertCircle
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

const ACTION_LABELS: Record<string, { title: string; description: string }> = {
  'Proposal Sent': { title: 'Waiting for proposal response', description: 'Clients reviewing your proposals' },
  'Contract Sent': { title: 'Awaiting contract signature', description: 'Contracts sent, pending client approval' },
  'In Progress': { title: 'Active deliverables', description: 'Projects currently in production' },
  'Invoice Shared': { title: 'Awaiting payment', description: 'Invoices sent, payment pending' },
};

export const DashboardTemplate: React.FC<DashboardTemplateProps> = ({
  workspaceId,
  profileId,
}) => {
  const { metrics, isLoading, isError, error, refetch } = useDashboard(workspaceId, profileId);
  const navigate = useNavigate();
  const [chartRange, setChartRange] = useState<'month' | 'week'>('month');

  const actionItems = useMemo(
    () => (metrics?.pipeline || []).filter(p => p.count > 0),
    [metrics?.pipeline]
  );

  // Memoize all chart computations based on live metrics.monthlyRevenue
  const { points, pathD, gridLines, chartMonths } = useMemo(() => {
    const monthlyRevenue = metrics?.monthlyRevenue || new Array(12).fill(0);
    const now = new Date();
    const currentMonthIndex = now.getMonth();

    const chartMonthsList: string[] = [];
    const chartValuesList: number[] = [];
    for (let i = 7; i >= 0; i--) {
      const mIdx = (currentMonthIndex - i + 12) % 12;
      const d = new Date(now.getFullYear(), mIdx, 1);
      chartMonthsList.push(d.toLocaleString('en-IN', { month: 'short' }));
      chartValuesList.push(monthlyRevenue[mIdx] || 0);
    }

    const maxVal = Math.max(...chartValuesList, 1000);
    const points = chartValuesList.map((val, idx) => ({
      x: 50 + idx * 60,
      y: 140 - (val / maxVal) * 90,
      val,
    }));
    const pathD = points.reduce((acc, p, idx) =>
      idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, ''
    );
    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
      const val = ratio * maxVal;
      return {
        y: 140 - ratio * 90,
        label: val === 0 ? '₹0' : val >= 1000 ? `₹${(val / 1000).toFixed(0)}K` : `₹${val.toFixed(0)}`,
      };
    });
    return { points, pathD, gridLines, chartMonths: chartMonthsList };
  }, [metrics?.monthlyRevenue]);

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
      return {
        hasComparison: true,
        isPositive: true,
        pctLabel: 'New',
        diffLabel: 'First revenue recorded this month',
      };
    }
    return {
      hasComparison: false,
      isPositive: true,
      pctLabel: '0%',
      diffLabel: 'No revenue recorded this month yet',
    };
  }, [metrics?.monthlyRevenue, metrics?.earnedThisMonth]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (isError || !metrics) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border border-border rounded-lg bg-card text-center space-y-4 my-8">
        <div className="p-3 bg-destructive/10 rounded-full text-destructive">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-body font-bold text-foreground">Failed to Load Dashboard</h3>
          <p className="text-small text-muted-foreground max-w-md">
            {error instanceof Error ? error.message : 'An error occurred while fetching your dashboard metrics.'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Retry Loading
        </Button>
      </div>
    );
  }

  const hasActions = actionItems.length > 0;

  // Stats widgets matching layout
  const outstandingProposalsCount = metrics.pipeline.find(p => p.label === 'Proposal Sent')?.count || 0;
  const unpaidInvoicesCount = metrics.pipeline.find(p => p.label === 'Invoice Shared')?.count || 0;

  return (
    <div className="space-y-8 animate-slide-up">
      {/* Workspace Header Greeting */}
      <header className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 border-b border-border-subtle pb-6">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none select-none">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="text-display text-foreground font-semibold tracking-tight m-0 select-none">
            {getGreeting()}, {metrics.profileName.split(' ')[0]}
          </h1>
          <p className="text-small text-muted-foreground m-0 leading-normal max-w-md">
            {hasActions
              ? `You have ${actionItems.reduce((s, i) => s + i.count, 0)} pipeline milestones requiring attention.`
              : 'Your workspace is clear. Your pipeline is in sync.'}
          </p>
        </div>

        {/* Quick Actions Panel */}
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/clients')}
            icon={<Plus className="h-3.5 w-3.5" />}
          >
            Add Client
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/projects')}
            icon={<Plus className="h-3.5 w-3.5" />}
          >
            New Project
          </Button>
        </div>
      </header>

      {/* Main Metric-Focused Dashboard Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (Chart & Attention items) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Monthly Revenue Chart */}
          <div className="border border-border bg-card rounded-lg shadow-sm p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Monthly Revenue</span>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-3xl font-bold tracking-tight text-foreground m-0">
                    ₹{metrics.earnedThisMonth.toLocaleString('en-IN')}
                  </h2>
                  {revenueComparison.hasComparison && (
                    <div className={`flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                      revenueComparison.isPositive
                        ? 'text-success bg-success/5 border-success/10'
                        : 'text-destructive bg-destructive/5 border-destructive/10'
                    }`}>
                      <TrendingUp className={`h-2.5 w-2.5 ${!revenueComparison.isPositive ? 'rotate-180' : ''}`} />
                      <span>{revenueComparison.pctLabel}</span>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">{revenueComparison.diffLabel}</p>
              </div>
              
              <div className="flex items-center gap-1.5 bg-secondary p-0.5 rounded-md border border-border">
                <button 
                  onClick={() => setChartRange('week')}
                  className={`text-[10px] font-medium px-2 py-0.5 rounded cursor-pointer transition-all ${chartRange === 'week' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Last Week
                </button>
                <button 
                  onClick={() => setChartRange('month')}
                  className={`text-[10px] font-medium px-2 py-0.5 rounded cursor-pointer transition-all ${chartRange === 'month' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Month
                </button>
              </div>
            </div>

            {/* SVG Line Chart */}
            <div className="w-full relative h-[180px] mt-4 select-none">
              <svg className="w-full h-full" viewBox="0 0 520 180" preserveAspectRatio="none">
                {/* Horizontal grid lines & y-axis labels */}
                {gridLines.map((line, idx) => (
                  <g key={idx}>
                    <line 
                      x1="45" 
                      y1={line.y} 
                      x2="495" 
                      y2={line.y} 
                      stroke="var(--border-subtle)" 
                      strokeWidth="1" 
                      strokeDasharray="4 4" 
                    />
                    <text 
                      x="10" 
                      y={line.y + 4} 
                      className="text-[9px] font-semibold fill-muted-foreground font-mono"
                    >
                      {line.label}
                    </text>
                  </g>
                ))}

                {/* Main Trend Line path */}
                <path 
                  d={pathD} 
                  fill="none" 
                  stroke="var(--primary)" 
                  strokeWidth="2.5" 
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="drop-shadow-[0_2px_4px_rgba(37,99,235,0.15)]"
                />

                {/* Area fill under path */}
                <path
                  d={`${pathD} L ${points[points.length - 1]?.x || 0} 140 L ${points[0]?.x || 0} 140 Z`}
                  fill="url(#chart-glow)"
                  opacity="0.04"
                />

                {/* Gradients definitions */}
                <defs>
                  <linearGradient id="chart-glow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Plot points */}
                {points.map((p, idx) => (
                  <g key={idx} className="group cursor-pointer">
                    <circle 
                      cx={p.x} 
                      cy={p.y} 
                      r="3.5" 
                      className="fill-card stroke-primary stroke-[2.5]" 
                    />
                    <circle 
                      cx={p.x} 
                      cy={p.y} 
                      r="7" 
                      className="fill-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" 
                    />
                  </g>
                ))}

                {/* X-Axis labels */}
                {points.map((p, idx) => (
                  <text 
                    key={idx} 
                    x={p.x} 
                    y="165" 
                    textAnchor="middle" 
                    className="text-[9px] font-bold fill-muted-foreground font-mono"
                  >
                    {chartMonths[idx]}
                  </text>
                ))}
              </svg>
            </div>
          </div>

          {/* Attention Queue */}
          <div className="border border-border bg-card rounded-lg shadow-sm p-5 space-y-4">
            <div className="space-y-0.5">
              <h3 className="text-body font-bold text-foreground m-0">Needs Attention</h3>
              <p className="text-[11px] text-muted-foreground m-0">Milestone gates waiting on freelancer action or client signature</p>
            </div>
            {hasActions ? (
              <div className="border border-border bg-card rounded-lg divide-y divide-border-subtle overflow-hidden animate-slide-up">
                {actionItems.map(item => {
                  const meta = ACTION_LABELS[item.label] ?? { title: item.label, description: 'Pipeline items' };
                  return (
                    <div key={item.label} className="flex items-center justify-between gap-4 p-4 hover:bg-surface/30 transition-colors">
                      <div className="min-w-0">
                        <p className="text-small font-semibold text-foreground m-0">{meta.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 m-0 leading-normal">{meta.description}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 select-none">
                        <span className="text-[18px] font-bold text-foreground font-mono tabular-nums">{item.count}</span>
                        <Badge variant={item.variant} size="sm">{item.label}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="border border-dashed border-border rounded-lg p-6 text-center text-small text-muted-foreground italic bg-surface/10 select-none">
                All client proposals, signed agreements, and invoices are completed.
              </div>
            )}
          </div>
        </div>

        {/* Right Column Stats Panel widgets */}
        <div className="space-y-4">
          <div className="border border-border bg-card rounded-lg shadow-sm p-4 space-y-4">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest select-none">Workspace Stats</span>
            
            <div className="space-y-3">
              {/* Stat 1 */}
              <div className="p-3 border border-border bg-surface/50 rounded-lg flex flex-col justify-between">
                <span className="text-[9.5px] font-bold text-muted-foreground uppercase">Outstanding Proposals</span>
                <span className="font-display text-xl font-bold text-foreground mt-1">
                  {outstandingProposalsCount}
                </span>
                <span className="text-[10px] text-primary font-medium mt-0.5">Active client offers</span>
              </div>

              {/* Stat 2 */}
              <div className="p-3 border border-border bg-surface/50 rounded-lg flex flex-col justify-between">
                <span className="text-[9.5px] font-bold text-muted-foreground uppercase">Unpaid Invoices</span>
                <span className="font-display text-xl font-bold text-foreground mt-1">
                  ₹{metrics.outstanding.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-warning font-medium mt-0.5">{unpaidInvoicesCount} invoices pending payment</span>
              </div>

              {/* Stat 3 */}
              <div className="p-3 border border-border bg-surface/50 rounded-lg flex flex-col justify-between">
                <span className="text-[9.5px] font-bold text-muted-foreground uppercase">Active Projects</span>
                <span className="font-display text-xl font-bold text-foreground mt-1">{metrics.activeProjects}</span>
                <span className="text-[10px] text-success font-medium mt-0.5">Projects in execution</span>
              </div>

              {/* Stat 4 */}
              <div className="p-3 border border-border bg-surface/50 rounded-lg flex flex-col justify-between">
                <span className="text-[9.5px] font-bold text-muted-foreground uppercase">Total Clients</span>
                <span className="font-display text-xl font-bold text-foreground mt-1">{metrics.totalClients}</span>
                <span className="text-[10px] text-muted-foreground font-medium mt-0.5">Contacts in workspace</span>
              </div>
            </div>
          </div>
          
          {/* Timeline Logs */}
          <div className="border border-border bg-card rounded-lg shadow-sm p-4 space-y-3">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest select-none">Activity Timeline</span>
            {metrics.activities.length === 0 ? (
              <div className="border border-dashed border-border rounded-lg p-6 text-center text-small text-muted-foreground italic bg-surface/10 select-none">
                No recent activity.
              </div>
            ) : (
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {metrics.activities.map((a, idx) => (
                  <div key={a.id} className={`flex items-start gap-2.5 text-[11px] ${idx > 0 ? 'border-t border-border-subtle pt-2.5' : ''}`}>
                    <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground leading-snug m-0">{a.action}</p>
                    </div>
                    <span className="text-[8px] font-mono text-muted-foreground shrink-0 select-none">
                      {new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
