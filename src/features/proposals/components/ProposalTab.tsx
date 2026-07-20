import React, { useState, useEffect } from 'react';
import { Card } from '@/shared/ui/Card';
import { CurrencyInput, Input, Textarea } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { FileEdit, CheckSquare, MessageSquare } from 'lucide-react';
import type { Proposal } from '@/shared/types';

interface ProposalTabProps {
  proposal: Proposal | null;
  projectStatus: string;
  onSave: (data: { pricing: number; scope: string; timeline: string; terms: string }, status: 'draft' | 'sent') => Promise<void>;
}

export const ProposalTab: React.FC<ProposalTabProps> = ({
  proposal,
  projectStatus,
  onSave,
}) => {
  const [pricing, setPricing] = useState<string>('0');
  const [scope, setScope] = useState<string>('');
  const [timeline, setTimeline] = useState<string>('');
  const [terms, setTerms] = useState<string>('');
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [loadingSent, setLoadingSent] = useState(false);

  useEffect(() => {
    if (proposal) {
      setPricing(String(proposal.pricing || '0'));
      setScope(proposal.scope || '');
      setTimeline(proposal.timeline || '');
      setTerms(proposal.terms || '');
    }
  }, [proposal]);

  const handleAction = async (status: 'draft' | 'sent') => {
    if (status === 'draft') setLoadingDraft(true);
    else setLoadingSent(true);

    try {
      const budgetNum = parseFloat(pricing) || 0;
      await onSave({ pricing: budgetNum, scope, timeline, terms }, status);
    } finally {
      setLoadingDraft(false);
      setLoadingSent(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-up">
      <div className="lg:col-span-2 space-y-4">
        {projectStatus === 'archived' ? (
          <Card className="p-6 text-center border-dashed">
            <p className="text-small text-muted-foreground italic m-0">This project workspace is archived. Proposals are read-only.</p>
          </Card>
        ) : (
          <Card className="p-5.5 space-y-4">
            <div className="border-b border-border-subtle pb-3">
              <h3 className="text-small font-bold text-foreground m-0 flex items-center gap-2">
                <FileEdit className="h-4.5 w-4.5 text-primary" />
                <span>Create Proposal</span>
              </h3>
              <p className="text-[11px] text-muted-foreground mt-1 m-0">Specify project pricing structure, scope list, and feedback revisions limits.</p>
            </div>
            <div className="space-y-4">
              <CurrencyInput label="Proposal Base Pricing (INR)" value={pricing} onChange={e => setPricing(e.target.value)} />
              <Textarea label="Project Scope & Deliverables Outline" placeholder="Detailed description of features, pages, assets, or code components..." value={scope} onChange={e => setScope(e.target.value)} rows={5} />
              <Input label="Proposed Execution Timeline" placeholder="3 Weeks / Delivery by September 1" value={timeline} onChange={e => setTimeline(e.target.value)} />
              <Textarea label="Revisions & Feedback Limits" placeholder="E.g., Up to 3 cycles of design adjustments included..." value={terms} onChange={e => setTerms(e.target.value)} rows={3} />
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-4 mt-2">
              <Button variant="outline" size="sm" onClick={() => handleAction('draft')} loading={loadingDraft}>Save Draft</Button>
              <Button variant="primary" size="sm" onClick={() => handleAction('sent')} loading={loadingSent}>Share with Client</Button>
            </div>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        {/* Proposal status tracker */}
        <Card className="p-4.5 space-y-4 bg-surface/50 border border-border/60">
          <h3 className="text-[11px] font-bold text-foreground uppercase tracking-wider m-0 flex items-center gap-1.5 select-none">
            <CheckSquare className="h-4 w-4 text-muted-foreground/60" />
            <span>Proposal Status</span>
          </h3>
          {proposal ? (
            <div className="space-y-3.5">
              <div className="flex justify-between items-center text-small">
                <span className="text-muted-foreground font-medium">Status:</span>
                <Badge variant={proposal.status === 'approved' ? 'success' : proposal.status === 'revision_requested' ? 'warning' : 'primary'}>
                  {proposal.status}
                </Badge>
              </div>
              {proposal.client_feedback && (
                <div className="border border-warning/20 bg-warning/5 p-3.5 rounded-lg space-y-1.5">
                  <span className="text-[10px] text-warning font-bold uppercase tracking-wider flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>Client Feedback:</span>
                  </span>
                  <p className="text-xs text-foreground leading-normal m-0">{proposal.client_feedback}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic m-0">No proposal shared with client yet.</p>
          )}
        </Card>
      </div>
    </div>
  );
};
