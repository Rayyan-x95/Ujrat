import React, { useState, useEffect } from 'react';
import { Card } from '@/shared/ui/Card';
import { Textarea } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { FileText, Lock, CheckCircle2, ShieldCheck, KeyRound } from 'lucide-react';

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
  emailLogs,
  onSave,
  onViewProposal,
}) => {
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-up">
      <div className="lg:col-span-2 space-y-4">
        {projectStatus === 'lead' || projectStatus === 'proposal' ? (
          <Card className="p-8 text-center border-dashed border-border space-y-4 flex flex-col items-center justify-center">
            <div className="max-w-md mx-auto space-y-3">
              <div className="h-12 w-12 rounded-full bg-surface border border-border flex items-center justify-center text-muted-foreground mx-auto shadow-sm">
                <Lock className="h-5 w-5 text-muted-foreground/60" />
              </div>
              <h3 className="text-small font-bold text-foreground m-0">Contract Locked</h3>
              <p className="text-xs text-muted-foreground m-0 leading-normal">
                The legally-binding service contract agreement can be customized and published once the project proposal has been approved by the client.
              </p>
              <div className="pt-2">
                <Button variant="outline" size="sm" onClick={onViewProposal}>
                  View Proposal Status
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-5.5 space-y-4">
            <div className="border-b border-border-subtle pb-3">
              <h3 className="text-small font-bold text-foreground m-0 flex items-center gap-2">
                <FileText className="h-4.5 w-4.5 text-primary" />
                <span>Sign-Off Contract Agreement</span>
              </h3>
              <p className="text-[11px] text-muted-foreground mt-1 m-0">Draft copyright transitions, milestones splits, and termination rules.</p>
            </div>
            <Textarea label="Contract Terms Outline" value={contractContent} onChange={e => setContractContent(e.target.value)} rows={12} className="font-mono text-xs leading-relaxed" />
            <div className="flex justify-end gap-2 border-t border-border pt-4 mt-2">
              <Button variant="outline" size="sm" onClick={() => handleAction('draft')} loading={loadingDraft}>Save Draft</Button>
              <Button variant="primary" size="sm" onClick={() => handleAction('sent')} loading={loadingSent}>Publish & Send Link</Button>
            </div>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        {/* Signature tracker */}
        <Card className="p-4.5 space-y-4 bg-surface/50 border border-border/60 shadow-sm">
          <h3 className="text-[11px] font-bold text-foreground uppercase tracking-wider m-0 flex items-center gap-1.5 select-none">
            <ShieldCheck className="h-4 w-4 text-muted-foreground/60" />
            <span>Signature Logs</span>
          </h3>
          {contract ? (
            <div className="space-y-3.5">
              <div className="flex justify-between items-center text-small">
                <span className="text-muted-foreground font-medium">Status:</span>
                <Badge variant={contract.status === 'signed' ? 'success' : 'primary'}>
                  {contract.status}
                </Badge>
              </div>
              {contract.status === 'signed' && (
                <div className="p-3 border border-success/20 bg-success/5 text-success rounded-md text-xs leading-normal flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Client Signed</span>
                    <span className="text-[10px] text-muted-foreground/80">Digitally authorized on portal.</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic m-0">No contract agreement drafted yet.</p>
          )}
        </Card>

        {/* Client signing OTP code display */}
        {(() => {
          const tenMinAgo = Date.now() - 10 * 60 * 1000;
          const otpLogs = emailLogs.filter((log: any) => {
            const isOtpType = log.subject?.toLowerCase().includes('verification') ||
              log.subject?.toLowerCase().includes('otp') ||
              log.body?.match(/\b\d{6}\b/);
            const isRecent = new Date(log.created_at).getTime() > tenMinAgo;
            return isOtpType && isRecent;
          });
          if (otpLogs.length === 0) return null;
          return (
            <Card className="p-4.5 space-y-3 border-primary/20 bg-primary-muted/10 rounded-lg shadow-sm">
              <div className="flex items-center gap-1.5 text-primary font-bold text-xs select-none">
                <KeyRound className="h-4 w-4 shrink-0" />
                <span>Client Signature OTP</span>
              </div>
              <p className="text-[10.5px] text-muted-foreground m-0 leading-normal">
                Provide this OTP code to your client to verify their identity and allow signing.
              </p>
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                {otpLogs.map((log: any) => {
                  const otpMatch = log.body?.match(/\b\d{6}\b/);
                  const otpCode = otpMatch ? otpMatch[0] : null;
                  return (
                    <div key={log.id} className="p-2.5 bg-background border border-border rounded text-xs space-y-1 font-mono">
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground select-none">
                        <span>Generated: {new Date(log.created_at).toLocaleTimeString()}</span>
                        {otpCode && <span className="bg-success/10 text-success border border-success/15 px-1 rounded font-bold text-[8px]">ACTIVE</span>}
                      </div>
                      {otpCode && (
                        <div className="flex justify-between items-center bg-surface p-2 rounded mt-1 border border-border-subtle select-text">
                          <span className="text-[9px] text-muted-foreground font-sans">Verification OTP:</span>
                          <span className="text-[13px] font-bold text-success select-all tracking-wider font-mono">{otpCode}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })()}
      </div>
    </div>
  );
};