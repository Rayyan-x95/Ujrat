import React from 'react';
import { Button } from './Button';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
  copied?: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, showDetails: false, copied: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, showDetails: false };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[Ujrat ErrorBoundary]', error, errorInfo);
  }

  handleCopyDetails = () => {
    if (this.state.error) {
      navigator.clipboard.writeText(this.state.error.stack || this.state.error.message);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-[500px] flex flex-col items-center justify-center p-8 space-y-6 max-w-lg mx-auto animate-fade-in">
          <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive shadow-sm">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          
          <div className="text-center space-y-2">
            <h2 className="text-heading font-semibold text-foreground m-0">An unexpected error occurred</h2>
            <p className="text-body text-muted-foreground m-0 leading-normal">
              We encountered a temporary problem while loading this part of the app. Your data is safe, and we have logged this occurrence.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 justify-center items-center">
            <Button variant="primary" size="md" onClick={() => window.location.reload()}>
              Reload Page
            </Button>
            <Button variant="outline" size="md" onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.href = '/dashboard';
            }}>
              Go to Dashboard
            </Button>
          </div>

          {import.meta.env.DEV && (
            <div className="w-full border border-border rounded-xl bg-surface/50 overflow-hidden divide-y divide-border">
              <button
                onClick={() => this.setState(prev => ({ showDetails: !prev.showDetails }))}
                className="w-full flex justify-between items-center px-4 py-2.5 text-xs font-medium text-muted-foreground hover:bg-secondary/40 transition-colors cursor-pointer"
              >
                <span>{this.state.showDetails ? 'Hide' : 'Show'} Technical Details</span>
                <svg className={`h-3.5 w-3.5 transition-transform duration-[120ms] ${this.state.showDetails ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              {this.state.showDetails && this.state.error && (
                <div className="p-4 space-y-3 bg-surface-raised text-left">
                  <p className="text-xs text-mono text-destructive font-medium m-0">
                    {this.state.error.name}: {this.state.error.message}
                  </p>
                  {this.state.error.stack && (
                    <pre className="text-[10px] text-mono text-muted-foreground/80 overflow-auto max-h-40 p-2 border border-border rounded-lg bg-surface m-0 whitespace-pre-wrap">
                      {this.state.error.stack}
                    </pre>
                  )}
                  <div className="flex justify-end">
                    <Button variant="ghost" size="sm" onClick={this.handleCopyDetails}>
                      {this.state.copied ? 'Copied!' : 'Copy Error Stack'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <p className="text-[11px] text-muted-foreground/70 m-0">
            Need additional assistance? <a href="mailto:support@ujrat.app" className="text-primary hover:underline">Contact Ujrat Support</a>
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;