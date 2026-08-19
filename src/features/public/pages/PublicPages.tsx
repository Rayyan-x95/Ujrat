import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { SEOMeta } from '@/shared/ui/SEOMeta';
import { 
  JSONLD, 
  getOrganizationSchema, 
  getTechArticleSchema, 
  getLegalLegislationSchema,
  getHowToSchema, 
  getFAQSchema, 
  getPricingOfferSchema 
} from '@/shared/ui/JSONLD';
import { UjratLogo } from '@/shared/ui/UjratLogo';
import { UniversalNavbar } from '@/shared/ui/UniversalNavbar';
import { Button } from '@/shared/ui/Button';
import { 
  ShieldCheck, 
  Lock, 
  FileSignature, 
  Check, 
  ArrowLeft, 
  Activity,
  Mail,
  Sparkles
} from 'lucide-react';

// Common Public Shell Layout
const PublicLayout: React.FC<{ children: React.ReactNode; activePath: string }> = ({ children, activePath }) => {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-primary/10 selection:text-primary">
      {/* Top Universal Navbar */}
      <UniversalNavbar activePath={activePath} />

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
              Ujrat is the modern freelance workflow engine and GST invoicing portal for Indian freelancers. 100% free and open-source.
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
              <li><Link to="/waitlist" className="hover:text-foreground transition-colors font-medium text-primary">Early Access Waitlist</Link></li>
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
    <SEOMeta title="Privacy Policy" description="Ujrat Privacy Policy and Digital Personal Data Protection (DPDP) Act 2023 compliance guidelines for Indian freelancers." canonicalPath="/privacy" />
    <JSONLD schema={[
      getOrganizationSchema(),
      getLegalLegislationSchema(
        'Digital Personal Data Protection Act, 2023',
        'DPDP Act 2023 (India)',
        'Data fiduciary standards, purpose limitation, and data principal privacy rights for Indian freelance workspace accounts.'
      )
    ]} />
    <article className="space-y-6">
      <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground">Privacy Policy</h1>
      <p className="text-muted-foreground text-small">Last updated: August 20, 2026</p>
      
      <section className="space-y-3">
        <h2 className="text-title font-semibold text-foreground">1. Commitment to Data Privacy & DPDP Compliance</h2>
        <p className="text-body text-muted-foreground leading-relaxed">
          Ujrat operates in full compliance with the Digital Personal Data Protection (DPDP) Act, 2023 of India. We act as a technology facilitator and data fiduciary strictly processing data for your defined workspace workflows. We do not sell, rent, monetize, or disclose your client contacts, financial ledgers, or invoice records to third parties or advertising networks.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-title font-semibold text-foreground">2. Information We Collect</h2>
        <p className="text-body text-muted-foreground leading-relaxed">
          We collect basic authentication information (email address), workspace business profiles (business name, registered state, optional GSTIN), and invoice metadata required to compute statutory GST tax liabilities and render dynamic UPI payment QR codes.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-title font-semibold text-foreground">3. Database Security & Row-Level Isolation</h2>
        <p className="text-body text-muted-foreground leading-relaxed">
          All workspace data is strictly isolated using PostgreSQL Row-Level Security (RLS) policies. Only authenticated profile tokens can read or write records associated with their workspace ID. Deliverables uploaded to storage buckets remain encrypted and inaccessible to unauthorized parties.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-title font-semibold text-foreground">4. Statutory Grievance Redressal (IT Rules 2021)</h2>
        <p className="text-body text-muted-foreground leading-relaxed">
          In accordance with the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, you may contact our designated Grievance Officer regarding any data privacy or account integrity concerns at <code className="text-primary text-[12px] bg-primary/5 px-1 py-0.5 rounded">support@ninety5.in</code>.
        </p>
      </section>
    </article>
  </PublicLayout>
);

// 2. Terms of Service Page
export const TermsPage: React.FC = () => (
  <PublicLayout activePath="/terms">
    <SEOMeta title="Terms of Service" description="Ujrat Terms of Service and legal usage agreement under the Indian Information Technology Act 2000." canonicalPath="/terms" />
    <JSONLD schema={[
      getOrganizationSchema(),
      getLegalLegislationSchema(
        'Information Technology Act, 2000',
        'Section 10A & Section 65B',
        'Legal recognition of electronic records and contract formation in India.'
      )
    ]} />
    <article className="space-y-6">
      <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground">Terms of Service</h1>
      <p className="text-muted-foreground text-small">Last updated: August 20, 2026</p>

      <section className="space-y-3">
        <h2 className="text-title font-semibold text-foreground">1. Open-Source Platform Usage</h2>
        <p className="text-body text-muted-foreground leading-relaxed">
          Ujrat is provided as open-source software under the permissive MIT License. You are free to use, inspect, customize, and self-host the application for commercial or personal freelance operations.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-title font-semibold text-foreground">2. Digital Signature Verification & IT Act 2000</h2>
        <p className="text-body text-muted-foreground leading-relaxed">
          Contracts and project proposals signed via Ujrat log cryptographic signatures, IP addresses, and timestamps compliant with Section 10A of the Information Technology (IT) Act, 2000 of India and Section 65B of the Indian Evidence Act, 1872. Users agree to utilize honest and authorized credentials during document execution.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-title font-semibold text-foreground">3. Disclaimer of Legal & Tax Advice</h2>
        <p className="text-body text-muted-foreground leading-relaxed">
          Ujrat provides workflow tooling, GST arithmetic calculations, and document scaffolding. Ujrat is not a law firm or Chartered Accountant firm and does not provide formal legal representation. Users are encouraged to consult certified tax advisors for complex multi-jurisdictional tax filings.
        </p>
      </section>
    </article>
  </PublicLayout>
);

// 3. Security Page
export const SecurityPage: React.FC = () => (
  <PublicLayout activePath="/security">
    <SEOMeta title="Security & Isolation Architecture" description="Learn about Ujrat enterprise-grade PostgreSQL Row-Level Security, private storage escrow, and cryptographic audit logs." canonicalPath="/security" />
    <JSONLD schema={[getOrganizationSchema(), getTechArticleSchema('Security & Isolation Architecture', 'Enterprise data isolation and cryptographic audit trails for Indian freelancers', '/security')]} />
    <article className="space-y-8">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground">Security & Isolation Architecture</h1>
        <p className="text-muted-foreground text-body mt-2">Enterprise-grade data isolation, encrypted file escrow, and cryptographic verification for freelancers.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 border border-border bg-card rounded-lg space-y-3">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h2 className="text-title font-semibold text-foreground">Row-Level Security (RLS)</h2>
          <p className="text-small text-muted-foreground leading-relaxed">PostgreSQL database policies strictly enforce tenant boundaries at the SQL execution layer, preventing any cross-workspace leakage.</p>
        </div>
        <div className="p-6 border border-border bg-card rounded-lg space-y-3">
          <Lock className="h-6 w-6 text-primary" />
          <h2 className="text-title font-semibold text-foreground">Escrow Deliverable Storage</h2>
          <p className="text-small text-muted-foreground leading-relaxed">Source code and creative assets are locked in private storage buckets with automated download gating until invoice payments clear.</p>
        </div>
        <div className="p-6 border border-border bg-card rounded-lg space-y-3">
          <FileSignature className="h-6 w-6 text-primary" />
          <h2 className="text-title font-semibold text-foreground">Cryptographic Audit Trails</h2>
          <p className="text-small text-muted-foreground leading-relaxed">Tamper-evident legal signature trails with IP addresses, hashes, and UTC timestamps recorded directly to append-only tables.</p>
        </div>
      </div>
    </article>
  </PublicLayout>
);

// 4. Pricing Page
export const PricingPage: React.FC = () => (
  <PublicLayout activePath="/pricing">
    <SEOMeta title="100% Free & Open-Source Pricing" description="Ujrat is 100% free forever. No monthly subscriptions, 0% payment gateway fees, and no client limits for Indian freelancers." canonicalPath="/pricing" />
    <JSONLD schema={[getOrganizationSchema(), getPricingOfferSchema()]} />
    <article className="space-y-8 text-center max-w-2xl mx-auto">
      <h1 className="font-display text-4xl font-bold tracking-tight text-foreground">100% Free & Open Source</h1>
      <p className="text-body text-muted-foreground">Zero hidden commissions. Zero tiered paywalls. Complete workspace and GST invoicing access for every freelancer.</p>
      
      {/* Pricing Comparison Card */}
      <div className="p-8 border border-primary/40 bg-card rounded-2xl shadow-md text-left space-y-6 relative overflow-hidden">
        <div className="flex justify-between items-center border-b border-border pb-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">Core Workspace</h2>
            <p className="text-small text-muted-foreground">Full feature access forever</p>
          </div>
          <div className="text-right">
            <span className="font-display text-4xl font-black text-foreground">₹0</span>
            <span className="block text-[11px] text-primary font-semibold">Free Forever (MIT)</span>
          </div>
        </div>
        <ul className="space-y-3 text-small text-muted-foreground">
          <li className="flex items-center gap-2.5"><Check className="h-4 w-4 text-primary shrink-0" /> <span><strong>Unlimited Clients & Projects</strong> — No limits or quotas</span></li>
          <li className="flex items-center gap-2.5"><Check className="h-4 w-4 text-primary shrink-0" /> <span><strong>Indian GST Invoicing Engine</strong> — CGST, SGST, IGST & SAC 998314</span></li>
          <li className="flex items-center gap-2.5"><Check className="h-4 w-4 text-primary shrink-0" /> <span><strong>0% Commission Direct UPI Payouts</strong> — Keep 100% of your earnings</span></li>
          <li className="flex items-center gap-2.5"><Check className="h-4 w-4 text-primary shrink-0" /> <span><strong>Cryptographic E-Sign Contracts</strong> — Section 10A IT Act 2000 compliant</span></li>
          <li className="flex items-center gap-2.5"><Check className="h-4 w-4 text-primary shrink-0" /> <span><strong>Deliverables Escrow Vault</strong> — Protect work until payment clears</span></li>
          <li className="flex items-center gap-2.5"><Check className="h-4 w-4 text-primary shrink-0" /> <span><strong>Self-Hosting Enabled</strong> — Full source code on GitHub</span></li>
        </ul>
      </div>

      {/* Savings Benchmark */}
      <div className="p-6 border border-border bg-surface/40 rounded-xl text-left space-y-2">
        <h3 className="text-title font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Save ₹12,000 to ₹36,000 Annually
        </h3>
        <p className="text-small text-muted-foreground leading-relaxed">
          Traditional SaaS billing platforms and payment gateways charge 2% to 4% plus monthly SaaS fees. On ₹5,00,000 of freelance client invoicing, Ujrat saves you over ₹15,000 in payment deductions and ₹12,000+ in software subscription fees every year.
        </p>
      </div>
    </article>
  </PublicLayout>
);

// 5. Features Page
export const FeaturesPage: React.FC = () => (
  <PublicLayout activePath="/features">
    <SEOMeta 
      title="Freelance CRM, GST Invoices & UPI Payments Features" 
      description="Explore Ujrat's end-to-end freelance workspace: client CRM, proposal templates, IT Act compliant digital contracts, Indian GST invoices, and zero-fee UPI QR payments." 
      canonicalPath="/features" 
    />
    <JSONLD schema={[
      getOrganizationSchema(),
      getTechArticleSchema(
        'The Complete Freelancer Operating System Features',
        'End-to-end freelance workflow engine for Indian freelancers: client CRM, digital contracts, automated GST, and zero-fee UPI payments.',
        '/features'
      )
    ]} />
    <article className="space-y-10">
      <div className="text-center space-y-2">
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground">The Complete Freelancer Operating System</h1>
        <p className="text-body text-muted-foreground max-w-2xl mx-auto">From initial client lead to final zero-fee UPI bank settlement, Ujrat unifies your entire freelance lifecycle into one sequential pipeline.</p>
      </div>

      {/* Passage-level AI Definition Block */}
      <div className="p-6 border border-primary/20 bg-primary/5 rounded-xl space-y-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">What is Ujrat?</span>
        <p className="text-body text-foreground leading-relaxed">
          Ujrat is a unified, open-source freelance workspace platform designed specifically for Indian independent developers, designers, writers, and consultants. It eliminates fragmented spreadsheets and third-party SaaS subscriptions by combining client CRM, proposal creation, legally binding digital contracts under Section 10A of the IT Act 2000, automated intra-state (CGST + SGST) and inter-state (IGST) taxation, direct zero-fee UPI payments, and an automated file delivery escrow system into a single workflow.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 border border-border bg-card rounded-lg space-y-3">
          <h2 className="text-title font-bold text-foreground">Client CRM & Lead Pipeline</h2>
          <p className="text-small text-muted-foreground leading-relaxed">Centralize client contacts, project history, billing velocity, and workspace notes in one structured database. Track lifetime value (LTV) and on-time payment speed across every account.</p>
        </div>
        <div className="p-6 border border-border bg-card rounded-lg space-y-3">
          <h2 className="text-title font-bold text-foreground">Indian GST Invoicing Engine</h2>
          <p className="text-small text-muted-foreground leading-relaxed">Automatic intra-state (CGST 9% + SGST 9%) vs. inter-state (IGST 18%) tax determination with integer paise rounding accuracy, custom SAC/HSN codes (998314), and statutory declarations.</p>
        </div>
        <div className="p-6 border border-border bg-card rounded-lg space-y-3">
          <h2 className="text-title font-bold text-foreground">Zero-Fee Direct UPI Payouts</h2>
          <p className="text-small text-muted-foreground leading-relaxed">NPCI-compliant dynamic UPI intent links and QR codes compatible with Google Pay, PhonePe, Paytm, and BHIM. 100% direct bank-to-bank settlement with 0% gateway commission fees.</p>
        </div>
        <div className="p-6 border border-border bg-card rounded-lg space-y-3">
          <h2 className="text-title font-bold text-foreground">Cryptographic Digital Contracts</h2>
          <p className="text-small text-muted-foreground leading-relaxed">Legally binding freelance contracts compliant with Section 10A of the Indian Information Technology Act, 2000. Tamper-evident audit trails recording timestamps, IP addresses, and email signatures.</p>
        </div>
        <div className="p-6 border border-border bg-card rounded-lg space-y-3">
          <h2 className="text-title font-bold text-foreground">Escrow Deliverable File Lock</h2>
          <p className="text-small text-muted-foreground leading-relaxed">Protect your work with encrypted Supabase storage buckets. Client access to final deliverables remains restricted until invoice payment is verified and cleared.</p>
        </div>
        <div className="p-6 border border-border bg-card rounded-lg space-y-3">
          <h2 className="text-title font-bold text-foreground">Dedicated Client Portal</h2>
          <p className="text-small text-muted-foreground leading-relaxed">Share a frictionless, token-authenticated project portal with clients to review proposals, sign contracts, pay via UPI, and download assets without creating an account.</p>
        </div>
      </div>
    </article>
  </PublicLayout>
);

// 6. GST Engine Page
export const GSTPage: React.FC = () => (
  <PublicLayout activePath="/gst">
    <SEOMeta 
      title="Indian GST Invoicing Engine for Freelancers — CGST, SGST, IGST & HSN 998314" 
      description="Automated Indian GST calculation engine for freelancers. Instant place of supply routing for CGST + SGST vs IGST, HSN/SAC codes, and Section 194J TDS compliance." 
      canonicalPath="/gst" 
    />
    <JSONLD schema={[
      getOrganizationSchema(),
      getLegalLegislationSchema(
        'Central Goods and Services Tax (CGST) Act, 2017',
        'Section 8, Section 31 & Rule 46 (Tax Invoice Rules)',
        'Statutory rules governing intra-state vs inter-state tax routing, HSN/SAC classifications, and electronic invoice standards in India.'
      ),
      getTechArticleSchema(
        'Indian GST Invoicing Engine for Freelancers — Place of Supply & SAC 998314',
        'Complete guide and automated taxation engine for Indian freelance GST calculations: intra-state CGST + SGST, inter-state IGST, SAC 998314, and export of services with LUT.',
        '/gst'
      ),
      getHowToSchema(
        'How to Calculate GST for Freelance Services in India',
        'Step-by-step statutory place-of-supply taxation rules for Indian freelancers billing clients.',
        [
          { name: 'Identify Place of Supply', text: 'Compare your registered state with your client\'s state located on their billing address or GSTIN.' },
          { name: 'Apply Tax Regime', text: 'If in the same state, apply 9% CGST + 9% SGST (18% total). If in different states, apply 18% IGST. If exporting overseas, apply 0% under a valid LUT.' },
          { name: 'Assign Official SAC Code', text: 'Tag items with SAC 998314 for IT software and design services, or 998313 for consulting.' },
          { name: 'Apply Integer Paise Rounding', text: 'Compute all line item taxes with exact integer paise precision to match statutory GSTR-1 returns.' }
        ]
      )
    ]} />
    <article className="space-y-8">
      <div className="space-y-3">
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground">Automated Indian GST Invoicing Engine</h1>
        <p className="text-body text-muted-foreground leading-relaxed">
          Built specifically for Indian freelance developers, designers, and consultants navigating the Goods and Services Tax (GST) regime.
        </p>
      </div>

      {/* Citable Passage: 139 Words (GEO Optimal) */}
      <div className="p-6 border border-primary/20 bg-primary/5 rounded-xl space-y-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Place of Supply Rules for Indian Freelancers</span>
        <p className="text-body text-foreground leading-relaxed">
          Under Indian GST law, freelance service taxation depends strictly on the Place of Supply relative to the freelancer's registered state. For intra-state transactions (where the freelancer and client reside in the same state), tax is split equally into 9% Central GST (CGST) and 9% State GST (SGST), totaling 18%. For inter-state transactions (where the client is in a different state), an 18% Integrated GST (IGST) applies. For IT services, consulting, and web development, services fall under SAC Code 998314 or 998313. If exporting services to international clients, transactions qualify as zero-rated supply under a Letter of Undertaking (LUT) with 0% tax liability. Ujrat calculates these place-of-supply rules automatically using integer paise precision rounding to prevent rounding discrepancies in GSTR-1 and GSTR-3B filings.
        </p>
      </div>

      <div className="p-6 border border-border bg-card rounded-xl space-y-4">
        <h2 className="text-title font-bold text-foreground">Tax Matrix by Place of Supply</h2>
        <p className="text-small text-muted-foreground leading-relaxed">
          When generating an invoice, Ujrat compares your registered state code against the client's place of supply to determine the exact statutory taxation formula:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-small text-left border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2.5 px-3 font-semibold text-foreground">Transaction Type</th>
                <th className="py-2.5 px-3 font-semibold text-foreground">Location Rule</th>
                <th className="py-2.5 px-3 font-semibold text-foreground">Tax Applied</th>
                <th className="py-2.5 px-3 font-semibold text-foreground">Standard Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-muted-foreground">
              <tr>
                <td className="py-2.5 px-3 font-medium text-foreground">Intra-State</td>
                <td className="py-2.5 px-3">Same Indian State</td>
                <td className="py-2.5 px-3">CGST + SGST</td>
                <td className="py-2.5 px-3">9% Central + 9% State (18%)</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-medium text-foreground">Inter-State</td>
                <td className="py-2.5 px-3">Different Indian State</td>
                <td className="py-2.5 px-3">IGST</td>
                <td className="py-2.5 px-3">18% Integrated GST</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-medium text-foreground">Export of Service</td>
                <td className="py-2.5 px-3">International Client</td>
                <td className="py-2.5 px-3">Zero-Rated (LUT)</td>
                <td className="py-2.5 px-3">0% with Letter of Undertaking</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 border border-border bg-card rounded-lg space-y-2">
          <h3 className="text-title font-semibold text-foreground">HSN & SAC Code 998314 Support</h3>
          <p className="text-small text-muted-foreground leading-relaxed">Pre-configured with official SAC code 998314 (Information technology design and development services) and 998313 (IT consulting) for error-free GSTR-1 return filing.</p>
        </div>
        <div className="p-6 border border-border bg-card rounded-lg space-y-2">
          <h3 className="text-title font-semibold text-foreground">Integer Paise Precision Rounding</h3>
          <p className="text-small text-muted-foreground leading-relaxed">All monetary calculations are computed using exact integer paise arithmetic, eliminating JavaScript IEEE 754 floating-point inaccuracies on tax totals.</p>
        </div>
      </div>
    </article>
  </PublicLayout>
);

// 7. UPI Page
export const UPIPage: React.FC = () => (
  <PublicLayout activePath="/upi">
    <SEOMeta 
      title="Zero-Fee UPI QR & Intent Payment Invoicing for Freelancers | Ujrat" 
      description="Accept freelance client payments with 0% payment gateway commission. Generate dynamic UPI QR codes and intent links compatible with GPay, PhonePe, and Paytm." 
      canonicalPath="/upi" 
    />
    <JSONLD schema={[
      getOrganizationSchema(),
      getTechArticleSchema(
        'Zero-Commission Direct UPI Invoicing for Indian Freelancers',
        'How dynamic NPCI UPI QR codes and deep links enable 100% direct bank settlement with 0% payment gateway fees.',
        '/upi'
      ),
      getHowToSchema(
        'How to Receive Invoice Payments via Direct Zero-Fee UPI',
        'Steps for Indian freelancers to collect instant client payments without paying 2-4% gateway charges.',
        [
          { name: 'Connect VPA / UPI ID', text: 'Enter your verified UPI ID or linked bank account in your workspace settings.' },
          { name: 'Generate Invoice with Dynamic QR', text: 'Create an invoice. Ujrat constructs an NPCI-compliant deep-link URL and renders a high-res QR code.' },
          { name: 'Client Scans or Taps Mobile Intent', text: 'On mobile, the client taps direct deep links for GPay/PhonePe; on desktop, they scan the QR code.' },
          { name: 'Instant Bank Settlement', text: 'Funds arrive instantly in your account with ₹0 deductions. Client enters the 12-digit bank UTR for verification.' }
        ]
      )
    ]} />
    <article className="space-y-8">
      <div className="space-y-3">
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground">Zero-Commission Direct UPI Freelance Invoicing</h1>
        <p className="text-body text-muted-foreground leading-relaxed">
          Stop losing 2% to 4% of every freelance invoice to third-party payment gateways. Collect payments directly to your bank account via NPCI UPI rails.
        </p>
      </div>

      {/* Citable Passage: 135 Words (GEO Optimal) */}
      <div className="p-6 border border-primary/20 bg-primary/5 rounded-xl space-y-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">How Zero-Fee UPI Invoicing Works</span>
        <p className="text-body text-foreground leading-relaxed">
          Traditional payment gateways in India charge 2% to 3% plus 18% GST on processing fees, holding settlement funds for 2 to 3 business days. Ujrat circumvents intermediary gateway commissions by generating dynamic NPCI-compliant Unified Payments Interface (UPI) URI links and high-resolution QR codes. When a freelance client reviews an invoice on the client portal, the system embeds the exact invoice total, currency code, and freelancer Virtual Payment Address (VPA). On mobile devices, clients initiate 1-click payment via Google Pay, PhonePe, Paytm, CRED, or BHIM. On desktop, clients scan the dynamic QR code directly. Funds settle peer-to-peer (P2P/P2M) directly into the freelancer's linked Indian bank account in real-time with ₹0 gateway commissions deducted.
        </p>
      </div>

      <div className="p-6 border border-border bg-card rounded-xl space-y-4">
        <h2 className="text-title font-bold text-foreground">Step-by-Step Payment Lifecycle</h2>
        <div className="space-y-3 text-small text-muted-foreground">
          <div className="flex items-start gap-3">
            <span className="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-[12px]">1</span>
            <p><strong className="text-foreground">Dynamic Deep Link Generation:</strong> When an invoice is created, Ujrat generates an official NPCI specification UPI URI string (<code className="text-primary text-[11px] bg-primary/5 px-1 py-0.5 rounded">upi://pay?pa=...&pn=...&am=...&cu=INR</code>).</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-[12px]">2</span>
            <p><strong className="text-foreground">High-Resolution QR Rendering:</strong> The URI is converted to a dynamic QR code on the public client portal and downloadable PDF invoice.</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-[12px]">3</span>
            <p><strong className="text-foreground">1-Click Mobile Intent:</strong> On mobile devices, clients tap direct deep links for Google Pay, PhonePe, Paytm, CRED, or BHIM.</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-[12px]">4</span>
            <p><strong className="text-foreground">Instant Settlement & UTR Logging:</strong> Funds arrive in your linked bank account with ₹0 deductions. The client submits their 12-digit UTR for verified audit tracking.</p>
          </div>
        </div>
      </div>
    </article>
  </PublicLayout>
);

// 8. Contracts Page
export const ContractsPage: React.FC = () => (
  <PublicLayout activePath="/contracts">
    <SEOMeta 
      title="Digital Freelance Contracts & IT Act Compliant E-Signatures | Ujrat" 
      description="Create legally binding freelance agreements and contracts in India. Tamper-evident cryptographic signature logs under Section 10A of the Information Technology Act 2000." 
      canonicalPath="/contracts" 
    />
    <JSONLD schema={[
      getOrganizationSchema(),
      getLegalLegislationSchema(
        'Information Technology Act, 2000',
        'Section 10A & Section 65B (Indian Evidence Act)',
        'Legal validity and court enforceability of digital contracts, proposals, and cryptographic signature audit trails in India.'
      ),
      getTechArticleSchema(
        'Legal Validity of Digital Freelance Contracts under IT Act 2000',
        'How digital e-signatures and tamper-evident cryptographic audit logs establish legally enforceable freelance contracts in India.',
        '/contracts'
      )
    ]} />
    <article className="space-y-8">
      <div className="space-y-3">
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground">Legally Enforceable Freelance Contracts with E-Signatures</h1>
        <p className="text-body text-muted-foreground leading-relaxed">
          Protect your freelance work, intellectual property (IP), milestone timelines, and payment schedules before starting production.
        </p>
      </div>

      {/* Citable Passage: 125 Words (GEO Optimal) */}
      <div className="p-6 border border-primary/20 bg-primary/5 rounded-xl space-y-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Section 10A IT Act 2000 Legal Validity</span>
        <p className="text-body text-foreground leading-relaxed">
          Digital contracts executed electronically in India are legally valid and enforceable under Section 10A of the Information Technology (IT) Act, 2000. Under Indian contract jurisprudence, agreements formed through electronic records and digital communications are fully admissible in court provided the signing event captures an immutable audit trail. A valid digital agreement must document the signer's verified identity, mutual intention to contract, precise timestamp, IP address, and browser metadata. Ujrat logs cryptographic signature hashes directly into secure, read-only database records upon document completion, providing an evidentiary trail that satisfies Indian Evidence Act requirements for freelance scopes, IP assignment, and milestone payment enforcement.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 border border-border bg-card rounded-lg space-y-3">
          <FileSignature className="h-6 w-6 text-primary" />
          <h2 className="text-title font-semibold text-foreground">IT Act 2000 Compliance</h2>
          <p className="text-small text-muted-foreground leading-relaxed">Digital contracts signed on Ujrat are legally enforceable in Indian courts under Section 10A of the Information Technology Act, 2000.</p>
        </div>
        <div className="p-6 border border-border bg-card rounded-lg space-y-3">
          <Lock className="h-6 w-6 text-primary" />
          <h2 className="text-title font-semibold text-foreground">Cryptographic Audit Trail</h2>
          <p className="text-small text-muted-foreground leading-relaxed">Every signature event logs the signer's name, email, IP address, user agent, and timestamp directly into read-only PostgreSQL audit tables.</p>
        </div>
        <div className="p-6 border border-border bg-card rounded-lg space-y-3">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h2 className="text-title font-semibold text-foreground">Scope Creep Defense</h2>
          <p className="text-small text-muted-foreground leading-relaxed">Clearly defined milestones, revision limits, and kill-fees ensure you get paid fairly for all billable engineering and design revisions.</p>
        </div>
      </div>
    </article>
  </PublicLayout>
);

// 9. Documentation Page
export const DocsPage: React.FC = () => (
  <PublicLayout activePath="/docs">
    <SEOMeta 
      title="Developer Documentation & Self-Hosting Guide | Ujrat" 
      description="Complete setup instructions, Supabase database schemas, Row-Level Security policies, and self-hosting documentation for Ujrat." 
      canonicalPath="/docs" 
    />
    <JSONLD schema={[
      getOrganizationSchema(),
      getTechArticleSchema(
        'Ujrat Developer Documentation and Self-Hosting Architecture',
        'Technical implementation guide for deploying Ujrat on Vercel and Supabase with Row-Level Security.',
        '/docs'
      )
    ]} />
    <article className="space-y-6">
      <h1 className="font-display text-3xl font-bold text-foreground">Developer Documentation & Self-Hosting</h1>
      <p className="text-body text-muted-foreground leading-relaxed">
        Ujrat is built on modern web standards with React 19, Vite, Tailwind CSS v4, and Supabase. You can use the hosted cloud platform or self-host your own private instance on your own infrastructure.
      </p>
      <div className="p-6 border border-border bg-card rounded-lg space-y-3">
        <h2 className="text-title font-bold text-foreground">Quickstart: Self-Host with Supabase & Vercel</h2>
        <ol className="list-decimal pl-5 space-y-2 text-small text-muted-foreground">
          <li>Clone the repository: <code className="text-primary text-[11px] bg-primary/5 px-1 py-0.5 rounded">git clone https://github.com/ujrat/ujrat.git</code></li>
          <li>Install dependencies: <code className="text-primary text-[11px] bg-primary/5 px-1 py-0.5 rounded">npm install</code></li>
          <li>Apply database migrations from <code className="text-primary text-[11px] bg-primary/5 px-1 py-0.5 rounded">/supabase/migrations</code> to your Supabase project.</li>
          <li>Configure your environment variables in <code className="text-primary text-[11px] bg-primary/5 px-1 py-0.5 rounded">.env</code> (<code className="text-primary text-[11px]">VITE_SUPABASE_URL</code> and <code className="text-primary text-[11px]">VITE_SUPABASE_ANON_KEY</code>).</li>
          <li>Deploy to Vercel or run locally using <code className="text-primary text-[11px] bg-primary/5 px-1 py-0.5 rounded">npm run dev</code>.</li>
        </ol>
      </div>
    </article>
  </PublicLayout>
);

// 10. Contact Page
export const ContactPage: React.FC = () => (
  <PublicLayout activePath="/contact">
    <SEOMeta 
      title="Contact & Community Support | Ujrat" 
      description="Connect with the Ujrat team for assistance, developer feedback, and open-source contributions." 
      canonicalPath="/contact" 
    />
    <JSONLD schema={[getOrganizationSchema()]} />
    <article className="space-y-6 text-center max-w-lg mx-auto">
      <h1 className="font-display text-3xl font-bold text-foreground">Get in Touch</h1>
      <p className="text-body text-muted-foreground">Have questions about GST invoicing, UPI integration, or self-hosting? We are here to help.</p>
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
    <SEOMeta 
      title="System Status & Real-Time Service Health | Ujrat" 
      description="Check real-time uptime status for Ujrat database, authentication API, and storage services." 
      canonicalPath="/status" 
    />
    <JSONLD schema={[getOrganizationSchema()]} />
    <article className="space-y-6">
      <h1 className="font-display text-3xl font-bold text-foreground">System Status & Service Health</h1>
      <div className="p-4 border border-success/30 bg-success/5 rounded-lg flex items-center gap-3">
        <Activity className="h-5 w-5 text-success" />
        <span className="text-small font-semibold text-success">All Systems Operational — 100% Cloud Uptime</span>
      </div>
    </article>
  </PublicLayout>
);

// 12. FAQ Page
export const FAQPage: React.FC = () => {
  const faqData = [
    {
      q: 'Is Ujrat really 100% free with no hidden charges?',
      a: 'Yes. Ujrat is completely free and open-source under the MIT license. There are zero monthly subscription charges, zero feature paywalls, and zero transaction processing fees on UPI payouts.'
    },
    {
      q: 'How does zero-fee UPI payout differ from standard payment gateways?',
      a: 'Traditional payment gateways (like Razorpay, Stripe, or PayPal) charge 2% to 4% plus GST per transaction and hold funds for T+2 days. Ujrat generates direct UPI deep links and dynamic QR codes that route payments peer-to-peer (P2P/P2M) directly to your linked bank account with instant settlement and 0% gateway commission.'
    },
    {
      q: 'Does Ujrat automatically calculate intra-state vs. inter-state GST?',
      a: 'Yes. Based on your registered Indian state and your client\'s place of supply, Ujrat automatically splits tax into CGST (9%) + SGST (9%) for intra-state transactions or applies IGST (18%) for inter-state clients with integer paise precision rounding.'
    },
    {
      q: 'Are digital contracts signed on Ujrat legally binding in India?',
      a: 'Yes. Electronic agreements signed on Ujrat capture the signer\'s email, timestamp, IP address, and browser agent metadata. These logs satisfy legal validity requirements under Section 10A of the Information Technology (IT) Act, 2000 of India.'
    },
    {
      q: 'How does the deliverables escrow file protection work?',
      a: 'Uploaded project deliverables are stored in private encrypted storage buckets. The client portal allows clients to preview file metadata, but access to download source files remains locked until the associated invoice status is verified as paid.'
    },
    {
      q: 'Can I self-host Ujrat on my own infrastructure?',
      a: 'Yes! Ujrat is open-source under the MIT license. You can clone the repository from GitHub and deploy it directly on your own Vercel account and Supabase database using our included database migrations.'
    }
  ];

  return (
    <PublicLayout activePath="/faq">
      <SEOMeta 
        title="Freelance Invoicing & Tax FAQs — GST, UPI, Contracts | Ujrat" 
        description="Frequently asked questions about Indian freelance invoicing, CGST/SGST/IGST tax rates, zero-fee UPI QR codes, and digital contracts." 
        canonicalPath="/faq" 
      />
      <JSONLD schema={[getOrganizationSchema(), getFAQSchema(faqData)]} />
      <article className="space-y-6">
        <div className="space-y-2">
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground">Frequently Asked Questions</h1>
          <p className="text-body text-muted-foreground">Everything you need to know about Ujrat's free freelance invoicing, GST compliance, and zero-fee UPI payouts.</p>
        </div>
        <div className="space-y-4">
          {faqData.map((faq, idx) => (
            <div key={idx} className="p-5 border border-border bg-card rounded-lg space-y-2 shadow-2xs">
              <h2 className="text-title font-semibold text-foreground">{faq.q}</h2>
              <p className="text-small text-muted-foreground leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </article>
    </PublicLayout>
  );
};

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
