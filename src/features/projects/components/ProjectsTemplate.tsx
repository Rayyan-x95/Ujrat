import React, { useState } from 'react';
import type { ColumnDef } from '@/shared/ui/Table';
import Table from '@/shared/ui/Table';
import { ProjectStatusBadge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Avatar } from '@/shared/ui/Containers';
import { ProgressBar } from '@/shared/ui/Feedback';
import { Dialog } from '@/shared/ui/Dialog';
import { Input, Select, CurrencyInput } from '@/shared/ui/Input';
import { PageHeader } from '@/shared/ui/PageHeader';
import { useProjects } from '@/features/projects';
import { useClients } from '@/features/clients';
import type { ProjectWithClient } from '@/shared/types';
import { Plus, Calendar1 as Calendar, Coins, ArrowRight, FolderClosed } from 'lucide-react';

interface ProjectsTemplateProps {
  workspaceId: string;
  profileId: string;
  onSelectProject: (projectId: string) => void;
  addToast: (type: 'success' | 'info' | 'warning' | 'error', message: string, desc?: string) => void;
}

export const ProjectsTemplate: React.FC<ProjectsTemplateProps> = ({
  workspaceId,
  profileId,
  onSelectProject,
  addToast,
}) => {
  const { projects, isLoading, addProject } = useProjects(workspaceId, profileId);
  const { clients } = useClients(workspaceId, profileId);
  
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [budget, setBudget] = useState('0');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !clientId) {
      addToast('warning', 'Validation Warning', 'Project Name and Client selection are required.');
      return;
    }

    try {
      setSubmitting(true);
      await addProject({
        name,
        client_id: clientId,
        budget: parseFloat(budget) || 0,
        timeline_start: startDate || null,
        timeline_end: endDate || null,
        notes: '',
        status: 'lead',
        deliverables: [],
      });
      addToast('success', 'Project Created', `${name} project added to pipeline.`);
      setShowAdd(false);
      
      // Reset
      setName('');
      setClientId('');
      setBudget('0');
      setStartDate('');
      setEndDate('');
    } catch (err: any) {
      console.error(err);
      addToast('error', 'Creation Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnDef<ProjectWithClient>[] = [
    {
      key: 'name', 
      header: 'Project Pipeline', 
      sortable: true,
      render: row => (
        <div 
          className="flex items-center gap-3 cursor-pointer group py-0.5" 
          onClick={() => onSelectProject(row.id)}
        >
          <div className="h-8 w-8 rounded bg-primary-muted/40 border border-primary/10 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
            <FolderClosed className="h-4 w-4 text-primary" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-small font-semibold text-foreground group-hover:text-primary transition-colors m-0 truncate">{row.name}</p>
            <p className="text-[10px] text-muted-foreground m-0 flex items-center gap-1 mt-0.5 select-none">
              <Calendar className="h-2.5 w-2.5 shrink-0" />
              <span>{row.timeline_end ? `Due: ${new Date(row.timeline_end).toLocaleDateString('en-IN')}` : 'No deadline set'}</span>
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'client', 
      header: 'Linked Client',
      render: row => {
        const clientName = row.clients?.name || 'Unknown Client';
        return (
          <div className="flex items-center gap-2">
            <Avatar name={clientName} size="sm" />
            <span className="text-small text-foreground/80 font-medium truncate">{clientName}</span>
          </div>
        );
      },
    },
    { 
      key: 'status', 
      header: 'Workflow Status', 
      render: row => <ProjectStatusBadge status={row.status} /> 
    },
    { 
      key: 'budget', 
      header: 'Project Value', 
      align: 'right', 
      sortable: true, 
      render: row => (
        <span className="font-semibold text-foreground flex items-center justify-end gap-1 font-mono">
          <Coins className="h-3 w-3 text-muted-foreground/50" />
          ₹{row.budget.toLocaleString('en-IN')}
        </span>
      ) 
    },
    {
      key: 'progress', 
      header: 'Progress Timeline',
      render: row => {
        const progressMap: Record<string, number> = {
          lead: 10,
          proposal: 25,
          approved: 40,
          contract_signed: 50,
          advance_paid: 60,
          in_progress: 75,
          delivered: 90,
          invoice_sent: 95,
          paid: 100,
          archived: 100,
        };
        const val = progressMap[row.status] || 0;
        return (
          <div className="w-[120px] select-none">
            <ProgressBar 
              value={val} 
              showPercent 
              variant={val === 100 ? 'success' : val >= 75 ? 'default' : 'warning'} 
            />
          </div>
        );
      },
    },
    {
      key: 'actions', 
      header: '', 
      align: 'right',
      render: row => (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => onSelectProject(row.id)}
          icon={<ArrowRight className="h-3.5 w-3.5" />}
        >
          Workspace
        </Button>
      ),
    },
  ];

  const clientOptions = [
    { value: '', label: 'Select a linked client' },
    ...clients.map(c => ({ value: c.id, label: c.company ? `${c.name} (${c.company})` : c.name })),
  ];

  return (
    <div className="space-y-6.5 animate-slide-up">
      <PageHeader
        title="Projects"
        description={isLoading ? 'Loading pipeline...' : `${projects.length} project pipeline${projects.length === 1 ? '' : 's'} active`}
        actions={
          <Button 
            variant="primary" 
            size="sm" 
            onClick={() => setShowAdd(true)}
            icon={<Plus className="h-4 w-4" />}
          >
            New Project
          </Button>
        }
      />

      <Table<ProjectWithClient>
        columns={columns}
        data={projects}
        keyField="id"
        searchable
        searchPlaceholder="Search project name..."
        emptyMessage="No active projects"
        emptySubMessage="Create your first client workspace pipeline to draft proposals, track sign-offs, and generate invoices."
        loading={isLoading}
      />

      <Dialog open={showAdd} onClose={() => setShowAdd(false)} title="Initialize New Project Pipeline" size="md">
        <form onSubmit={handleAddProject} className="space-y-4 pt-2">
          <Input label="Project Name" placeholder="E.g., Brand Strategy & React App" value={name} onChange={e => setName(e.target.value)} required />
          
          <Select
            label="Target Client"
            options={clientOptions}
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            required
          />

          <CurrencyInput label="Project Value / Budget (INR)" value={budget} onChange={e => setBudget(e.target.value)} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Timeline Start Date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <Input label="Timeline End Date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-4 mt-2">
            <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)} type="button">Cancel</Button>
            <Button variant="primary" size="sm" type="submit" loading={submitting}>Create Project</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
