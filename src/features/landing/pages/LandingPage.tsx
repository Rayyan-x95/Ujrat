import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { SEOMeta } from '@/shared/ui/SEOMeta';
import { JSONLD, getOrganizationSchema, getWebsiteSchema, getSoftwareApplicationSchema } from '@/shared/ui/JSONLD';
import { Button } from '@/shared/ui/Button';
import { UjratLogo } from '@/shared/ui/UjratLogo';
import { 
  Users, 
  FolderKanban, 
  FileText, 
  FileSignature, 
  QrCode, 
  HardDrive, 
  Bell, 
  ChevronRight, 
  ArrowRight, 
  Check, 
  ExternalLink,
  DollarSign,
  Workflow,
  Lock,
  ShieldCheck,
  ChevronDown,
  Search,
  Activity,
  Plus,
  TrendingUp
} from 'lucide-react';

// Custom inline Github SVG to avoid version mismatch in lucide-react exports
const GithubIcon: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
  </svg>
);

// ─── Static module-level data — never recreated on render ───────────────────────
// Note: workflowSteps/features still use JSX icons so they stay inside the component.
// faqs and schemaList are pure data and are hoisted here.
const FAQS = [
  {
    q: 'Is Ujrat completely free to use?',
    a: 'Yes, Ujrat is 100% free and open-source under the MIT license. There are no pricing tiers, no monthly subscriptions, no payment processing commissions, and no user limits. You get access to all features—including client CRM, proposal templates, contract signatures, GST invoicing, UPI QR codes, and file hosting—completely free.'
  },
  {
    q: 'How does Ujrat charge zero fees for payments?',
    a: "Ujrat integrates directly with the Unified Payments Interface (UPI) network of India. By generating dynamic UPI intent strings and QR codes, payments are sent directly from your client's banking app to your linked UPI VPA. Because UPI transaction processing is direct peer-to-peer (P2P/P2M), there are no third-party gateways or commissions involved, resulting in a 0% processing fee."
  },
  {
    q: 'Does it calculate Indian GST automatically?',
    a: "Yes. Ujrat features an automated Indian taxation logic. When generating an invoice, it checks the place of supply (your client's state) against your registered state. It then dynamically calculates and applies CGST + SGST (intra-state) or IGST (inter-state) accordingly. You can also specify custom HSN or SAC codes for each deliverable item."
  },
  {
    q: 'Is the digital contract e-signature legally binding?',
    a: "Yes. Ujrat generates a legally compliant, cryptographically secure digital signature log for every contract. It records the signer's email, timestamp, IP address, and browser agent metadata. These logs are stored in a read-only PostgreSQL database table, establishing a clear audit trail compliant with the Indian Information Technology (IT) Act, 2000."
  },
  {
    q: 'How does the secure file delivery escrow work?',
    a: 'When you upload files for a project, Ujrat stores them securely in a private Supabase Storage bucket. The client can view the files\' metadata (name, size, type) on their portal, but download links are restricted. Once the invoice status changes to "Paid" (either manually marked by you or verified via payment transaction), the system enables access, allowing the client to download the final deliverables.'
  },
  {
    q: 'Can I self-host Ujrat on my own server?',
    a: 'Absolutely! Since Ujrat is open-source, you can clone the repository from GitHub and deploy it on your own Vercel account and Supabase project. We provide complete setup schemas and database migration SQL files in the repository to make self-hosting straightforward.'
  },
  {
    q: 'How is my database security and privacy handled?',
    a: 'Ujrat is designed with a security-first architecture. It utilizes Supabase Row-Level Security (RLS) policies at the database layer. This ensures that every SQL query is scoped to the authenticated user ID, making it impossible for any user to read, edit, or delete data belonging to another workspace.'
  }
];

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeStep, setActiveStep] = useState<number>(0);
  const [emailInput, setEmailInput] = useState('');

  const handleCTAClick = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/signup');
    }
  };

  const handleHeroSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailInput.trim()) {
      navigate(`/signup?email=${encodeURIComponent(emailInput.trim())}`);
    } else {
      navigate('/signup');
    }
  };

  // Interactive Solution Pipeline Workflow Steps
  const workflowSteps = [
    {
      title: 'Client Connect',
      icon: <Users className="h-4 w-4" />,
      description: 'Centralize contact details, billing history, active milestones, and workspace notes in one profile.',
      detail: 'Eliminate WhatsApp chat tracking. Maintain a single source of truth for every client relationship. View aggregate lifetime value (LTV) and on-time payment speed metrics for each client profile instantly.'
    },
    {
      title: 'Project Setup',
      icon: <FolderKanban className="h-4 w-4" />,
      description: 'Define the deliverables, milestones, timeline, and budget parameters.',
      detail: 'Keep production tasks organized. Toggle between grid and list views as the project progresses. Easily manage client scopes, timelines, revisions, and deliverables in one unified dashboard.'
    },
    {
      title: 'Proposal & Pricing',
      icon: <FileText className="h-4 w-4" />,
      description: 'Generate web-based proposals with itemized scopes, terms, and digital approval.',
      detail: 'No more PDF exporting. Clients approve online in one click, creating a seamless audit trail. Set clear milestone pricing structures, advance payments, and revision policies that clients sign off on before you write a single line of code.'
    },
    {
      title: 'Digital Contract',
      icon: <FileSignature className="h-4 w-4" />,
      description: 'Bind scopes to legal clauses. Secure cryptographic signatures before starting work.',
      detail: 'Comes with default contract templates customized for freelance engagements, IP protection, and payment timelines. Cryptographically logged signatures verify agreement terms and protect against scope creep.'
    },
    {
      title: 'GST Invoicing',
      icon: <FileText className="h-4 w-4" />,
      description: 'Create professional GST-compliant invoices with CGST, SGST, IGST, and HSN codes.',
      detail: 'Automatic tax calculations with integrated Indian state rules (e.g. IGST vs SGST/CGST). Dynamically applies discount tables and creates invoice items directly linked to approved project deliverables.'
    },
    {
      title: 'UPI Payment',
      icon: <QrCode className="h-4 w-4" />,
      description: 'Generate dynamic UPI QR codes and deep links. Get paid directly to your bank account.',
      detail: 'Zero transaction fees. Direct UPI routing supports Google Pay, PhonePe, Paytm, BHIM, and any Indian bank application. Pre-fills exact invoicing details to prevent client input mistakes and settlement delays.'
    },
    {
      title: 'Deliverables Delivery',
      icon: <HardDrive className="h-4 w-4" />,
      description: 'Upload files to a secure storage bucket. Release only when invoices are marked as paid.',
      detail: 'Protects your intellectual property. Client portal locks files and restricts downloads until the final payment clears. Direct integration with Supabase Storage guarantees private, lightning-fast file distribution.'
    }
  ];

  // Features list for Bento Grid
  const features = [
    {
      title: 'Client CRM',
      description: 'Maintain clean, dedicated records of all client details, notes, and overall payment histories.',
      icon: <Users className="h-5 w-5 text-primary" />,
      tag: 'Relationships'
    },
    {
      title: 'Project Lifecycles',
      description: 'Track production timelines, milestones, and deliverables from proposal to wrap up.',
      icon: <FolderKanban className="h-5 w-5 text-primary" />,
      tag: 'Kanban'
    },
    {
      title: 'Dynamic Proposals',
      description: 'Create elegant web-based proposals. Let clients approve and comment in real time.',
      icon: <FileText className="h-5 w-5 text-primary" />,
      tag: 'Conversion'
    },
    {
      title: 'E-Sign Contracts',
      description: 'Verify agreements instantly with tamper-evident digital signatures and audit history.',
      icon: <FileSignature className="h-5 w-5 text-primary" />,
      tag: 'Legalities'
    },
    {
      title: 'Indian GST Engine',
      description: 'Auto-calculate CGST, SGST, and IGST rates. Handles state routing and HSN codes automatically.',
      icon: <DollarSign className="h-5 w-5 text-primary" />,
      tag: 'Taxation'
    },
    {
      title: 'UPI Instant Payouts',
      description: 'Generate dynamic QR codes with exact payment amounts to eliminate errors. No middleman fees.',
      icon: <QrCode className="h-5 w-5 text-primary" />,
      tag: 'Payments'
    },
    {
      title: 'Client Portals',
      description: 'A beautiful shared dashboard for clients to review scopes, sign documents, and download files.',
      icon: <Workflow className="h-5 w-5 text-primary" />,
      tag: 'Experience'
    },
    {
      title: 'Secure File Escrow',
      description: 'Store deliverables securely. Automatic download restrictions until the invoice is paid.',
      icon: <Lock className="h-5 w-5 text-primary" />,
      tag: 'Security'
    },
    {
      title: 'Real-time Alerts',
      description: 'Automated email alerts keep clients and freelancers informed of proposals, contracts, and payments.',
      icon: <Bell className="h-5 w-5 text-primary" />,
      tag: 'Automation'
    }
  ];

  // Combine schemas for JSONLD injection
  const schemaList = [
    getWebsiteSchema(),
    getOrganizationSchema(),
    getSoftwareApplicationSchema(),
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'mainEntity': FAQS.map(faq => ({
        '@type': 'Question',
        'name': faq.q,
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': faq.a
        }
      }))
    }
  ];

  // Use module-level FAQS constant
  const faqs = FAQS;

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/10 selection:text-primary">
      <SEOMeta 
        title="Ujrat — The Unified Freelancer Workflow & GST Invoice Portal" 
        description="Connect clients, manage project boards, sign contracts, generate GST invoices, and accept instant zero-fee UPI payments in one integrated workflow."
        canonicalPath="/"
      />
      <JSONLD schema={schemaList} />

      {/* ─── Navigation Header ────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 w-full border-b border-border-subtle bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <a href="/" className="flex items-center gap-2 text-foreground font-semibold font-display">
              <UjratLogo size={38} showText={false} />
            </a>
            <nav className="hidden md:flex items-center gap-6 text-small font-medium text-muted-foreground">
              <a href="#workflow" className="hover:text-foreground transition-colors">Workflow</a>
              <a href="#features" className="hover:text-foreground transition-colors">Features</a>
              <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
              <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
            </nav>
          </div>
          
          <div className="flex items-center gap-2.5">
            {user ? (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate('/dashboard')}
                icon={<ArrowRight className="h-3.5 w-3.5" />}
              >
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => navigate('/login')}
                  className="hidden sm:inline-flex"
                >
                  Sign In
                </Button>
                <Button 
                  variant="primary" 
                  size="sm" 
                  onClick={handleCTAClick}
                >
                  Start Free
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ─── Hero Section ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-16 pb-24 md:pt-24 md:pb-32">
        <div className="mx-auto max-w-7xl px-6 flex flex-col items-center text-center">
          
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/5 px-3 py-1 text-xs font-semibold text-primary border border-primary/10 mb-6 animate-fade-in select-none">
            <span>For freelancers, studios, and agencies &gt;</span>
          </div>

          {/* Heading */}
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground max-w-3xl leading-[1.05] animate-slide-up">
            Run On Facts,<br />Not Guesswork.
          </h1>

          {/* Value Prop */}
          <p className="mt-6 text-body sm:text-title text-muted-foreground max-w-xl leading-relaxed animate-slide-up">
            Ujrat connects your clients, invoices, time, and cash flow, then shows you who's profitable, who pays late, and what's actually working. No more guessing.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto px-4">
            {user ? (
              <Button 
                variant="primary" 
                size="lg" 
                onClick={() => navigate('/dashboard')}
                className="w-full sm:w-auto font-semibold px-8 rounded-full"
                icon={<ArrowRight className="h-4 w-4" />}
              >
                Go to Dashboard
              </Button>
            ) : (
              <>
                <form onSubmit={handleHeroSignUp} className="flex flex-col sm:flex-row items-center gap-2.5 w-full max-w-md shadow-sm border border-border rounded-full p-1 bg-card">
                  <input
                    type="email"
                    placeholder="Enter your professional email..."
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full h-10 px-4 text-small bg-transparent focus-visible:outline-none"
                  />
                  <Button 
                    type="submit"
                    variant="primary" 
                    size="lg" 
                    className="w-full sm:w-auto font-semibold px-6 shrink-0 h-10 text-[13px] rounded-full"
                  >
                    Join waitlist
                  </Button>
                </form>
                <a 
                  href="#use-cases"
                  className="w-full sm:w-auto h-11 px-6 border border-border bg-card hover:bg-secondary text-foreground text-small flex items-center justify-center font-semibold rounded-full transition-colors cursor-pointer"
                >
                  Who is it for &gt;
                </a>
              </>
            )}
          </div>

          {/* Dashboard Section */}
          <div className="relative mt-20 w-full max-w-5xl">
            {/* Background glow layers */}
             <div className="absolute inset-0 bg-linear-to-r from-cyan-400/20 via-blue-500/20 to-indigo-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />

            {/* Floating get started badge */}
            <div className="flex justify-center mb-6">
              <a href="#onboarding" className="inline-flex items-center gap-1.5 rounded-full bg-card px-4 py-1.5 text-xs font-semibold text-foreground border border-border shadow-sm hover:bg-secondary transition-all select-none cursor-pointer">
                <Activity className="h-3 w-3 text-primary animate-pulse" />
                <span>How to get started &gt;</span>
              </a>
            </div>

            {/* Floating Mockup Dashboard Card */}
            <div className="w-full rounded-xl border border-border bg-card shadow-2xl overflow-hidden animate-scale-in text-left">
              {/* Window Chrome bar */}
              <div className="h-11 bg-surface border-b border-border flex items-center px-4 justify-between select-none">
                <div className="flex gap-1.5">
                  <div className="h-3.5 w-3.5 rounded-full bg-border" />
                  <div className="h-3.5 w-3.5 rounded-full bg-border" />
                  <div className="h-3.5 w-3.5 rounded-full bg-border" />
                </div>
                <div className="text-[11px] text-muted-foreground font-mono">ujrat.ninety5.in/cockpit</div>
                <div className="w-12" />
              </div>

              {/* Mockup Workspace Area (Sidebar + Main) */}
              <div className="flex bg-background h-[550px] overflow-hidden">
                
                {/* Mock Desktop Sidebar */}
                <aside className="hidden md:flex flex-col w-[200px] border-r border-border bg-surface shrink-0 p-3 justify-between select-none">
                  <div className="space-y-4">
                    {/* Profile Dropdown Selection block */}
                    <div className="p-1.5 border border-border bg-card rounded-md flex items-center justify-between shadow-xs">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded bg-foreground flex items-center justify-center text-background font-black text-[10px]">TF</div>
                        <span className="font-display font-semibold text-[11px] text-foreground">Trueform</span>
                      </div>
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </div>

                    {/* Sidebar navigation list */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 px-2.5 py-1.5 bg-card border border-border text-foreground font-medium rounded-md text-[11px]">
                        <Activity className="h-3.5 w-3.5 text-primary" />
                        <span>Cockpit</span>
                      </div>
                      <div className="flex items-center gap-2 px-2.5 py-1.5 text-muted-foreground rounded-md text-[11px]">
                        <Search className="h-3.5 w-3.5" />
                        <span>Search</span>
                      </div>
                      
                      {/* Operations category */}
                      <div className="space-y-1.5 pt-2">
                        <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest px-2.5">Operations</p>
                        <div className="flex items-center gap-2 px-2.5 py-1 text-muted-foreground text-[11px]">
                          <Users className="h-3.5 w-3.5 animate-pulse" />
                          <span>Leads</span>
                        </div>
                        <div className="flex items-center gap-2 px-2.5 py-1 text-muted-foreground text-[11px]">
                          <FolderKanban className="h-3.5 w-3.5" />
                          <span>Projects</span>
                        </div>
                        <div className="flex items-center justify-between px-2.5 py-1 text-muted-foreground text-[11px]">
                          <div className="flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5" />
                            <span>Invoices</span>
                          </div>
                          <span className="text-[8px] font-bold font-mono text-primary bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10">₹39.7K</span>
                        </div>
                      </div>

                      {/* Finances category */}
                      <div className="space-y-1.5 pt-2">
                        <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest px-2.5">Finances</p>
                        <div className="flex items-center gap-2 px-2.5 py-1 text-muted-foreground text-[11px]">
                          <HardDrive className="h-3.5 w-3.5" />
                          <span>Drive</span>
                        </div>
                      </div>

                      {/* CRM category */}
                      <div className="space-y-1.5 pt-2">
                        <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest px-2.5">CRM</p>
                        <div className="flex items-center gap-2 px-2.5 py-1 text-muted-foreground text-[11px]">
                          <Users className="h-3.5 w-3.5" />
                          <span>Accounts</span>
                        </div>
                        <div className="flex items-center gap-2 px-2.5 py-1 text-muted-foreground text-[11px]">
                          <Users className="h-3.5 w-3.5" />
                          <span>Contacts</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Profile info */}
                  <div className="p-2 border-t border-border-subtle flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-secondary border border-border flex items-center justify-center font-bold text-[10px] text-foreground">RM</div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-foreground truncate m-0">Rayyan Moore</p>
                    </div>
                  </div>
                </aside>

                {/* Mock Cockpit Content */}
                <div className="flex-1 flex flex-col min-w-0 bg-background overflow-y-auto">
                  {/* Inner top header bar */}
                  <div className="h-12 border-b border-border-subtle px-4 flex items-center justify-between shrink-0 select-none">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">Trueform</span>
                      <span className="text-[10px] text-muted-foreground">/</span>
                      <span className="text-[10px] font-semibold text-foreground">Cockpit</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-md hover:bg-surface border border-border flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer">
                        <Activity className="h-3 w-3" />
                      </div>
                      <div className="h-6 px-2 rounded-md bg-primary text-primary-foreground text-[10px] flex items-center font-semibold gap-1 hover:bg-primary/95 cursor-pointer">
                        <Plus className="h-3 w-3" /> Add New
                      </div>
                    </div>
                  </div>

                  {/* Inner Dashboard Layout (2 Columns) */}
                  <div className="p-4 space-y-4 flex-1">
                    
                    {/* Row with Revenue chart & mini widget side-cards */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      
                      {/* Left side chart area */}
                      <div className="lg:col-span-2 border border-border bg-card rounded-lg p-4 space-y-4">
                        <div className="flex justify-between items-start select-none">
                          <div className="space-y-0.5">
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Monthly Revenue</span>
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-display text-2xl font-bold tracking-tight text-foreground m-0">$62K</h3>
                              <div className="flex items-center gap-0.5 text-[8px] font-bold text-success bg-success/5 border border-success/10 px-1 py-0.2 rounded-full">
                                <TrendingUp className="h-2 w-2" />
                                <span>+23%</span>
                              </div>
                            </div>
                            <p className="text-[10px] text-muted-foreground">$17,499.75 more than last month</p>
                          </div>
                          <div className="flex items-center gap-1 bg-secondary p-0.5 rounded border border-border">
                            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded text-muted-foreground">Last Week</span>
                            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-card text-foreground shadow-xs">Month</span>
                          </div>
                        </div>

                        {/* SVG line chart representing $62K with points */}
                        <div className="w-full relative h-[120px] mt-2">
                          <svg className="w-full h-full" viewBox="0 0 400 120" preserveAspectRatio="none">
                            {/* Grid lines */}
                            {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => (
                              <g key={idx}>
                                <line x1="30" y1={100 - ratio * 80} x2="380" y2={100 - ratio * 80} stroke="var(--border-subtle)" strokeWidth="0.8" strokeDasharray="3 3" />
                                <text x="5" y={100 - ratio * 80 + 3} className="text-[8px] fill-muted-foreground font-mono font-semibold">
                                  {ratio === 0 ? "0" : ratio === 0.25 ? "20K" : ratio === 0.5 ? "40K" : ratio === 0.75 ? "60K" : "80K"}
                                </text>
                              </g>
                            ))}

                            {/* Line Path */}
                            <path 
                              d="M 30 80 L 80 50 L 130 67 L 180 59 L 230 20 L 280 50 L 330 53 L 380 38" 
                              fill="none" 
                              stroke="var(--primary)" 
                              strokeWidth="2" 
                              strokeLinecap="round" 
                              strokeLinejoin="round" 
                            />

                            {/* Area Fill */}
                            <path 
                              d="M 30 80 L 80 50 L 130 67 L 180 59 L 230 20 L 280 50 L 330 53 L 380 38 L 380 100 L 30 100 Z" 
                              fill="url(#mock-chart-glow)" 
                              opacity="0.04" 
                            />

                            {/* Gradient definition */}
                            <defs>
                              <linearGradient id="mock-chart-glow" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--primary)" />
                                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                              </linearGradient>
                            </defs>

                            {/* Dots */}
                            {[
                              { x: 30, y: 80 }, { x: 80, y: 50 }, { x: 130, y: 67 }, { x: 180, y: 59 }, 
                              { x: 230, y: 20 }, { x: 280, y: 50 }, { x: 330, y: 53 }, { x: 380, y: 38 }
                            ].map((p, idx) => (
                              <circle key={idx} cx={p.x} cy={p.y} r="2.5" className="fill-card stroke-primary stroke-[1.5]" />
                            ))}

                            {/* X Axis Months */}
                            {['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct'].map((month, idx) => (
                              <text key={idx} x={30 + idx * 50} y="115" textAnchor="middle" className="text-[8px] fill-muted-foreground font-mono font-bold">
                                {month}
                              </text>
                            ))}
                          </svg>
                        </div>
                      </div>

                      {/* Right side stats list */}
                      <div className="space-y-2 select-none">
                        {[
                          { label: '3 Outstanding Offers', val: '$25,542' },
                          { label: '2 Unpaid Invoices', val: '$39,717' },
                          { label: 'Costs Covered this month', val: '148%' },
                          { label: 'Yearly Revenue Target', val: '86%' },
                          { label: 'Active Clients', val: '13' }
                        ].map((stat, i) => (
                          <div key={i} className="p-2.5 border border-border bg-card rounded-lg flex flex-col justify-center">
                            <span className="text-[8px] font-bold text-muted-foreground uppercase">{stat.label}</span>
                            <span className="font-display text-sm font-bold text-foreground mt-0.5">{stat.val}</span>
                          </div>
                        ))}
                      </div>

                    </div>

                    {/* Bottom Invoices table */}
                    <div className="border border-border bg-card rounded-lg p-4 space-y-3 select-none">
                      <span className="text-[10px] font-bold text-foreground">Open Invoices</span>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px] text-left text-muted-foreground">
                          <thead>
                            <tr className="border-b border-border-subtle text-[9px] font-bold uppercase tracking-wider">
                              <th className="pb-2">Invoice</th>
                              <th className="pb-2">Client</th>
                              <th className="pb-2">Amount</th>
                              <th className="pb-2">Date</th>
                              <th className="pb-2">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-subtle/50">
                            <tr>
                              <td className="py-2.5 font-mono text-foreground font-semibold">016</td>
                              <td className="py-2.5">Miro</td>
                              <td className="py-2.5 text-foreground font-medium">EUR 19'000</td>
                              <td className="py-2.5 font-mono">Oct 19th 2025</td>
                              <td className="py-2.5"><span className="text-[8px] font-bold text-destructive bg-destructive/5 border border-destructive/10 px-1.5 py-0.5 rounded-full">Overdue</span></td>
                            </tr>
                            <tr>
                              <td className="py-2.5 font-mono text-foreground font-semibold">024</td>
                              <td className="py-2.5">Bill Rewards</td>
                              <td className="py-2.5 text-foreground font-medium">USD 12'800</td>
                              <td className="py-2.5 font-mono">Oct 30th 2025</td>
                              <td className="py-2.5"><span className="text-[8px] font-bold text-success bg-success/5 border border-success/10 px-1.5 py-0.5 rounded-full">Paid</span></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </section>



      {/* ─── Problem Section ─────────────────────────────────────────── */}
      <section className="py-20 border-t border-border-subtle">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-label tracking-widest text-primary font-bold">The Problem</h2>
            <p className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Freelancing is simple. Running a business is not.
            </p>
            <p className="mt-4 text-body text-muted-foreground max-w-lg mx-auto">
              Most freelancers spend 30% of their working hours on administrative duties rather than shipping actual deliverables.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* The Old Way */}
            <div className="p-6 border border-destructive/20 bg-destructive/2 rounded-lg space-y-4">
              <h3 className="text-title font-semibold text-destructive flex items-center gap-2">
                ✕ The Fragmented Way
              </h3>
              <ul className="space-y-3.5 text-small text-muted-foreground">
                <li className="flex items-start gap-2.5">
                  <span className="text-destructive shrink-0 mt-0.5">•</span>
                  <span><strong>Scattered details:</strong> Keeping track of client specs in WhatsApp, contracts in drive folders, and payouts in GPay history.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-destructive shrink-0 mt-0.5">•</span>
                  <span><strong>Zero validation:</strong> Clients downloading source files and disappearing before final payment clearance.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-destructive shrink-0 mt-0.5">•</span>
                  <span><strong>Manual Invoicing:</strong> Copy-pasting Word templates for GST details, guessing IGST vs CGST rules.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-destructive shrink-0 mt-0.5">•</span>
                  <span><strong>High Fees:</strong> Giving away 2-4% of hard-earned revenue to traditional invoicing and billing gateways.</span>
                </li>
              </ul>
            </div>

            {/* The Ujrat Way */}
            <div className="p-6 border border-primary/20 bg-primary/2 rounded-lg space-y-4">
              <h3 className="text-title font-semibold text-primary flex items-center gap-2">
                ✓ The Ujrat Workflow
              </h3>
              <ul className="space-y-3.5 text-small text-muted-foreground">
                <li className="flex items-start gap-2.5">
                  <span className="text-primary shrink-0 mt-0.5">•</span>
                  <span><strong>Unified pipeline:</strong> Proposals, contracts, invoicing, files, and payouts connected in a single sequential engine.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-primary shrink-0 mt-0.5">•</span>
                  <span><strong>Escrow delivery:</strong> Client files are automatically locked until payment receipts are verified on-chain or via UPI.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-primary shrink-0 mt-0.5">•</span>
                  <span><strong>Auto-Tax Calculations:</strong> Built-in Indian GST engine dynamically computes exact regional taxation.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-primary shrink-0 mt-0.5">•</span>
                  <span><strong>Zero Payout Fees:</strong> Direct UPI intent integration means instant transfers with absolutely 0% commission.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Solution Section (Interactive Workflow) ──────────────────── */}
      <section id="workflow" className="py-20 bg-surface/30 border-t border-border-subtle">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-label tracking-widest text-primary font-bold">The Solution</h2>
            <p className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              One seamless workflow engine
            </p>
            <p className="mt-4 text-body text-muted-foreground">
              Click on each step below to inspect how Ujrat streamlines that stage of your project lifecycle.
            </p>
          </div>

          {/* Interactive workflow panel */}
          <div className="mt-14 max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
            {/* Left selector */}
            <div className="lg:col-span-1 flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-visible gap-2 pb-4 lg:pb-0 border-b lg:border-b-0 border-border-subtle">
              {workflowSteps.map((step, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveStep(idx)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left text-small font-medium transition-all shrink-0 cursor-pointer ${
                    activeStep === idx 
                      ? 'bg-card text-foreground border border-border shadow-sm ring-1 ring-primary/5' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-surface'
                  }`}
                >
                  <div className={`p-1.5 rounded-md ${activeStep === idx ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                    {step.icon}
                  </div>
                  <span>{step.title}</span>
                </button>
              ))}
            </div>

            {/* Right details display */}
            <div className="lg:col-span-2 p-8 border border-border bg-card rounded-lg flex flex-col justify-between shadow-sm animate-scale-in">
              {(() => {
                const currentStep = workflowSteps[activeStep];
                if (!currentStep) return null;
                return (
                  <div className="space-y-4">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Step 0{activeStep + 1}</span>
                    <h3 className="font-display text-2xl font-bold text-foreground">
                      {currentStep.title}
                    </h3>
                    <p className="text-body text-foreground">
                      {currentStep.description}
                    </p>
                    <p className="text-small text-muted-foreground leading-relaxed">
                      {currentStep.detail}
                    </p>
                  </div>
                );
              })()}

              {/* Step indicator visuals */}
              <div className="mt-8 border-t border-border-subtle pt-6 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {workflowSteps.map((_, idx) => (
                    <div 
                      key={idx} 
                      className={`h-1.5 rounded-full transition-all ${idx === activeStep ? 'w-6 bg-primary' : 'w-1.5 bg-border'}`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    disabled={activeStep === 0}
                    onClick={() => setActiveStep(v => Math.max(0, v - 1))}
                  >
                    Previous
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={activeStep === workflowSteps.length - 1}
                    onClick={() => setActiveStep(v => Math.min(workflowSteps.length - 1, v + 1))}
                  >
                    Next Step
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features Section (Bento Grid) ───────────────────────────── */}
      <section id="features" className="py-20 border-t border-border-subtle">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-label tracking-widest text-primary font-bold">Comprehensive Capabilities</h2>
            <p className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Everything required to scale your business
            </p>
            <p className="mt-4 text-body text-muted-foreground">
              Ujrat brings structural integrity to freelancing. Designed for fast and fluid interactions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {features.map((feat, idx) => (
              <div 
                key={idx} 
                className="p-5 border border-border bg-card rounded-lg flex flex-col justify-between hover:border-muted-foreground/20 hover:shadow-sm transition-all duration-200"
              >
                <div className="space-y-3">
                  <div className="p-2 bg-primary/5 border border-primary/10 rounded-md w-max">
                    {feat.icon}
                  </div>
                  <div>
                    <h3 className="text-title font-semibold text-foreground">{feat.title}</h3>
                    <p className="text-small text-muted-foreground mt-1.5 leading-relaxed">
                      {feat.description}
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-border-subtle/40 flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{feat.tag}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Use Cases Section ────────────────────────────────────────── */}
      <section className="py-20 border-t border-border-subtle bg-surface/20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-label tracking-widest text-primary font-bold">Use Cases</h2>
            <p className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Tailored for modern independent professionals
            </p>
            <p className="mt-4 text-body text-muted-foreground">
              Whether you are coding software, designing interfaces, or consulting on strategy, Ujrat adapts to your specific billing and client relationship needs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Use Case 1 */}
            <div className="p-6 border border-border bg-card rounded-lg flex flex-col justify-between shadow-sm">
              <div className="space-y-4">
                <div className="h-9 w-9 rounded-md bg-primary/5 border border-primary/10 flex items-center justify-center text-primary">
                  <Workflow className="h-5 w-5" />
                </div>
                <h3 className="text-title font-bold text-foreground">Developers & Designers</h3>
                <p className="text-small text-muted-foreground leading-relaxed">
                  Protect your intellectual property. Send digital milestone proposals, get e-signed IP assignments, and upload source files or Figma assets directly to the escrow delivery portal. Files are securely locked until payments are fully cleared.
                </p>
              </div>
            </div>

            {/* Use Case 2 */}
            <div className="p-6 border border-border bg-card rounded-lg flex flex-col justify-between shadow-sm">
              <div className="space-y-4">
                <div className="h-9 w-9 rounded-md bg-primary/5 border border-primary/10 flex items-center justify-center text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <h3 className="text-title font-bold text-foreground">Copywriters & Creators</h3>
                <p className="text-small text-muted-foreground leading-relaxed">
                  Streamline the onboarding intake. Gather clean client requirements and reference files via dynamic brief forms. Link copy deliverables to specific invoice items and calculate regional Indian GST rates instantly.
                </p>
              </div>
            </div>

            {/* Use Case 3 */}
            <div className="p-6 border border-border bg-card rounded-lg flex flex-col justify-between shadow-sm">
              <div className="space-y-4">
                <div className="h-9 w-9 rounded-md bg-primary/5 border border-primary/10 flex items-center justify-center text-primary">
                  <Users className="h-5 w-5" />
                </div>
                <h3 className="text-title font-bold text-foreground">Agencies & Consultants</h3>
                <p className="text-small text-muted-foreground leading-relaxed">
                  Establish permanent client portals for ongoing retainers. Present clean client CRM panels to track multiple project stages, generate zero-fee UPI QR codes for monthly billings, and log automated audit trails for compliance.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How It Works Section ────────────────────────────────────── */}
      <section className="py-20 bg-surface/30 border-t border-border-subtle">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-label tracking-widest text-primary font-bold">Onboarding</h2>
            <p className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Launch in three simple steps
            </p>
            <p className="mt-4 text-body text-muted-foreground">
              Zero complicated configurations. Initialize your workspace and secure client contracts in minutes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto relative">
            {[
              { step: '01', title: 'Connect & Setup UPI', desc: 'Sign up, enter your payout credentials (UPI ID or bank account), and set up tax preferences.' },
              { step: '02', title: 'Draft Proposal & Scope', desc: 'Create a project, build a client profile, and draft an online proposal detailing milestones.' },
              { step: '03', title: 'Invite Client & Get Paid', desc: 'Share the portal link. Your client approves, signs the contract, pays via UPI QR, and unlocks files.' }
            ].map((item, i) => (
              <div key={i} className="relative flex flex-col justify-between p-6 border border-border bg-card rounded-lg shadow-sm">
                <div>
                  <span className="font-mono text-4xl font-extrabold text-primary/15">{item.step}</span>
                  <h3 className="text-title font-semibold text-foreground mt-3">{item.title}</h3>
                  <p className="text-small text-muted-foreground mt-2 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Security & Isolation Section ───────────────────────────────── */}
      <section className="py-20 border-t border-border-subtle bg-background">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-label tracking-widest text-primary font-bold">Security & Isolation</h2>
            <p className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Architected for complete data privacy
            </p>
            <p className="mt-4 text-body text-muted-foreground">
              Ujrat is designed as a secure workspace. Your clients, invoices, and payments are guarded by enterprise-grade cryptographic controls.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <div className="p-6 border border-border bg-card rounded-lg flex flex-col justify-between">
              <div>
                <div className="p-2 bg-primary/5 border border-primary/10 rounded-md w-max text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h3 className="text-title font-semibold text-foreground mt-4">Row-Level Security (RLS)</h3>
                <p className="text-small text-muted-foreground mt-2 leading-relaxed">
                  Every table in the Ujrat database is strictly isolated. Row-Level Security policies at the PostgreSQL layer ensure that users can only read or write records associated with their own verified profile ID.
                </p>
              </div>
            </div>

            <div className="p-6 border border-border bg-card rounded-lg flex flex-col justify-between">
              <div>
                <div className="p-2 bg-primary/5 border border-primary/10 rounded-md w-max text-primary">
                  <Lock className="h-5 w-5" />
                </div>
                <h3 className="text-title font-semibold text-foreground mt-4">Secure Deliverables Escrow</h3>
                <p className="text-small text-muted-foreground mt-2 leading-relaxed">
                  Uploaded files are kept in private Supabase Storage buckets. The server blocks download token generation dynamically until the billing status of the associated deliverable is marked as paid.
                </p>
              </div>
            </div>

            <div className="p-6 border border-border bg-card rounded-lg flex flex-col justify-between">
              <div>
                <div className="p-2 bg-primary/5 border border-primary/10 rounded-md w-max text-primary">
                  <FileSignature className="h-5 w-5" />
                </div>
                <h3 className="text-title font-semibold text-foreground mt-4">Cryptographic Audit Trails</h3>
                <p className="text-small text-muted-foreground mt-2 leading-relaxed">
                  Contract e-signatures generate a tamper-evident audit trail log containing signed email hashes, UTC timestamps, IP routing paths, and browser agent hashes recorded directly into read-only ledger tables.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>



      {/* ─── Pricing Section ─────────────────────────────────────────── */}
      <section id="pricing" className="py-20 bg-surface/30 border-t border-border-subtle">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-label tracking-widest text-primary font-bold">100% Free & Open Source</h2>
            <p className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              No subscription tiers. No commissions.
            </p>
            <p className="mt-4 text-body text-muted-foreground">
              Ujrat is built to empower freelancers. All features are fully unlocked for everyone, with zero payment gateway fees.
            </p>
          </div>

          <div className="max-w-3xl mx-auto border border-primary bg-card rounded-lg p-8 md:p-10 shadow-md relative overflow-hidden flex flex-col md:flex-row items-center gap-8 justify-between">
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold tracking-wider px-3 py-1 rounded-bl-lg uppercase">
              MIT Licensed
            </div>
            
            <div className="space-y-4 max-w-lg">
              <h3 className="text-display text-2xl font-bold text-foreground">Core Workspace</h3>
              <p className="text-body text-muted-foreground leading-relaxed">
                Enjoy complete access to client CRM boards, digital proposal templates, e-signatures, GST calculations, dynamic UPI payments, and secure file hosting with absolutely no credit card required.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 pt-2 text-small text-muted-foreground font-medium">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span>Unlimited Clients</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span>Unlimited Projects</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span>0% Payment Commissions</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span>Self-Hosting Enabled</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center shrink-0 w-full md:w-auto p-6 bg-secondary/30 rounded-lg border border-border">
              <span className="text-label uppercase tracking-widest text-muted-foreground text-[10px]">Monthly Fee</span>
              <span className="font-display text-5xl font-extrabold text-foreground mt-2">₹0</span>
              <span className="text-small text-muted-foreground mt-1">Free Forever</span>
              <Button 
                variant="primary" 
                size="md" 
                onClick={handleCTAClick}
                className="w-full md:w-48 mt-6 font-semibold shadow-sm"
              >
                Launch Workspace
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQ Section (SEO Optimized Accordion) ───────────────────── */}
      <section id="faq" className="py-20 border-t border-border-subtle">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center mb-14">
            <h2 className="text-label tracking-widest text-primary font-bold">Frequently Asked Questions</h2>
            <p className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Got questions? We have answers.
            </p>
          </div>

          <div className="max-w-2xl mx-auto space-y-4">
            {faqs.map((faq, idx) => (
              <details 
                key={idx} 
                className="group border border-border rounded-lg bg-card overflow-hidden [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex items-center justify-between gap-4 p-5 text-title font-medium text-foreground cursor-pointer select-none focus-visible:outline-none">
                  <span>{faq.q}</span>
                  <span className="transition-transform group-open:rotate-180">
                    <ChevronRight className="h-4 w-4 text-muted-foreground rotate-90" />
                  </span>
                </summary>
                <div className="p-5 pt-0 border-t border-border-subtle/50 text-small text-muted-foreground leading-relaxed">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Call To Action Section ──────────────────────────────────── */}
      <section className="py-20 bg-surface/30 border-t border-border-subtle">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <div className="mx-auto max-w-2xl">
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Elevate your freelance workflow today
            </h2>
            <p className="mt-4 text-body text-muted-foreground">
              Sign up for Ujrat and experience a completely seamless, secure, and professional client payment lifecycle.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <Button 
                variant="primary" 
                size="lg" 
                onClick={handleCTAClick}
                className="w-full sm:w-auto font-semibold px-8"
              >
                Get Started for Free
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                onClick={() => window.open('https://github.com/ujrat', '_blank')}
                className="w-full sm:w-auto"
                icon={<GithubIcon className="h-4 w-4" />}
              >
                Explore Repository
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer Section ──────────────────────────────────────────── */}
      <footer className="border-t border-border-subtle bg-card py-12 text-small text-muted-foreground">
        <div className="mx-auto max-w-7xl px-6 grid grid-cols-2 md:grid-cols-5 gap-8">
          
          {/* Logo Brand lockup */}
          <div className="col-span-2 space-y-4">
            <UjratLogo size={38} showText={true} />
            <p className="text-small text-muted-foreground leading-relaxed max-w-xs">
              Ujrat is the premium freelance workflow and GST invoicing portal for Indian freelancers. Designed for absolute simplicity.
            </p>
            <p className="text-[11px] text-muted-foreground/60">
              © {new Date().getFullYear()} Ujrat. All rights reserved.
            </p>
          </div>

          {/* Links cols */}
          <div>
            <h4 className="font-semibold text-foreground text-small uppercase tracking-wider mb-4">Product</h4>
            <ul className="space-y-2.5">
              <li><a href="#workflow" className="hover:text-foreground transition-colors">Workflow</a></li>
              <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
              <li><a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground text-small uppercase tracking-wider mb-4">Resources</h4>
            <ul className="space-y-2.5">
              <li><a href="https://github.com/ujrat" className="hover:text-foreground transition-colors inline-flex items-center gap-1">GitHub <ExternalLink className="h-3 w-3" /></a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Documentation</a></li>
              <li><a href="#faq" className="hover:text-foreground transition-colors">FAQs</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground text-small uppercase tracking-wider mb-4">Legal</h4>
            <ul className="space-y-2.5">
              <li><a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Security Rules</a></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
