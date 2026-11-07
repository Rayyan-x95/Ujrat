import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { formatCurrency } from '@/shared/utils/currency';
import type { ProjectWithClient } from '@/shared/types';
import { Plus, Calendar1 as Calendar, Coins, ArrowRight, FolderClosed, Users, AlertCircle, Briefcase, Pencil, Trash2 } from 'lucide-react';

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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { projects, isLoading, addProject, editProject, removeProject } = useProjects(workspaceId, profileId);
  const { clients } = useClients(workspaceId, profileId);
  
  const [showAdd, setShowAdd] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<ProjectWithClient | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<ProjectWithClient | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setShowAdd(true);
      const next = new URLSearchParams(searchParams);
      next.delete('create');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [budget, setBudget] = useState('0');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState('');
  const [clientError, setClientError] = useState('');

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !clientId) {
      if (!name.trim()) setNameError('Project name is required.');
      if (!clientId) setClientError('Client selection is required.');
      addToast('warning', 'Validation Warning', 'Project Name and Client selection are required.');
      return;
    }
    setNameError('');
    setClientError('');

    try {
      setSubmitting(true);
      if (projectToEdit) {
        await editProject({
          id: projectToEdit.id,
          name,
          client_id: clientId,
          budget: parseFloat(budget) || 0,
          timeline_start: startDate || null,
          timeline_end: endDate || null,
        });
        addToast('success', 'Project Updated', `${name} has been updated.`);
        setProjectToEdit(null);
      } else {
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
      }
      setShowAdd(false);
      
      // Reset
      setName('');
      setClientId('');
      setBudget('0');
      setStartDate('');
      setEndDate('');
    } catch (err: any) {
      console.error('[ProjectsTemplate] Create project failed:', err?.message || err);
      addToast('error', 'Creation Failed', err?.message || 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  const startEditProject = (row: ProjectWithClient) => {
    setProjectToEdit(row);
    setName(row.name || '');
    setClientId(row.client_id || '');
    setBudget(String(row.budget ?? 0));
    setStartDate(row.timeline_start || '');
    setEndDate(row.timeline_end || '');
    setShowAdd(true);
  };

  const confirmDelete = async () => {
    if (!projectToDelete) return;
    try {
      setDeleting(true);
      await removeProject(projectToDelete.id);
      addToast('info', 'Project Deleted', `${projectToDelete.name} has been deleted.`);
      setProjectToDelete(null);
    } catch (e: any) {
      addToast('error', 'Delete Failed', e?.message || 'Failed to delete project');
    } finally {
      setDeleting(false);
    }
  };

  const columns: ColumnDef<ProjectWithClient>[] = React.useMemo(() => [
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
          {formatCurrency(row.budget)}
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
          <div className="w-30 select-none">
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
        <div className="flex gap-1.5 justify-end">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => startEditProject(row)}
            className="text-muted-foreground hover:text-foreground hover:bg-surface/50"
            icon={<Pencil className="h-3.5 w-3.5" />}
          >
            Edit
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onSelectProject(row.id)}
            icon={<ArrowRight className="h-3.5 w-3.5" />}
          >
            Workspace
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setProjectToDelete(row)}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/5"
            icon={<Trash2 className="h-3.5 w-3.5" />}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ], [onSelectProject]);

  const clientOptions = React.useMemo(() => [
    { value: '', label: clients.length === 0 ? 'No clients found' : 'Select a linked client' },
    ...clients.map(c => ({ value: c.id, label: c.company ? `${c.name} (${c.company})` : c.name })),
  ], [clients]);

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
        emptyState={{
          icon: <Briefcase className="h-5 w-5" />,
          title: "No Active Projects Yet",
          description: "Initialize your first project pipeline to manage briefs, send digital proposals, execute contracts, and issue GST invoices.",
          action: clients.length === 0 ? (
            <Button 
              variant="primary" 
              size="sm" 
              onClick={() => navigate('/clients')} 
              icon={<Users className="h-4 w-4" />}
            >
              Add Client First
            </Button>
          ) : (
            <Button 
              variant="primary" 
              size="sm" 
              onClick={() => setShowAdd(true)} 
              icon={<Plus className="h-4 w-4" />}
            >
              Create First Project
            </Button>
          ),
          tips: [
            "Projects follow a sequential pipeline: Lead → Proposal → Contract → Delivered → Settled.",
            "Client portals automatically sync with project status updates.",
            "Deliverables are stored in an escrow vault until payment invoices clear."
          ]
        }}
        loading={isLoading}
      />

      <Dialog open={showAdd} onClose={() => { setShowAdd(false); setProjectToEdit(null); }} title={projectToEdit ? 'Edit Project' : 'Initialize New Project Pipeline'} size="md">
        <form onSubmit={handleAddProject} className="space-y-4 pt-2">
          {clients.length === 0 && (
            <div className="p-3.5 border border-warning/30 bg-warning/5 rounded-lg flex items-start gap-3 text-small">
              <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-foreground m-0">No clients registered in workspace</p>
                <p className="text-muted-foreground m-0 text-[12px]">Projects must be linked to a client contact. Add a client first before initializing a project pipeline.</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  type="button"
                  className="mt-2"
                  onClick={() => { setShowAdd(false); navigate('/clients'); }}
                  icon={<Users className="h-3.5 w-3.5" />}
                >
                  Go to Clients
                </Button>
              </div>
            </div>
          )}

          <Input label="Project Name" placeholder="E.g., Brand Strategy & React App" value={name} onChange={e => { setName(e.target.value); setNameError(''); }} error={nameError} required />
          
          <Select
            label="Target Client"
            options={clientOptions}
            value={clientId}
            onChange={e => { setClientId(e.target.value); setClientError(''); }}
            error={clientError}
            disabled={clients.length === 0}
            required
          />

          <CurrencyInput label="Project Value / Budget (INR)" value={budget} onChange={e => setBudget(e.target.value)} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Timeline Start Date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <Input label="Timeline End Date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-4 mt-2">
            <Button variant="ghost" size="sm" onClick={() => { setShowAdd(false); setProjectToEdit(null); }} type="button">Cancel</Button>
            <Button variant="primary" size="sm" type="submit" loading={submitting} disabled={clients.length === 0}>{projectToEdit ? 'Save Changes' : 'Create Project'}</Button>
          </div>
        </form>
      </Dialog>

      {/* Confirmation Dialog for Deleting Project */}
      <Dialog
        open={!!projectToDelete}
        onClose={() => setProjectToDelete(null)}
        title="Delete Project"
        size="sm"
      >
        <div className="space-y-4 pt-1">
          <p className="text-small text-muted-foreground leading-relaxed">
            Delete <strong className="text-foreground">{projectToDelete?.name}</strong>? The project (and its brief, proposal, contract, and deliverables) will be removed from your workspace. Issued invoices are kept.
          </p>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" size="sm" onClick={() => setProjectToDelete(null)} type="button">
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={confirmDelete} loading={deleting}>
              Delete Project
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
