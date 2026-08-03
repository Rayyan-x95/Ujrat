import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { SEOMeta } from '@/shared/ui/SEOMeta';
import { JSONLD, getOrganizationSchema } from '@/shared/ui/JSONLD';
import { UjratLogo } from '@/shared/ui/UjratLogo';
import { Button } from '@/shared/ui/Button';
import { 
  ShieldCheck, 
  Lock, 
  FileSignature, 
  Check, 
  ArrowLeft, 
  Activity,
  Mail
} from 'lucide-react';

// Common Public Shell Layout
const PublicLayout: React.FC<{ children: React.ReactNode; activePath: string }> = ({ children, activePath }) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-primary/10 selection:text-primary">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border-subtle bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 text-foreground font-semibold font-display">
              <UjratLogo size={38} showText={true} />
            </Link>
            <nav className="hidden md:flex items-center gap-6 text-small font-medium text-muted-foreground">
              <Link to="/features" className={`hover:text-foreground transition-colors ${activePath === '/features' ? 'text-foreground font-semibold' : ''}`}>Features</Link>
              <Link to="/pricing" className={`hover:text-foreground transition-colors ${activePath === '/pricing' ? 'text-foreground font-semibold' : ''}`}>Pricing</Link>
              <Link to="/gst" className={`hover:text-foreground transition-colors ${activePath === '/gst' ? 'text-foreground font-semibold' : ''}`}>GST Engine</Link>
              <Link to="/upi" className={`hover:text-foreground transition-colors ${activePath === '/upi' ? 'text-foreground font-semibold' : ''}`}>UPI Payouts</Link>
              <Link to="/docs" className={`hover:text-foreground transition-colors ${activePath === '/docs' ? 'text-foreground font-semibold' : ''}`}>Docs</Link>
            </nav>
          </div>
          <div className="flex items-center gap-2.5">
            <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>Sign In</Button>
            <Button variant="primary" size="sm" onClick={() => navigate('/signup')}>Start Free Workspace</Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 py-12 px-6 max-w-4xl mx-auto w-full">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border-subtle bg-card py-12 text-small text-muted-foreground">
        <div className="mx-auto max-w-7xl px-6 grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 space-y-4">
            <UjratLogo size={38} showText={true} />
            <p className="text-small text-muted-foreground leading-relaxed max-w-xs">
              Ujrat is the premium freelance workflow and GST invoicing portal for Indian freelancers.
            </p>
            <p className="text-[11px] text-muted-foreground/60">
              © {new Date().getFullYear()} Ujrat. All rights reserved.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-foreground text-small uppercase tracking-wider mb-4">Product</h4>
            <ul className="space-y-2.5">
              <li><Link to="/features" className="hover:text-foreground transition-colors">Features</Link></li>
              <li><Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link></li>
              <li><Link to="/gst" className="hover:text-foreground transition-colors">GST Engine</Link></li>
              <li><Link to="/upi" className="hover:text-foreground transition-colors">UPI Payouts</Link></li>
              <li><Link to="/contracts" className="hover:text-foreground transition-colors">E-Contracts</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-foreground text-small uppercase tracking-wider mb-4">Resources</h4>
            <ul className="space-y-2.5">
              <li><Link to="/docs" className="hover:text-foreground transition-colors">Documentation</Link></li>
              <li><Link to="/faq" className="hover:text-foreground transition-colors">FAQs</Link></li>
              <li><Link to="/status" className="hover:text-foreground transition-colors">Status</Link></li>
              <li><Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-foreground text-small uppercase tracking-wider mb-4">Legal</h4>
            <ul className="space-y-2.5">
              <li><Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link></li>
              <li><Link to="/security" className="hover:text-foreground transition-colors">Security Rules</Link></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
};

// 1. Privacy Policy Page
export const PrivacyPage: React.FC = () => (
  <PublicLayout activePath="/privacy">
    <SEOMeta title="Privacy Policy" description="Ujrat Privacy Policy and DPDP Act 2023 compliance guidelines for Indian freelancers." canonicalPath="/privacy" />
    <JSONLD schema={[getOrganizationSchema()]} />
    <article className="space-y-6">
      <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground">Privacy Policy</h1>
      <p className="text-muted-foreground text-small">Last updated: July 29, 2026</p>
      
      <section className="space-y-3">
        <h2 className="text-title font-semibold text-foreground">1. Commitment to Data Privacy</h2>
        <p className="text-body text-muted-foreground leading-relaxed">
          Ujrat is built with a security-first architecture. We respect your personal and financial data. We do not sell your personal information or client records to third parties.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-title font-semibold text-foreground">2. Information We Collect</h2>
        <p className="text-body text-muted-foreground leading-relaxed">
          We collect basic authentication information (email address), workspace profiles, invoice metadata, and billing details necessary to generate Indian GST-compliant invoices and route UPI payments.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-title font-semibold text-foreground">3. Database Security & Isolation</h2>
        <p className="text-body text-muted-foreground leading-relaxed">
          All workspace data is protected using PostgreSQL Row-Level Security (RLS) policies. Only authenticated profiles have read or write access to their respective workspace records.
        </p>
      </section>
    </article>
  </PublicLayout>
);

// 2. Terms of Service Page
export const TermsPage: React.FC = () => (
  <PublicLayout activePath="/terms">
    <SEOMeta title="Terms of Service" description="Ujrat Terms of Service and legal usage agreement under the Indian Information Technology Act 2000." canonicalPath="/terms" />
    <JSONLD schema={[getOrganizationSchema()]} />
    <article className="space-y-6">
      <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground">Terms of Service</h1>
      <p className="text-muted-foreground text-small">Last updated: July 29, 2026</p>

      <section className="space-y-3">
        <h2 className="text-title font-semibold text-foreground">1. Open-Source Platform Usage</h2>
        <p className="text-body text-muted-foreground leading-relaxed">
          Ujrat is provided as open-source software under the MIT License. You are free to use, modify, and self-host the application in accordance with terms.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-title font-semibold text-foreground">2. Digital Signature Verification</h2>
        <p className="text-body text-muted-foreground leading-relaxed">
          Contracts signed via Ujrat log cryptographic signatures, IP addresses, and timestamps compliant with the Information Technology (IT) Act, 2000 of India.
        </p>
      </section>
    </article>
  </PublicLayout>
);

// 3. Security Page
export const SecurityPage: React.FC = () => (
  <PublicLayout activePath="/security">
    <SEOMeta title="Security & Isolation Architecture" description="Learn about Ujrat enterprise-grade PostgreSQL Row-Level Security, private storage escrow, and cryptographic audit logs." canonicalPath="/security" />
    <article className="space-y-8">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground">Security & Isolation Architecture</h1>
        <p className="text-muted-foreground text-body mt-2">Enterprise-grade data isolation and cryptographic verification for freelancers.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 border border-border bg-card rounded-lg space-y-3">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h2 className="text-title font-semibold text-foreground">Row-Level Security (RLS)</h2>
          <p className="text-small text-muted-foreground">Database-level execution policies prevent multi-tenant data leaks.</p>
        </div>
        <div className="p-6 border border-border bg-card rounded-lg space-y-3">
          <Lock className="h-6 w-6 text-primary" />
          <h2 className="text-title font-semibold text-foreground">Escrow Storage</h2>
          <p className="text-small text-muted-foreground">Deliverables locked securely in private buckets until payment clearance.</p>
        </div>
        <div className="p-6 border border-border bg-card rounded-lg space-y-3">
          <FileSignature className="h-6 w-6 text-primary" />
          <h2 className="text-title font-semibold text-foreground">Cryptographic Logs</h2>
          <p className="text-small text-muted-foreground">Tamper-evident legal signature trails saved directly to read-only tables.</p>
        </div>
      </div>
    </article>
  </PublicLayout>
);

// 4. Pricing Page
export const PricingPage: React.FC = () => (
  <PublicLayout activePath="/pricing">
    <SEOMeta title="100% Free & Open-Source Pricing" description="Ujrat is 100% free forever. No monthly subscriptions, no payment gateway fees, and no user limits." canonicalPath="/pricing" />
    <article className="space-y-8 text-center max-w-2xl mx-auto">
      <h1 className="font-display text-4xl font-bold tracking-tight text-foreground">100% Free & Open Source</h1>
      <p className="text-body text-muted-foreground">No hidden commissions. No tiered paywalls. Complete workspace access for every freelancer.</p>
      <div className="p-8 border border-primary bg-card rounded-xl shadow-sm text-left space-y-6">
        <div className="flex justify-between items-center border-b border-border pb-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">Core Workspace</h2>
            <p className="text-small text-muted-foreground">Full feature access</p>
          </div>
          <span className="font-display text-4xl font-black text-foreground">₹0</span>
        </div>
        <ul className="space-y-3 text-small text-muted-foreground">
          <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Unlimited Clients & Projects</li>
          <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Indian GST Invoicing Engine</li>
          <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Zero-Fee UPI Intent & QR Payments</li>
          <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Cryptographic E-Sign Contracts</li>
          <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Self-Hosting Option</li>
        </ul>
      </div>
    </article>
  </PublicLayout>
);

// 5. Features Page
export const FeaturesPage: React.FC = () => (
  <PublicLayout activePath="/features">
    <SEOMeta title="Features — Comprehensive Freelance Platform" description="Discover Ujrat client CRM, project boards, contract signing, Indian GST invoices, and zero-fee UPI payouts." canonicalPath="/features" />
    <article className="space-y-8">
      <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground text-center">Comprehensive Platform Features</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 border border-border bg-card rounded-lg space-y-2">
          <h2 className="text-title font-bold text-foreground">Client CRM & Management</h2>
          <p className="text-small text-muted-foreground">Maintain structured records of client contacts, notes, and aggregate payment velocity.</p>
        </div>
        <div className="p-6 border border-border bg-card rounded-lg space-y-2">
          <h2 className="text-title font-bold text-foreground">Indian GST Tax Engine</h2>
          <p className="text-small text-muted-foreground">Automatically calculates CGST + SGST or IGST based on regional state routing and HSN codes.</p>
        </div>
        <div className="p-6 border border-border bg-card rounded-lg space-y-2">
          <h2 className="text-title font-bold text-foreground">UPI Intent & QR Codes</h2>
          <p className="text-small text-muted-foreground">Direct P2P banking transfers with 0% payment gateway processing commissions.</p>
        </div>
        <div className="p-6 border border-border bg-card rounded-lg space-y-2">
          <h2 className="text-title font-bold text-foreground">Escrow Deliverables Delivery</h2>
          <p className="text-small text-muted-foreground">Automated file access restrictions until invoices are marked as paid.</p>
        </div>
      </div>
    </article>
  </PublicLayout>
);

// 6. GST Engine Page
export const GSTPage: React.FC = () => (
  <PublicLayout activePath="/gst">
    <SEOMeta title="Indian GST Invoicing Engine for Freelancers" description="Automated Indian regional taxation calculations: CGST, SGST, IGST, and HSN/SAC codes." canonicalPath="/gst" />
    <article className="space-y-6">
      <h1 className="font-display text-3xl font-bold text-foreground">Automated Indian GST Engine</h1>
      <p className="text-body text-muted-foreground leading-relaxed">
        Ujrat automatically determines place of supply rules. If your client is in the same Indian state, it splits taxes into CGST + SGST with integer paise rounding accuracy. For inter-state clients, IGST is applied seamlessly.
      </p>
    </article>
  </PublicLayout>
);

// 7. UPI Page
export const UPIPage: React.FC = () => (
  <PublicLayout activePath="/upi">
    <SEOMeta title="Zero-Fee UPI Intent & QR Payments" description="Accept instant freelance payments via Google Pay, PhonePe, Paytm, and BHIM with 0% gateway commission." canonicalPath="/upi" />
    <article className="space-y-6">
      <h1 className="font-display text-3xl font-bold text-foreground">Zero-Commission UPI Payouts</h1>
      <p className="text-body text-muted-foreground leading-relaxed">
        Bypasses traditional 2-4% gateway commissions by generating direct Unified Payments Interface (UPI) intent links and dynamic QR codes mapped to your VPA.
      </p>
    </article>
  </PublicLayout>
);

// 8. Contracts Page
export const ContractsPage: React.FC = () => (
  <PublicLayout activePath="/contracts">
    <SEOMeta title="Cryptographically Signed Digital Contracts" description="Bind client proposals to legally binding contract templates with tamper-evident audit trails." canonicalPath="/contracts" />
    <article className="space-y-6">
      <h1 className="font-display text-3xl font-bold text-foreground">Digital E-Sign Contracts</h1>
      <p className="text-body text-muted-foreground leading-relaxed">
        Create enforceable freelance contracts before writing code. Signature events capture timestamp, IP address, and email hashes under IT Act 2000 guidelines.
      </p>
    </article>
  </PublicLayout>
);

// 9. Documentation Page
export const DocsPage: React.FC = () => (
  <PublicLayout activePath="/docs">
    <SEOMeta title="Documentation & Self-Hosting Guide" description="Complete developer documentation, database migration guides, and self-hosting instructions." canonicalPath="/docs" />
    <article className="space-y-6">
      <h1 className="font-display text-3xl font-bold text-foreground">Developer Documentation</h1>
      <p className="text-body text-muted-foreground leading-relaxed">
        Learn how to clone, configure, and self-host Ujrat on Vercel and Supabase. Baseline SQL schemas and migration scripts are available in the public repository.
      </p>
    </article>
  </PublicLayout>
);

// 10. Contact Page
export const ContactPage: React.FC = () => (
  <PublicLayout activePath="/contact">
    <SEOMeta title="Contact & Community Support" description="Get in touch with the Ujrat team or report issues on GitHub." canonicalPath="/contact" />
    <article className="space-y-6 text-center max-w-lg mx-auto">
      <h1 className="font-display text-3xl font-bold text-foreground">Get in Touch</h1>
      <p className="text-body text-muted-foreground">Have questions or feature requests? We'd love to hear from you.</p>
      <div className="p-6 border border-border bg-card rounded-lg flex flex-col items-center gap-4">
        <Mail className="h-8 w-8 text-primary" />
        <p className="text-small font-semibold text-foreground">support@ninety5.in</p>
      </div>
    </article>
  </PublicLayout>
);

// 11. Status Page
export const StatusPage: React.FC = () => (
  <PublicLayout activePath="/status">
    <SEOMeta title="System Status & Uptime" description="Real-time operational status of Ujrat API, Database, and Storage services." canonicalPath="/status" />
    <article className="space-y-6">
      <h1 className="font-display text-3xl font-bold text-foreground">System Status</h1>
      <div className="p-4 border border-success/30 bg-success/5 rounded-lg flex items-center gap-3">
        <Activity className="h-5 w-5 text-success" />
        <span className="text-small font-semibold text-success">All Systems Operational (100% Uptime)</span>
      </div>
    </article>
  </PublicLayout>
);

// 12. FAQ Page
export const FAQPage: React.FC = () => (
  <PublicLayout activePath="/faq">
    <SEOMeta title="Frequently Asked Questions" description="Answers to common questions about Ujrat pricing, GST calculations, UPI payouts, and security." canonicalPath="/faq" />
    <article className="space-y-6">
      <h1 className="font-display text-3xl font-bold text-foreground">Frequently Asked Questions</h1>
      <div className="space-y-4">
        <div className="p-4 border border-border bg-card rounded-lg space-y-2">
          <h2 className="text-title font-semibold text-foreground">Is Ujrat completely free?</h2>
          <p className="text-small text-muted-foreground">Yes, 100% free and open-source under the MIT license with zero commission fees.</p>
        </div>
        <div className="p-4 border border-border bg-card rounded-lg space-y-2">
          <h2 className="text-title font-semibold text-foreground">Does it support Indian GST?</h2>
          <p className="text-small text-muted-foreground">Yes, automated intra-state (CGST+SGST) and inter-state (IGST) routing with HSN code support.</p>
        </div>
      </div>
    </article>
  </PublicLayout>
);

// 13. Dedicated 404 Page
export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <PublicLayout activePath="/404">
      <SEOMeta title="404 — Page Not Found" description="The requested page could not be found on Ujrat." canonicalPath="/404" />
      <div className="text-center py-16 space-y-4">
        <h1 className="font-display text-6xl font-extrabold text-foreground">404</h1>
        <h2 className="text-title font-semibold text-foreground">Page Not Found</h2>
        <p className="text-body text-muted-foreground max-w-sm mx-auto">The page you are looking for does not exist or has been moved.</p>
        <Button variant="primary" size="md" onClick={() => navigate('/')} icon={<ArrowLeft className="h-4 w-4" />}>
          Back to Homepage
        </Button>
      </div>
    </PublicLayout>
  );
};
