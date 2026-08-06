import React, { useState, useEffect } from 'react';
import { Card } from '@/shared/ui/Card';
import { Textarea } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Lock, CheckCircle2, ShieldCheck } from 'lucide-react';

interface ContractTabProps {
  contract: any;
  projectStatus: string;
  budget: number;
  emailLogs: any[];
  onSave: (content: string, status: 'draft' | 'sent') => Promise<void>;
  onViewProposal: () => void;
}

export const ContractTab: React.FC<ContractTabProps> = ({
  contract,
  projectStatus,
  budget,
  emailLogs: _emailLogs = [],
  onSave,
  onViewProposal,
}: ContractTabProps & { emailLogs?: any[] }) => {
  const [contractContent, setContractContent] = useState<string>('');
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [loadingSent, setLoadingSent] = useState(false);

  useEffect(() => {
    if (contract) {
      setContractContent(contract.introduction || '');
    } else {
      setContractContent(
        'PROJECT SERVICES AGREEMENT\n\n' +
        'This agreement is made between the Freelancer and the Client.\n\n' +
        '1. Services: Freelancer will perform design/dev tasks as specified in the scope.\n' +
        '2. Payment: A total payment of \u20B9' + (budget || 0) + ' shall be paid.\n' +
        '3. Intellectual Property: Upon final payment, IP transfers to the Client.'
      );
    }
  }, [contract, budget]);

  const handleAction = async (status: 'draft' | 'sent') => {
    if (status === 'draft') setLoadingDraft(true);
    else setLoadingSent(true);

    try {
      await onSave(contractContent, status);
    } finally {
      setLoadingDraft(false);
      setLoadingSent(false);
    }
  };

  const isContractSigned = projectStatus === 'contract_signed' || 
                           projectStatus === 'in_progress' || 
                           projectStatus === 'delivered' || 
                           projectStatus === 'completed' || 
                           projectStatus === 'archived';

  const isProposalApproved = projectStatus === 'approved' || isContractSigned;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card className="p-6 space-y-4 border border-border rounded-xl">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-semibold">Contract Agreement Text</h3>
            {contract?.status === 'sent' && (
              <Badge variant="warning">Sent to Client</Badge>
            )}
            {isContractSigned && (
              <Badge variant="success">Executed & Binding</Badge>
            )}
          </div>

          <Textarea
            value={contractContent}
            onChange={(e) => setContractContent(e.target.value)}
            disabled={isContractSigned || !isProposalApproved}
            rows={14}
            className="font-mono text-xs leading-relaxed"
            placeholder="Type or paste the legally binding service terms..."
          />

          {!isProposalApproved && (
            <div className="p-3 bg-muted border border-border rounded-lg flex items-center justify-between text-xs text-muted-foreground">
              <span>Proposal must be approved by the client before finalizing contract.</span>
              <Button variant="secondary" size="sm" onClick={onViewProposal}>View Proposal</Button>
            </div>
          )}

          {isProposalApproved && !isContractSigned && (
            <div className="flex gap-3 justify-end pt-2">
              <Button
                variant="secondary"
                onClick={() => handleAction('draft')}
                loading={loadingDraft}
              >
                Save Draft
              </Button>
              <Button
                variant="primary"
                onClick={() => handleAction('sent')}
                loading={loadingSent}
              >
                Send Contract to Client
              </Button>
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="p-5 space-y-4 border border-border rounded-xl">
          <h3 className="text-sm font-semibold">Contract Status</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {isContractSigned ? (
                <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
              ) : (
                <Lock className="h-5 w-5 text-muted-foreground shrink-0" />
              )}
              <div>
                <p className="text-xs font-medium m-0">E-Signature Verification</p>
                <p className="text-[11px] text-muted-foreground m-0">
                  {isContractSigned ? 'Digitally signed via client portal' : 'Pending client electronic signature'}
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-3 border border-border rounded-xl">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-4 w-4" />
            <h4 className="text-xs font-semibold uppercase tracking-wider">Audit & Metadata</h4>
          </div>
          {contract ? (
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Contract ID:</span>
                <span className="font-mono text-[10px] select-all">{contract.id?.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="capitalize text-foreground font-medium">{contract.status}</span>
              </div>
              {contract.signed_at && (
                <div className="flex justify-between">
                  <span>Signed At:</span>
                  <span className="text-foreground">{new Date(contract.signed_at).toLocaleDateString()}</span>
                </div>
              )}
              {contract.signer_name && (
                <div className="flex justify-between">
                  <span>Signer:</span>
                  <span className="text-foreground font-medium">{contract.signer_name}</span>
                </div>
              )}
              {contract.signer_ip && (
                <div className="flex justify-between">
                  <span>Signer IP:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded text-foreground">{contract.signer_ip}</span>
                    <span className="text-[9px] text-success font-medium">Verified</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic m-0">No contract agreement drafted yet.</p>
          )}
        </Card>
      </div>
    </div>
  );
};