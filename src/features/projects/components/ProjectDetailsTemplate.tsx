import React, { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { ProjectStatusBadge } from '@/shared/ui/Badge';
import { Card } from '@/shared/ui/Card';
import { ProgressBar } from '@/shared/ui/Feedback';
import { useProjectDetails } from '@/features/projects';
import { BriefTab } from '@/features/briefs/components/BriefTab';
import { ProposalTab } from '@/features/proposals/components/ProposalTab';
import { ContractTab } from '@/features/contracts/components/ContractTab';
import { DeliverablesTab } from '@/features/deliverables/components/DeliverablesTab';
import { InvoicesTab } from '@/features/invoices/components/InvoicesTab';
import { ChevronLeft, Share2, AlertCircle } from 'lucide-react';
import { useConfirmPayment } from '@/features/payments';

interface ProjectDetailsProps {
  projectId: string;
  workspaceId: string;
  profileId: string;
  onBack: () => void;
  onShowInvoice: (invoiceId: string) => void;
  addToast: (type: 'success' | 'info' | 'warning' | 'error', message: string, desc?: string) => void;
}

export const ProjectDetailsTemplate: React.FC<ProjectDetailsProps> = ({
  projectId,
  workspaceId,
  profileId,
  onBack,
  onShowInvoice,
  addToast,
}) => {
  const [activeTab, setActiveTab] = useState<'brief' | 'proposal' | 'contract' | 'deliverables' | 'invoices'>('brief');

  const {
      project,
      deliverables,
      invoices,
      emailLogs,
      isLoading,
      saveProposal,
      sendProposal,
      sendContract,
      uploadDeliverable,
      addDeliverableLink,
      generateInvoice,
      changeStatus,
    } = useProjectDetails({
      workspaceId,
      projectId,
      profileId,
      onShowInvoice,
      addToast,
    });

  const confirmPaymentMutation = useConfirmPayment(workspaceId, profileId, { addToast });

  const proposal = Array.isArray(project?.proposals)
    ? project.proposals[0] || null
    : project?.proposals || null;

  const contract = Array.isArray(project?.contracts)
    ? project.contracts[0] || null
    : project?.contracts || null;

  const client = Array.isArray(project?.clients)
    ? project.clients[0] || null
    : project?.clients || null;

  const brief = Array.isArray(project?.project_briefs)
    ? project.project_briefs[0] || null
    : project?.project_briefs || null;

  const handleSaveProposal = async (proposalData: { pricing: number; scope: string; timeline: string; terms: string }, status: 'draft' | 'sent') => {
    try {
      if (status === 'sent') {
        await sendProposal({
          proposalId: proposal?.id,
          proposalData,
          status,
        });
        addToast('success', 'Proposal Sent to Client');
      } else {
        await saveProposal({
          proposalId: proposal?.id,
          proposalData,
          status,
        });
        addToast('success', 'Proposal Draft Saved');
      }
    } catch (e: any) {
      console.error('SAVE PROPOSAL ERROR DETAILS:', e, e.message, e.details, e.hint);
      addToast('error', 'Failed to save proposal', e.message);
    }
  };

  const handleSaveContract = async (content: string, status: 'draft' | 'sent') => {
    try {
      await sendContract([content, status]);
      addToast('success', status === 'sent' ? 'Contract Shared with Client' : 'Contract Draft Saved');
    } catch (e: any) {
      console.error('SAVE CONTRACT ERROR DETAILS:', e, e.message, e.details, e.hint);
      addToast('error', 'Failed to save contract', e.message);
    }
  };

  const handleUploadDeliverable = async (file: File) => {
    try {
      await uploadDeliverable(file);
      addToast('success', 'File Uploaded', `${file.name} added to deliverables.`);
    } catch (e: any) {
      addToast('error', 'Upload Failed', e.message);
    }
  };

  const handleAddDeliverableLink = async (name: string, linkUrl: string) => {
    try {
      await addDeliverableLink({ name, linkUrl });
      addToast('success', 'Link Added', `Deliverable link "${name}" added successfully.`);
    } catch (e: any) {
      addToast('error', 'Failed to add link', e.message);
    }
  };

  const handleGenerateInvoice = async (invoiceNo: string, amount: number, note: string) => {
    try {
      await generateInvoice([invoiceNo, amount, note]);
      addToast('success', 'Invoice Generated & Shared', `GST compliance splits calculated.`);
    } catch (e: any) {
      addToast('error', 'Invoice Generation Failed', e.message);
    }
  };

  const copyPortalLink = () => {
    if (!project) return;
    const link = `${window.location.origin}/portal/${project.portal_token}`;
    navigator.clipboard.writeText(link);
    addToast('info', 'Client Portal Link Copied', 'Share this secure URL with the client for passwordless access.');
  };

  if (isLoading) {
    return (
      <div className="space-y-8.5 animate-pulse">
        <div className="space-y-3">
          <div className="flex justify-between items-start">
            <div className="space-y-2 flex-1">
              <div className="h-3.5 bg-secondary rounded w-20" />
              <div className="h-8.5 bg-secondary rounded w-1/3" />
            </div>
            <div className="h-9 bg-secondary rounded w-28" />
          </div>
          <div className="h-16 bg-secondary rounded w-full" />
        </div>
        <div className="flex gap-2 pb-2 border-b border-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-20 bg-secondary rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <Card className="p-8 text-center border-dashed">
        <p className="text-small text-destructive font-medium m-0">Project not found or deleted.</p>
        <Button variant="outline" size="sm" onClick={onBack} className="mt-4">Back to Projects</Button>
      </Card>
    );
  }

  const getWorkflowProgress = () => {
    switch (project.status) {
      case 'proposal': return 20;
      case 'approved': return 40;
      case 'contract_signed': return 60;
      case 'advance_paid': return 70;
      case 'in_progress': return 75;
      case 'delivered': return 90;
      case 'invoice_sent': return 95;
      case 'paid': return 100;
      default: return 10;
    }
  };

  const getWorkflowMessage = () => {
    switch (project.status) {
      case 'proposal': return 'Proposal sent to client. Awaiting brief approval.';
      case 'approved': return 'Proposal approved! Draft a contract to lock requirements.';
      case 'contract_signed': return 'Contract signed by client. Ready to activate.';
      case 'in_progress': return 'Work in progress. Upload deliverables and milestones.';
      case 'delivered': return 'Milestone delivered. Generate compliance invoice.';
      case 'invoice_sent': return 'GST invoice sent. Awaiting UPI transaction reference.';
      case 'paid': return 'Project fully paid. Workflow complete!';
      default: return 'Draft a proposal to align on pricing and scope.';
    }
  };

  const getNextActionInfo = () => {
    switch (project.status) {
      case 'lead':
        return {
          title: 'Draft & Send Proposal',
          desc: 'Your client is waiting for a formal proposal outlining scope, pricing, and timelines.',
          btn: 'Draft Proposal',
          onClick: () => setActiveTab('proposal'),
        };
      case 'proposal':
        return {
          title: 'Wait for Proposal Approval',
          desc: 'The proposal has been shared. The client must approve it from their secure portal.',
          btn: 'View Proposal Details',
          onClick: () => setActiveTab('proposal'),
        };
      case 'approved':
        return {
          title: 'Setup & Finalize Contract',
          desc: 'The proposal is approved! Generate the project agreement so both parties can sign it.',
          btn: 'Create Contract',
          onClick: () => setActiveTab('contract'),
        };
      case 'contract_signed':
        return {
          title: 'Activate Project Workspace',
          desc: 'The agreement has been digitally signed by the client. Advance to the execution phase.',
          btn: 'Start Project Work',
          onClick: async () => {
            try {
              await changeStatus('in_progress');
              addToast('success', 'Project Active', 'Project status updated to In Progress.');
            } catch (e: any) {
              addToast('error', 'Status Update Failed', e.message);
            }
          },
        };
      case 'in_progress':
        const hasDeliverables = deliverables && deliverables.length > 0;
        return {
          title: hasDeliverables ? 'Deliver Project & Request Final Payment' : 'Submit Deliverables for Review',
          desc: hasDeliverables ? 'You have uploaded work deliverables. Submit them to transition the project to the delivered phase.' : 'Project is active. Upload finished assets and work files in the deliverables tab, then request payment.',
          btn: hasDeliverables ? 'Submit & Mark as Delivered' : 'Manage Deliverables',
          onClick: hasDeliverables
            ? async () => {
                try {
                  await changeStatus('delivered');
                  addToast('success', 'Project Delivered', 'Project status updated to Delivered.');
                } catch (e: any) {
                  addToast('error', 'Status Update Failed', e.message);
                }
              }
            : () => setActiveTab('deliverables'),
        };
      case 'delivered':
        return {
          title: 'Issue Invoice & Request Payout',
          desc: 'Work deliverables have been uploaded. Generate a compliant GST invoice to collect final payment.',
          btn: 'Generate Final Invoice',
          onClick: () => setActiveTab('invoices'),
        };
      case 'invoice_sent':
        return {
          title: 'Awaiting Client Transfer',
          desc: 'The milestone invoice was sent to the client portal. Wait for them to submit their transaction reference.',
          btn: 'View Invoices',
          onClick: () => setActiveTab('invoices'),
        };
      case 'paid':
        return {
          title: 'Project Completed Successfully',
          desc: 'All invoices have been paid and verified. You can now archive the project to clean up your workspace.',
          btn: 'Archive Project',
          onClick: async () => {
            try {
              await changeStatus('archived');
              addToast('success', 'Project Archived', 'Project has been moved to archive.');
            } catch (e: any) {
              addToast('error', 'Archive Failed', e.message);
            }
          },
        };
      case 'archived':
        return {
          title: 'Project Archived',
          desc: 'This project is archived. You can reopen it as a lead if scope needs to be redefined.',
          btn: 'Reopen Project',
          onClick: async () => {
            try {
              await changeStatus('lead');
              addToast('success', 'Project Reopened', 'Project status reset to Lead.');
            } catch (e: any) {
              addToast('error', 'Reopen Failed', e.message);
            }
          },
        };
      default:
        return null;
    }
  };

  const nextAction = getNextActionInfo();

  return (
    <div className="space-y-6.5 animate-slide-up">
      {/* Project Header details */}
      <header className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 text-small text-muted-foreground font-medium select-none">
              <button onClick={onBack} className="flex items-center gap-1 hover:text-foreground cursor-pointer transition-colors bg-transparent border-0 p-0 font-medium">
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Projects</span>
              </button>
              <span className="text-muted-foreground/30">/</span>
              <span className="truncate">{client?.name || 'Client Details'}</span>
            </div>
            <h1 className="text-display text-foreground font-semibold tracking-tight m-0 select-text">{project.name}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0 select-none">
            <ProjectStatusBadge status={project.status} />
            {project.portal_token && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={copyPortalLink}
                icon={<Share2 className="h-3.5 w-3.5" />}
              >
                Share Portal
              </Button>
            )}
          </div>
        </div>

        {/* Status progression bar */}
        <div className="border border-border bg-card p-4 rounded-lg shadow-sm space-y-2.5 select-none">
          <div className="flex justify-between items-center text-small font-medium text-muted-foreground">
            <span className="text-foreground">{getWorkflowMessage()}</span>
            <span className="font-semibold text-foreground text-mono tabular-nums">{getWorkflowProgress()}%</span>
          </div>
          <ProgressBar value={getWorkflowProgress()} showPercent={false} variant="success" />
        </div>

        {/* Priority Action Highlight Panel */}
        {nextAction && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4.5 rounded-lg border border-primary/20 bg-primary-muted/20">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5 select-none">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Next Required Action</span>
              </span>
              <h4 className="text-[13.5px] font-bold text-foreground m-0">{nextAction.title}</h4>
              <p className="text-xs text-muted-foreground m-0 leading-normal">{nextAction.desc}</p>
            </div>
            <Button 
              variant="primary" 
              size="sm" 
              onClick={nextAction.onClick} 
              className="shrink-0 shadow-sm"
            >
              {nextAction.btn}
            </Button>
          </div>
        )}
      </header>

      {/* Tab Navigation */}
      <nav className="flex gap-1 overflow-x-auto pb-1.5 border-b border-border select-none" aria-label="Project workflow">
        {(['brief', 'proposal', 'contract', 'deliverables', 'invoices'] as const).map(tab => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors cursor-pointer capitalize whitespace-nowrap ${
                isActive
                  ? 'bg-primary-muted text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface/50'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </nav>

      {/* Tab Panel contents */}
      <div className="min-h-[360px]">
        {activeTab === 'brief' && (
          <BriefTab
            project={project}
            workspaceId={workspaceId}
            profileId={profileId}
            brief={brief}
            addToast={addToast}
          />
        )}

        {activeTab === 'proposal' && (
          <ProposalTab
            proposal={proposal}
            projectStatus={project.status}
            onSave={handleSaveProposal}
          />
        )}

        {activeTab === 'contract' && (
          <ContractTab
            contract={contract}
            projectStatus={project.status}
            budget={project.budget}
            emailLogs={emailLogs}
            onSave={handleSaveContract}
            onViewProposal={() => setActiveTab('proposal')}
          />
        )}

        {activeTab === 'deliverables' && (
          <DeliverablesTab
            deliverables={deliverables}
            projectStatus={project.status}
            onUpload={handleUploadDeliverable}
            onAddLink={handleAddDeliverableLink}
            onActivateWork={async () => {
              try {
                await changeStatus('in_progress');
                addToast('success', 'Project Active', 'Project status updated to In Progress.');
              } catch (e: any) {
                addToast('error', 'Status Update Failed', e.message);
              }
            }}
          />
        )}

        {activeTab === 'invoices' && (
          <InvoicesTab
            invoices={invoices}
            projectStatus={project.status}
            projectBudget={project.budget}
            onGenerateInvoice={handleGenerateInvoice}
            onShowInvoice={onShowInvoice}
            onConfirmPayment={async (invoiceId) => {
              await confirmPaymentMutation.mutateAsync(invoiceId);
            }}
          />
        )}
      </div>
    </div>
  );
};