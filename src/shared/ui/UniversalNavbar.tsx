import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { Button } from './Button';
import { Menu, X, ArrowRight, Sparkles } from 'lucide-react';

interface UniversalNavbarProps {
  activePath?: string;
}

export const UniversalNavbar: React.FC<UniversalNavbarProps> = ({ activePath = '' }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { name: 'Features', href: '/features' },
    { name: 'Pricing', href: '/pricing' },
    { name: 'GST Engine', href: '/gst' },
    { name: '0% UPI', href: '/upi' },
    { name: 'Waitlist', href: '/waitlist', highlight: true },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        
        {/* Left: Brand Logo & Typography Lockup */}
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2.5 group select-none">
            <img
              src="/favicon-transparent.png"
              alt="Ujrat"
              width={32}
              height={32}
              className="h-8 w-8 object-contain shrink-0 transition-transform duration-300 group-hover:scale-105"
              draggable={false}
            />
            <span className="font-bold text-lg font-display tracking-tight text-foreground">
              Ujrat
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-muted-foreground">
            {navLinks.map((link) => {
              const isActive = activePath === link.href;
              if (link.highlight) {
                return (
                  <Link
                    key={link.name}
                    to={link.href}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${
                      isActive
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'text-primary bg-primary/10 hover:bg-primary/20 border-primary/20'
                    }`}
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>{link.name}</span>
                  </Link>
                );
              }

              return (
                <Link
                  key={link.name}
                  to={link.href}
                  className={`hover:text-foreground transition-colors ${
                    isActive ? 'text-foreground font-bold' : ''
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Auth / Action Buttons */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="text-xs font-semibold shadow-sm flex items-center gap-1.5"
            >
              <span>Go to Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/login')}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Sign In
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/signup')}
                className="text-xs font-semibold shadow-sm"
              >
                Start Free Workspace
              </Button>
            </>
          )}
        </div>

        {/* Mobile Hamburger Toggle */}
        <div className="flex md:hidden items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            className="p-2 rounded-lg border border-border bg-card text-foreground hover:bg-surface transition-colors cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border bg-background/95 backdrop-blur-xl px-6 py-5 space-y-4 animate-slide-down">
          <nav className="flex flex-col space-y-3 text-sm font-medium">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`py-2 px-3 rounded-lg hover:bg-surface transition-colors flex items-center justify-between ${
                  activePath === link.href ? 'text-primary font-bold bg-primary/5' : 'text-foreground'
                }`}
              >
                <span>{link.name}</span>
                {link.highlight && (
                  <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                    VIP Early Access
                  </span>
                )}
              </Link>
            ))}
          </nav>

          <div className="pt-3 border-t border-border/60 flex flex-col gap-2.5">
            {user ? (
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate('/dashboard');
                }}
                className="w-full text-xs font-semibold"
              >
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/login');
                  }}
                  className="w-full text-xs font-semibold"
                >
                  Sign In
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/signup');
                  }}
                  className="w-full text-xs font-semibold"
                >
                  Start Free Workspace
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default UniversalNavbar;
