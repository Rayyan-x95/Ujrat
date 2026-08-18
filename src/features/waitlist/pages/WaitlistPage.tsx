import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOMeta } from '@/shared/ui/SEOMeta';
import { JSONLD, getOrganizationSchema } from '@/shared/ui/JSONLD';
import { UjratLogo } from '@/shared/ui/UjratLogo';
import { UniversalNavbar } from '@/shared/ui/UniversalNavbar';
import { Button } from '@/shared/ui/Button';
import { useToastStore } from '@/shared/hooks/useToastStore';
import { WaitlistService } from '../services/WaitlistService';
import { 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  Share2, 
  ShieldCheck, 
  Copy, 
  Check, 
  Code2, 
  Palette, 
  Video, 
  PenTool, 
  TrendingUp, 
  Briefcase, 
  Camera, 
  Clock, 
  QrCode, 
  FileSignature, 
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';

interface ServiceCategory {
  id: string;
  name: string;
  icon: React.ElementType;
}

const SERVICE_CATEGORIES: ServiceCategory[] = [
  { id: 'web-dev', name: 'Web & Fullstack Dev', icon: Code2 },
  { id: 'ui-ux', name: 'UI/UX & Product Design', icon: Palette },
  { id: 'video-motion', name: 'Video & Motion Design', icon: Video },
  { id: 'copy-content', name: 'Copy & Content Writing', icon: PenTool },
  { id: 'marketing-seo', name: 'Growth & Performance SEO', icon: TrendingUp },
  { id: 'consulting', name: 'Consulting & Strategy', icon: Briefcase },
  { id: 'photo-film', name: 'Photography & Creative', icon: Camera },
  { id: 'other', name: 'Other Specialized Skill', icon: Sparkles },
];

export const WaitlistPage: React.FC = () => {
  const addToast = useToastStore((state) => state.addToast);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedService, setSelectedService] = useState<string>('Web & Fullstack Dev');
  const [customService, setCustomService] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isExisting, setIsExisting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ticketNumber] = useState(() => Math.floor(1000 + Math.random() * 9000));

  const effectiveService = selectedService === 'Other Specialized Skill'
    ? (customService.trim() || 'Other Specialized Skill')
    : (selectedService || 'Freelancer / General');

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};

    if (!name.trim() || name.trim().length < 2) {
      nextErrors.name = 'Full name is required (min 2 characters).';
    }

    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      nextErrors.email = 'A valid work email address is required.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      addToast('warning', 'Mandatory Fields Missing', 'Please fill in all mandatory fields before submitting.');
      return;
    }

    setLoading(true);
    try {
      const res = await WaitlistService.joinWaitlist({ 
        name: name.trim(), 
        email: email.trim(), 
        service: effectiveService 
      });

      if (res.success) {
        setIsSubmitted(true);
        setIsExisting(Boolean(res.data.alreadyRegistered));
        if (res.data.alreadyRegistered) {
          addToast('info', 'Position Confirmed', 'You are already registered on our priority waitlist!');
        } else {
          addToast('success', 'Priority Spot Secured!', 'Welcome to the Ujrat pre-launch cohort.');
        }
      } else {
        throw res.error;
      }
    } catch (err: any) {
      addToast('error', 'Submission Error', err.message || 'Unable to join waitlist. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    const url = 'https://ujrat.ninety5.in/waitlist';
    navigator.clipboard.writeText(url);
    setCopied(true);
    addToast('success', 'Link Copied', 'Invite link copied to your clipboard.');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `I just claimed pre-launch VIP early access to Ujrat — the 0% commission GST invoicing & UPI billing engine for Indian freelancers.\n\nClaim your spot on the waitlist: https://ujrat.ninety5.in/waitlist`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleShareTwitter = () => {
    const text = encodeURIComponent(
      `Just reserved my pre-launch spot on @UjratApp! 0% fee UPI settlements, auto-GST SAC invoicing, and digital contracts for Indian freelancers.\n\nJoin the queue: https://ujrat.ninety5.in/waitlist`
    );
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-primary/10 selection:text-primary relative overflow-hidden font-sans">
      <SEOMeta 
        title="Join Early Access Priority Waitlist"
        description="Claim your VIP early access spot for Ujrat — the 0% commission GST invoicing, digital contract e-signing, and UPI payout portal for Indian freelancers."
        canonicalPath="/waitlist"
      />
      <JSONLD schema={getOrganizationSchema()} />

      {/* Atmospheric Background Lights */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-125 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,hsl(var(--primary)/0.15),transparent)] pointer-events-none -z-10" />
      <div className="absolute top-[20%] -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-[35%] -left-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* ─── Top Universal Navbar ─────────────────────────────────────────────── */}
      <UniversalNavbar activePath="/waitlist" />

      {/* ─── Main Hero & Split Layout ────────────────────────────────────────── */}
      <main className="flex-1 py-12 md:py-20 px-6 max-w-7xl mx-auto w-full">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
          
          {/* Left Column: Value Narrative */}
          <div className="lg:col-span-6 space-y-8 text-left">
            
            {/* Pre-Launch Cohort Badge */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-semibold tracking-tight shadow-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <span>Pre-Launch Access • Cohort 1 Enrollment Open</span>
            </div>

            {/* Main Headline */}
            <div className="space-y-4">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground font-display leading-[1.12]">
                Zero Commission.<br />
                Instant UPI Settlement.<br />
                <span className="bg-linear-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  Indian Freelancing Perfected.
                </span>
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed max-w-xl">
                Stop handing over 2% to 5% of your revenue to payment gateways. Ujrat provides direct UPI bank-to-bank settlements, automated GST SAC invoicing, and legally binding digital contracts.
              </p>
            </div>

            {/* Metric Value Pillars */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 rounded-xl border border-border/70 bg-card/60 backdrop-blur-xs">
                <div className="text-xl font-bold text-foreground font-display">0.0%</div>
                <div className="text-[11px] text-muted-foreground font-medium mt-0.5">Gateway Fee</div>
              </div>
              <div className="p-3.5 rounded-xl border border-border/70 bg-card/60 backdrop-blur-xs">
                <div className="text-xl font-bold text-foreground font-display">&lt; 15s</div>
                <div className="text-[11px] text-muted-foreground font-medium mt-0.5">UPI Settlement</div>
              </div>
              <div className="p-3.5 rounded-xl border border-border/70 bg-card/60 backdrop-blur-xs">
                <div className="text-xl font-bold text-foreground font-display">100%</div>
                <div className="text-[11px] text-muted-foreground font-medium mt-0.5">GST Compliant</div>
              </div>
            </div>

            {/* Pre-Launch Cohort Perks */}
            <div className="space-y-3 pt-2 border-t border-border/50">
              <div className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Cohort 1 Early Access Benefits:
              </div>
              <ul className="space-y-2.5 text-xs text-muted-foreground">
                <li className="flex items-center gap-2.5">
                  <div className="h-4 w-4 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                    <Check className="h-2.5 w-2.5 stroke-3" />
                  </div>
                  <span><strong className="text-foreground">Lifetime Free Tier</strong>: Guaranteed zero platform fee for early cohort members.</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="h-4 w-4 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                    <Check className="h-2.5 w-2.5 stroke-3" />
                  </div>
                  <span><strong className="text-foreground">Custom Client Portals</strong>: Send professional proposals and payment links under your own brand.</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="h-4 w-4 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                    <Check className="h-2.5 w-2.5 stroke-3" />
                  </div>
                  <span><strong className="text-foreground">Direct Priority Onboarding</strong>: Personalized assistance from our product engineering team.</span>
                </li>
              </ul>
            </div>

            {/* Target Audience Callout */}
            <div className="p-4 rounded-xl border border-border/70 bg-surface/50 text-xs text-muted-foreground flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
              <span>Built specifically for India&apos;s independent software engineers, designers, content creators, and consultants.</span>
            </div>

          </div>

          {/* Right Column: Interactive Priority Form Card */}
          <div className="lg:col-span-6 w-full max-w-lg mx-auto lg:ml-auto">
            
            {!isSubmitted ? (
              <div className="bg-card border border-border/80 rounded-2xl p-6 sm:p-8 shadow-xl shadow-black/5 relative overflow-hidden backdrop-blur-xl transition-all">
                
                {/* Glow Accent Line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-primary/30 via-primary to-primary/30" />

                <div className="mb-6 space-y-1 text-left">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-foreground font-display">
                      Join the Pre-Launch Waitlist
                    </h2>
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                      Mandatory Form
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    All fields below are mandatory to secure your prioritized rollout invitation.
                  </p>
                </div>

                <form onSubmit={handleSubmit} noValidate className="space-y-4 text-left">
                  
                  {/* 1. Full Name (Mandatory) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                        Full Name <span className="text-destructive font-bold">*</span>
                      </label>
                      <span className="text-[10px] text-muted-foreground font-medium">Required</span>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. Rohan Sharma"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (errors.name) {
                          setErrors((prev) => {
                            const next = { ...prev };
                            delete next.name;
                            return next;
                          });
                        }
                      }}
                      disabled={loading}
                      required
                      autoComplete="name"
                      className={`w-full px-3.5 py-2.5 rounded-lg border text-xs sm:text-sm bg-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 transition-colors disabled:opacity-50 ${
                        errors.name 
                          ? 'border-destructive focus:border-destructive focus:ring-destructive/20' 
                          : 'border-border focus:border-primary focus:ring-primary/20'
                      }`}
                    />
                    {errors.name && (
                      <p className="text-[11px] text-destructive flex items-center gap-1 pt-0.5">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{errors.name}</span>
                      </p>
                    )}
                  </div>

                  {/* 2. Email (Mandatory) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                        Work Email Address <span className="text-destructive font-bold">*</span>
                      </label>
                      <span className="text-[10px] text-muted-foreground font-medium">Required</span>
                    </div>
                    <input
                      type="email"
                      placeholder="rohan@studio.in"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errors.email) {
                          setErrors((prev) => {
                            const next = { ...prev };
                            delete next.email;
                            return next;
                          });
                        }
                      }}
                      disabled={loading}
                      required
                      autoComplete="email"
                      className={`w-full px-3.5 py-2.5 rounded-lg border text-xs sm:text-sm bg-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 transition-colors disabled:opacity-50 ${
                        errors.email 
                          ? 'border-destructive focus:border-destructive focus:ring-destructive/20' 
                          : 'border-border focus:border-primary focus:ring-primary/20'
                      }`}
                    />
                    {errors.email && (
                      <p className="text-[11px] text-destructive flex items-center gap-1 pt-0.5">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{errors.email}</span>
                      </p>
                    )}
                  </div>

                  {/* 3. Service Discipline (Optional) */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                        What service do you provide?
                      </label>
                      <span className="text-[10px] text-muted-foreground font-normal">Optional</span>
                    </div>

                    {/* Category Grid */}
                    <div className="grid grid-cols-2 gap-2">
                      {SERVICE_CATEGORIES.map((cat) => {
                        const Icon = cat.icon;
                        const isSelected = selectedService === cat.name;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setSelectedService(cat.name);
                              if (cat.name !== 'Other Specialized Skill') {
                                setCustomService('');
                              }
                              if (errors.service) {
                                setErrors((prev) => {
                                  const next = { ...prev };
                                  delete next.service;
                                  return next;
                                });
                              }
                            }}
                            className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary/30 shadow-xs'
                                : 'border-border/70 bg-background text-muted-foreground hover:text-foreground hover:border-border hover:bg-surface'
                            }`}
                          >
                            <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                            <span className="text-[11px] truncate leading-tight">{cat.name}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom service write-in if "Other" is chosen */}
                    {selectedService === 'Other Specialized Skill' && (
                      <div className="pt-2 animate-fade-in space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                            Specify Your Service Discipline
                          </label>
                          <span className="text-[10px] text-muted-foreground font-normal">Optional</span>
                        </div>
                        <input
                          type="text"
                          placeholder="e.g. 3D Architectural Visualizer, Audio Engineer (Optional)"
                          value={customService}
                          onChange={(e) => {
                            setCustomService(e.target.value);
                            if (errors.service) {
                              setErrors((prev) => {
                                const next = { ...prev };
                                delete next.service;
                                return next;
                              });
                            }
                          }}
                          disabled={loading}
                          className="w-full px-3.5 py-2.5 rounded-lg border border-border text-xs bg-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                        />
                      </div>
                    )}

                    {errors.service && (
                      <p className="text-[11px] text-destructive flex items-center gap-1 pt-0.5">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{errors.service}</span>
                      </p>
                    )}
                  </div>

                  {/* Submission CTA */}
                  <div className="pt-3">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full relative group overflow-hidden rounded-xl bg-linear-to-r from-primary via-blue-600 to-indigo-600 hover:from-primary/95 hover:via-blue-600/95 hover:to-indigo-500 text-white font-semibold text-sm h-12 px-6 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/35 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      {/* Light Shimmer Effect on Hover */}
                      <div className="absolute inset-0 w-1/2 h-full bg-linear-to-r from-transparent via-white/20 to-transparent -skew-x-12 -translate-x-full group-hover:translate-x-[300%] transition-transform duration-1000 ease-out pointer-events-none" />

                      <div className="relative flex items-center justify-center gap-2.5">
                        {loading ? (
                          <>
                            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Reserving Your Priority Spot...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-white/90" />
                            <span className="tracking-tight">Claim Priority VIP Access</span>
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform duration-200" />
                          </>
                        )}
                      </div>
                    </button>
                  </div>

                  {/* Trust Footer */}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground/80 pt-2 border-t border-border/40">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-primary" /> 0% Spam Guarantee
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" /> Rollout batch updates by email
                    </span>
                  </div>

                </form>

              </div>
            ) : (
              /* ─── Celebratory Holographic VIP Ticket ────────────────────────── */
              <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/10 text-center space-y-6 animate-scale-in relative overflow-hidden">
                
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-linear-to-r from-primary via-primary/80 to-primary" />
                
                {/* Success Icon Badge */}
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto border border-primary/20 shadow-inner">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div className="space-y-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
                    <Sparkles className="w-3 h-3" />
                    <span>{isExisting ? 'Waitlist Position Confirmed' : 'VIP Pre-Launch Pass #UJ-' + ticketNumber}</span>
                  </div>
                  <h2 className="text-2xl font-bold font-display text-foreground">
                    Spot Reserved, {name}!
                  </h2>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                    We have enrolled <strong className="text-foreground">{email}</strong> for prioritized early access as a <strong className="text-foreground">{effectiveService}</strong>.
                  </p>
                </div>

                {/* Priority Pass Card */}
                <div className="p-4 rounded-xl bg-surface border border-border/80 text-left space-y-3 relative overflow-hidden">
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-border/60">
                    <div className="flex items-center gap-2">
                      <UjratLogo size={24} showText={false} />
                      <span className="font-bold text-foreground">UJrat Early Access Pass</span>
                    </div>
                    <span className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded font-semibold">
                      COHORT #1
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">MEMBER</span>
                      <span className="font-semibold text-foreground truncate block">{name}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block">DISCIPLINE</span>
                      <span className="font-semibold text-foreground truncate block">{effectiveService}</span>
                    </div>
                  </div>
                </div>

                {/* Viral Referral Booster */}
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Share2 className="w-3.5 h-3.5 text-primary" /> Skip the Line
                    </span>
                    <span className="text-[10px] text-primary font-bold bg-primary/10 px-2 py-0.5 rounded">
                      Queue Boost
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Share Ujrat with other freelancers. Early invites roll out progressively based on referral activity.
                  </p>
                  
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs flex items-center justify-center gap-1.5"
                      onClick={handleCopyLink}
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy Link'}</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs text-emerald-600 dark:text-emerald-400 hover:border-emerald-500/30"
                      onClick={handleShareWhatsApp}
                    >
                      WhatsApp
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs text-sky-500 hover:border-sky-500/30"
                      onClick={handleShareTwitter}
                    >
                      Twitter
                    </Button>
                  </div>
                </div>

                <div className="pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsSubmitted(false);
                      setName('');
                      setEmail('');
                      setCustomService('');
                      setErrors({});
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    ← Submit another entry
                  </Button>
                </div>

              </div>
            )}

          </div>

        </div>

        {/* ─── Comparison Section Bento Grid ────────────────────────────────── */}
        <div className="mt-24 pt-16 border-t border-border/60 text-left">
          
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
            <div className="text-xs font-bold text-primary uppercase tracking-widest">
              Why Freelancers Are Switching
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground font-display">
              Built for How Indian Freelancers Actually Get Paid.
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Traditional invoicing software forces heavy commissions or ignores Indian GST laws. Ujrat changes that.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            
            <div className="p-6 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xs space-y-3 relative overflow-hidden group hover:border-primary/40 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <QrCode className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-foreground font-display">0% Direct UPI Routing</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Generate dynamic QR codes and intent links for PhonePe, Google Pay, Paytm, and CRED with exact invoice amounts. 100% direct bank settlement.
              </p>
              <div className="pt-2 text-[11px] font-semibold text-primary flex items-center gap-1">
                <span>Direct Bank-to-Bank</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </div>

            <div className="p-6 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xs space-y-3 relative overflow-hidden group hover:border-primary/40 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-foreground font-display">Automated GST SAC Presets</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Intra-state (CGST+SGST) and Inter-state (IGST) split calculation, HSN/SAC code library (998314, 998311, 998361), and 1-click GSTR-1 CSV exports.
              </p>
              <div className="pt-2 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <span>Zero CA Accounting Hassle</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </div>

            <div className="p-6 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xs space-y-3 relative overflow-hidden group hover:border-primary/40 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center mb-4">
                <FileSignature className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-foreground font-display">Binding Digital E-Contracts</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Send professional agreements with email OTP verification, cryptographic SHA-256 timestamps, and deliverable escrow locks upon final payment.
              </p>
              <div className="pt-2 text-[11px] font-semibold text-violet-600 dark:text-violet-400 flex items-center gap-1">
                <span>IT Act 2000 Compliant</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </div>

          </div>

        </div>

      </main>

      {/* ─── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border/60 bg-card/60 py-10 text-small text-muted-foreground">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <UjratLogo size={32} showText={true} />
            <span className="text-[11px] text-muted-foreground/70">
              © {new Date().getFullYear()} Ujrat. Built for Indian Freelancers.
            </span>
          </div>
          <div className="flex items-center gap-6 text-xs">
            <Link to="/features" className="hover:text-foreground transition-colors">Features</Link>
            <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link to="/security" className="hover:text-foreground transition-colors">Security</Link>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default WaitlistPage;
