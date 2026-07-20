import React, { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Badge, ProjectStatusBadge } from '@/shared/ui/Badge';
import { Card } from '@/shared/ui/Card';
import { Input, Textarea } from '@/shared/ui/Input';
import { AlertBanner, ClientPortalSkeleton } from '@/shared/ui/Feedback';
import { QRPreviewContainer } from '@/shared/ui/Containers';
import { useClientPortal } from '@/features/portal';
import type { Invoice } from '@/shared/types';
import { useToastStore } from '@/shared/hooks/useToastStore';
import { 
  Lock, 
  CheckCircle, 
  Building, 
  Download, 
  KeyRound, 
  MessageSquare,
  FileCheck,
  Receipt,
  QrCode,
  Link,
  ArrowUpRight
} from 'lucide-react';

interface ClientPortalProps {
  portalToken: string;
}

export const ClientPortalTemplate: React.FC<ClientPortalProps> = ({ portalToken }) => {
  const addToast = useToastStore((state) => state.addToast);
  const {
    portalData,
    isLoading,
    signContract: executeSignContract,
    submitPayment: executeSubmitPayment,
    submitFeedback: executeSubmitFeedback,
    approveProposal: executeApproveProposal,
    generateVerificationCode,
    verifyCode,
    downloadDeliverable,
    error,
  } = useClientPortal(portalToken);

  const [activeTab, setActiveTab] = useState<'overview' | 'proposal' | 'contract' | 'invoices' | 'deliverables'>('overview');

  // Interactive states
  const [signatureName, setSignatureName] = useState('');
  const [signing, setSigning] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [utr, setUtr] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [feedback, setFeedback] = useState('');

  // OTP Verification States
  const [emailVerified, setEmailVerified] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const project = portalData?.project || null;
  const settings = portalData?.settings || null;
  const proposal = portalData?.proposal || null;
  const contract = portalData?.contract || null;
  const invoices = portalData?.invoices || [];
  const deliverables = portalData?.deliverables || [];

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleRequestOtp = async () => {
    if (sendingOtp || verifyingOtp || cooldown > 0) return;
    
    try {
      setSendingOtp(true);
      await generateVerificationCode();
      setOtpSent(true);
      setCooldown(60);
      addToast('success', 'OTP Code Sent', `Verification OTP has been sent to your registered email address.`);
    } catch (e: any) {
      addToast('error', 'Failed to generate OTP code', e.message);
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) return;
    try {
      setVerifyingOtp(true);
      const isVerified = await verifyCode(otpCode);
      if (isVerified) {
        setEmailVerified(true);
        addToast('success', 'Client Verified', 'Identity successfully verified. You can now sign the agreement.');
      } else {
        addToast('error', 'Verification Failed', 'Invalid or expired OTP code.');
      }
    } catch (e: any) {
      addToast('error', 'Verification Error', e.message);
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleApproveProposal = async () => {
    try {
      await executeApproveProposal();
      addToast('success', 'Proposal Approved', 'Thank you! The project scope and pricing has been approved.');
      setActiveTab('contract');
    } catch (e: any) {
      addToast('error', 'Error approving proposal', e.message);
    }
  };

  const handleSubmitProposalFeedback = async () => {
    if (!feedback.trim()) return;
    try {
      await executeSubmitFeedback(feedback);
      addToast('info', 'Revision Requested', 'Feedback shared with freelancer.');
      setFeedback('');
    } catch (e: any) {
      addToast('error', 'Failed to submit feedback', e.message);
    }
  };

  const handleSignContract = async () => {
    if (!signatureName.trim() || !emailVerified) return;
    try {
      setSigning(true);
      await executeSignContract({ signatureName, emailVerified: true });
      addToast('success', 'Agreement Signed', 'You have digitally signed the project agreement.');
      setActiveTab('overview');
    } catch (e: any) {
      addToast('error', 'Failed to sign agreement', e.message);
    } finally {
      setSigning(false);
    }
  };

  const handleSubmitPaymentReceipt = async () => {
    if (!selectedInvoice || !utr.trim()) return;
    try {
      setSubmittingPayment(true);
      await executeSubmitPayment({
        invoiceId: selectedInvoice.id,
        amount: selectedInvoice.total,
        method: 'upi',
        reference: utr,
      });
      addToast('success', 'Receipt Submitted', 'Freelancer will verify your transaction reference.');
      setUtr('');
      setSelectedInvoice(null);
    } catch (e: any) {
      addToast('error', 'Error submitting receipt', e.message);
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleDownloadDeliverable = async (name: string, fileUrl?: string | null) => {
    if (fileUrl) {
      if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
        window.open(fileUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      try {
        const signedUrl = await downloadDeliverable(fileUrl);
        window.open(signedUrl, '_blank', 'noopener,noreferrer');
      } catch (err: any) {
        addToast('error', 'Download failed', err.message);
      }
      return;
    }

    addToast(
      'warning',
      'Download unavailable',
      `${name} does not have a downloadable file attached yet.`
    );
  };

  if (isLoading) {
    return <ClientPortalSkeleton />;
  }

  if (error || !project) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-8 select-none">
        <Card className="p-8 text-center max-w-sm border-dashed">
          <div className="h-12 w-12 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive mx-auto shadow-sm">
            <Lock className="h-5 w-5" />
          </div>
          <h2 className="text-small font-bold text-foreground mt-4 m-0">Security Token Invalid</h2>
          <p className="text-xs text-muted-foreground mt-2 leading-normal">
            This secure workspace link has expired or the security token is incorrect. Contact the freelancer for a new passwordless portal link.
          </p>
        </Card>
      </div>
    );
  }

  const upiUrl = selectedInvoice && settings?.upi_id
    ? `upi://pay?pa=${settings.upi_id}&pn=${encodeURIComponent(settings.company_name || 'Freelancer')}&am=${selectedInvoice.total}&cu=INR&tr=${selectedInvoice.invoice_number}`
    : '';

  return (
    <div className="space-y-6.5 max-w-3xl mx-auto animate-slide-up">
      <header className="space-y-3.5">
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-1.5">
            <Badge variant="outline" size="sm">Client Portal</Badge>
            <h1 className="text-display text-foreground font-semibold tracking-tight m-0">{project.name}</h1>
            <p className="text-small text-muted-foreground m-0 flex items-center gap-1.5 font-medium">
              <Building className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
              <span>Workspace provided by <span className="text-foreground font-semibold">{settings?.company_name || 'Freelancer'}</span></span>
            </p>
          </div>
          <div className="shrink-0 select-none">
            <ProjectStatusBadge status={project.status} />
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="flex gap-1 overflow-x-auto pb-1.5 border-b border-border select-none" aria-label="Portal sections" role="tablist">
        {([
          { id: 'overview', label: 'Status' },
          { id: 'proposal', label: 'Proposal' },
          { id: 'contract', label: 'Contract' },
          { id: 'invoices', label: 'Invoices' },
          { id: 'deliverables', label: 'Deliverables' },
        ] as const).map(t => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${t.id}`}
              id={`tab-${t.id}`}
              tabIndex={isActive ? 0 : -1}
              className={`px-3 py-1.5 text-[13px] font-medium rounded-md shrink-0 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background cursor-pointer ${
                isActive
                  ? 'bg-primary-muted text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface/50'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* Panel contents */}
      <div className="space-y-6">
        
        {/* Overview Panel */}
        {activeTab === 'overview' && (
          <Card role="tabpanel" id="panel-overview" aria-labelledby="tab-overview" className="p-5.5 space-y-6">
            <h2 className="text-small font-bold text-foreground m-0 flex items-center gap-1.5 select-none">
              <CheckCircle className="h-4.5 w-4.5 text-muted-foreground/60" />
              <span>Project Workflow progression</span>
            </h2>
            
            <div className="space-y-4">
              {[
                { title: 'Project Brief Outline', desc: 'Alignment on core specifications', done: true },
                { title: 'Proposal Approved', desc: 'Scope, execution timeline, and pricing agreement', done: ['approved', 'contract_signed', 'advance_paid', 'in_progress', 'delivered', 'invoice_sent', 'paid'].includes(project.status) },
                { title: 'Contract Signed', desc: 'Identity verification & legal execution', done: ['contract_signed', 'advance_paid', 'in_progress', 'delivered', 'invoice_sent', 'paid'].includes(project.status) },
                { title: 'Project Output Review', desc: 'Inspect work deliverables and file assets', done: ['delivered', 'invoice_sent', 'paid'].includes(project.status) },
                { title: 'Milestone Settled', desc: 'GST compliant invoices payments and closing', done: project.status === 'paid' },
              ].map((s, index) => (
                <div key={index} className="flex gap-4">
                  <div className="flex flex-col items-center shrink-0 select-none">
                    <div className={`h-6.5 w-6.5 rounded-full border-2 flex items-center justify-center text-small font-semibold ${s.done ? 'border-success bg-success-foreground/10 text-success' : 'border-border text-muted-foreground bg-surface'}`}>
                      {s.done ? '✓' : index + 1}
                    </div>
                    {index < 4 && <div className={`w-0.5 h-10 ${s.done ? 'bg-success' : 'bg-border'}`} />}
                  </div>
                  <div className="pt-0.5">
                    <p className={`text-xs font-semibold m-0 ${s.done ? 'text-foreground/65 line-through decoration-muted-foreground/20' : 'text-foreground'}`}>
                      {s.title}
                    </p>
                    <p className="text-[10.5px] text-muted-foreground m-0 mt-0.5 leading-normal">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Proposal Panel */}
        {activeTab === 'proposal' && (
          <Card role="tabpanel" id="panel-proposal" aria-labelledby="tab-proposal" className="p-5.5 space-y-6">
            <h2 className="text-small font-bold text-foreground m-0 flex items-center gap-1.5 select-none">
              <MessageSquare className="h-4.5 w-4.5 text-muted-foreground/60" />
              <span>Project Outline & Scope</span>
            </h2>
            
            {proposal ? (
              <div className="space-y-5">
                <div className="border border-border p-4.5 rounded-lg space-y-4 bg-surface/30">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block select-none">Project Value</span>
                    <p className="text-xl font-bold text-foreground mt-0.5 m-0 font-mono">₹{proposal.pricing?.toLocaleString('en-IN') || 0}</p>
                  </div>
                  {proposal.scope && (
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block select-none">Scope & Features</span>
                      <p className="text-xs text-foreground mt-1 whitespace-pre-wrap leading-relaxed m-0 font-sans">{proposal.scope}</p>
                    </div>
                  )}
                  {proposal.timeline && (
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block select-none">Timeline</span>
                      <p className="text-xs text-foreground mt-1 m-0 font-medium">{proposal.timeline}</p>
                    </div>
                  )}
                  {proposal.terms && (
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block select-none">Revision Guidelines & Terms</span>
                      <p className="text-xs text-foreground mt-1 whitespace-pre-wrap leading-relaxed m-0">{proposal.terms}</p>
                    </div>
                  )}
                </div>

                {proposal.status === 'sent' && (
                  <div className="flex flex-col gap-4 border-t border-border pt-4">
                    <Button variant="primary" className="w-full" onClick={handleApproveProposal}>
                      Approve Proposal
                    </Button>
                    <div className="space-y-2">
                      <Textarea
                        label="Revision Request Notes"
                        placeholder="Detail any alterations or feedback regarding price or scope..."
                        value={feedback}
                        onChange={e => setFeedback(e.target.value)}
                      />
                      <Button variant="outline" size="sm" onClick={handleSubmitProposalFeedback} disabled={!feedback.trim()}>
                        Submit Revisions request
                      </Button>
                    </div>
                  </div>
                )}

                {proposal.status === 'approved' && (
                  <AlertBanner variant="success" title="Scope Approved" message="Proposal has been approved. Please select the Contract tab to execute the agreement." />
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic m-0 bg-surface/30 p-4 border border-dashed rounded text-center">No proposal details shared yet by the freelancer.</p>
            )}
          </Card>
        )}

        {/* Contract Panel */}
        {activeTab === 'contract' && (
          <Card role="tabpanel" id="panel-contract" aria-labelledby="tab-contract" className="p-5.5 space-y-6">
            <h2 className="text-small font-bold text-foreground m-0 flex items-center gap-1.5 select-none">
              <FileCheck className="h-4.5 w-4.5 text-muted-foreground/60" />
              <span>Project Service Contract Agreement</span>
            </h2>

            {contract ? (
              <div className="space-y-4">
                  <div className="space-y-4 text-xs font-mono leading-relaxed text-foreground select-text">
                    {contract.introduction && (
                      <div className="space-y-1">
                        <span className="font-bold block border-b border-border/40 pb-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">1. Introduction & Scope</span>
                        <p className="m-0 whitespace-pre-wrap">{contract.introduction}</p>
                      </div>
                    )}
                    {contract.payment_schedule && (
                      <div className="space-y-1 mt-4">
                        <span className="font-bold block border-b border-border/40 pb-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">2. Payment Milestones & Schedule</span>
                        <p className="m-0 whitespace-pre-wrap">{contract.payment_schedule}</p>
                      </div>
                    )}
                    {contract.terms && (
                      <div className="space-y-1 mt-4">
                        <span className="font-bold block border-b border-border/40 pb-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">3. Terms & Conditions</span>
                        <p className="m-0 whitespace-pre-wrap">{contract.terms}</p>
                      </div>
                    )}
                  </div>

                {contract.status === 'sent' && (
                  <div className="border-t border-border pt-4 space-y-4">
                    <h3 className="text-xs font-bold text-foreground m-0 select-none">Identity Verification & Digital Signature</h3>
                    
                    {!emailVerified ? (
                      <div className="space-y-3.5 p-4 border border-border bg-surface/30 rounded-lg">
                        <p className="text-xs text-muted-foreground m-0 leading-normal">
                          For security and non-repudiation, please verify your identity before signing.
                        </p>
                        {!otpSent ? (
                          <Button variant="outline" size="sm" onClick={handleRequestOtp} loading={sendingOtp} icon={<KeyRound className="h-3.5 w-3.5" />}>
                            Generate Verification OTP
                          </Button>
                        ) : (
                          <div className="space-y-3">
                            <p className="text-[11px] text-muted-foreground m-0 font-medium">
                              Enter the 6-digit OTP code sent to your registered email address:
                            </p>
                            <div className="flex gap-2 items-center">
                              <Input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder="123456"
                                value={otpCode}
                                onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                className="w-32 text-center text-mono font-bold tracking-widest font-mono"
                                maxLength={6}
                                aria-label="6-digit OTP code"
                                autoComplete="one-time-code"
                              />
                              <Button variant="primary" size="sm" onClick={handleVerifyOtp} loading={verifyingOtp} disabled={otpCode.length < 6} aria-disabled={otpCode.length < 6}>
                                Verify Identity
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={handleRequestOtp} 
                                disabled={sendingOtp || cooldown > 0}
                                aria-disabled={sendingOtp || cooldown > 0}
                              >
                                {cooldown > 0 ? `Resend (${cooldown}s)` : 'Resend'}
                              </Button>
                            </div>
                            <div className="p-3 border border-dashed border-primary/20 bg-primary-muted/20 rounded text-[10px] text-primary space-y-1 select-none">
                              <span className="font-semibold block">How to retrieve the OTP:</span>
                              <p className="m-0 text-muted-foreground leading-normal">
                                The generated OTP has been sent to your registered email. Check your spam folder if you do not receive it within 2 minutes.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <AlertBanner variant="success" title="Identity Verified" message="Client verification code verified successfully. Enter signature below." />
                    )}

                    <div className="space-y-2">
                      <Input
                        label="Full Legal Name to Sign"
                        placeholder="Type your full legal name"
                        value={signatureName}
                        onChange={e => setSignatureName(e.target.value)}
                        disabled={!emailVerified}
                        aria-disabled={!emailVerified}
                      />
                      <Button 
                        variant="primary" 
                        className="w-full" 
                        onClick={handleSignContract} 
                        loading={signing} 
                        disabled={!signatureName.trim() || !emailVerified}
                        aria-disabled={!signatureName.trim() || !emailVerified}
                      >
                        Sign & Authorize Contract
                      </Button>
                    </div>
                  </div>
                )}

                {contract.status === 'signed' && (
                  <AlertBanner variant="success" title="Contract Executed" message="Both parties have signed this project services agreement." />
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic m-0 bg-surface/30 p-4 border border-dashed rounded text-center">No contract agreement prepared yet by the freelancer.</p>
            )}
          </Card>
        )}

        {/* Invoices Panel */}
        {activeTab === 'invoices' && (
          <div role="tabpanel" id="panel-invoices" aria-labelledby="tab-invoices" className="space-y-6">
            
            {/* Invoice list */}
            <Card className="p-5.5 space-y-4">
              <h2 className="text-small font-bold text-foreground m-0 flex items-center gap-1.5 select-none">
                <Receipt className="h-4.5 w-4.5 text-muted-foreground/60" />
                <span>GST Compliance Invoices</span>
              </h2>
              
              {invoices.length === 0 ? (
                <p className="text-xs text-muted-foreground italic m-0 bg-surface/30 p-4 border border-dashed rounded text-center">No invoices issued for this project workspace yet.</p>
              ) : (
                <div className="space-y-2">
                  {invoices.map(inv => (
                    <div
                      key={inv.id}
                      onClick={() => setSelectedInvoice(inv)}
                      className={`flex justify-between items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedInvoice?.id === inv.id
                          ? 'border-primary bg-primary-muted/20'
                          : 'border-border bg-card hover:bg-surface/30'
                      }`}
                    >
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-primary font-mono m-0">{inv.invoice_number}</p>
                        <p className="text-[10px] text-muted-foreground m-0 select-none">Due date: {new Date(inv.due_date).toLocaleDateString('en-IN')}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-foreground font-mono">₹{inv.total.toLocaleString('en-IN')}</span>
                        <Badge variant={inv.status === 'paid' ? 'success' : inv.status === 'overdue' ? 'destructive' : 'primary'}>
                          {inv.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Pay selected invoice form */}
            {selectedInvoice && (
              <Card className="p-5.5 space-y-5 border-primary/20 bg-primary-muted/5">
                <div className="flex justify-between items-center border-b border-border/40 pb-3">
                  <h3 className="text-xs font-bold text-foreground m-0 flex items-center gap-1.5">
                    <QrCode className="h-4 w-4 text-primary" />
                    <span>Settle Payout ({selectedInvoice.invoice_number})</span>
                  </h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => window.open(`/portal/${portalToken}/invoice/${selectedInvoice.id}/print`, '_blank')} icon={<Download className="h-3.5 w-3.5" />}>
                      Print PDF
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedInvoice(null)}>Close</Button>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal Base Value</span>
                    <span className="font-mono">₹{selectedInvoice.subtotal.toFixed(2)}</span>
                  </div>
                  {selectedInvoice.is_interstate ? (
                    <div className="flex justify-between text-muted-foreground">
                      <span>IGST Tax Value</span>
                      <span className="font-mono">₹{selectedInvoice.igst.toFixed(2)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-muted-foreground">
                        <span>CGST Tax Value</span>
                        <span className="font-mono">₹{selectedInvoice.cgst.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>SGST Tax Value</span>
                        <span className="font-mono">₹{selectedInvoice.sgst.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-small font-bold border-t border-border pt-2 text-foreground">
                    <span>Total Invoiced</span>
                    <span className="font-mono">₹{selectedInvoice.total.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {selectedInvoice.status !== 'paid' && settings?.upi_id ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <QRPreviewContainer
                      value={upiUrl}
                      label="Dynamic UPI QR Code"
                      sublabel="Scan with GPay, PhonePe, BHIM, or Paytm app"
                    />
                    <div className="space-y-4 flex flex-col justify-between">
                      <div className="bg-card border border-border p-3.5 rounded-lg select-all">
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider m-0">UPI ID / VPA Address</p>
                        <p className="text-xs font-bold text-foreground mt-0.5 m-0 font-mono">{settings.upi_id}</p>
                      </div>
                      
                      <div className="space-y-3">
                        <Input
                          label="Enter Transaction UTR Reference Number"
                          placeholder="12-digit UPI reference number"
                          value={utr}
                          onChange={e => setUtr(e.target.value.replace(/\D/g, '').slice(0, 12))}
                        />
                        <Button 
                          variant="primary" 
                          className="w-full" 
                          onClick={handleSubmitPaymentReceipt} 
                          loading={submittingPayment} 
                          disabled={utr.length < 6}
                        >
                          Verify Receipt
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : selectedInvoice.status === 'paid' ? (
                  <AlertBanner variant="success" title="Milestone Settled" message="This invoice reference has been verified and marked as fully paid." />
                ) : (
                  <p className="text-xs text-muted-foreground italic m-0">UPI configuration VPA is not configured for this freelancer account.</p>
                )}
              </Card>
            )}

          </div>
        )}

        {/* Deliverables Panel */}
        {activeTab === 'deliverables' && (
          <Card role="tabpanel" id="panel-deliverables" aria-labelledby="tab-deliverables" className="p-5.5 space-y-6">
            <h2 className="text-small font-bold text-foreground m-0 flex items-center gap-1.5 select-none">
              <Download className="h-4.5 w-4.5 text-muted-foreground/60" />
              <span>Inspected Project Deliverables</span>
            </h2>
            
            {deliverables.length === 0 ? (
              <p className="text-xs text-muted-foreground italic m-0 bg-surface/30 p-4 border border-dashed rounded text-center">No deliverables shared yet by the freelancer.</p>
            ) : (
              <div className="space-y-2">
                {deliverables.map(deliv => (
                  <div key={deliv.id} className="flex justify-between items-center p-3.5 border border-border bg-card hover:bg-surface/30 rounded-lg transition-colors">
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-semibold text-foreground truncate m-0 flex items-center gap-1.5">
                        {deliv.file_type === 'link' && <Link className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />}
                        <span>{deliv.name}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 m-0">
                        {deliv.file_type === 'link' 
                          ? 'External Cloud Resource' 
                          : (deliv.file_size || 0) > 0 ? `${(deliv.file_size! / 1024 / 1024).toFixed(2)} MB` : 'Attached File'}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadDeliverable(deliv.name, deliv.file_url)}
                      icon={deliv.file_type === 'link' ? <ArrowUpRight className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                    >
                      {deliv.file_type === 'link' ? 'Open Link' : 'Download'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

      </div>
    </div>
  );
};
