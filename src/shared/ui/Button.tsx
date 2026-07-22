import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'link';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconRight,
  disabled,
  ...props
}) => {
  const base =
    'inline-flex items-center justify-center font-medium rounded-md transition-colors duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-40 disabled:pointer-events-none select-none cursor-pointer';

  const variants: Record<string, string> = {
    primary:
      'bg-primary text-primary-foreground hover:bg-primary/90 border border-transparent shadow-xs',
    secondary:
      'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-transparent',
    outline:
      'border border-border bg-transparent text-foreground hover:bg-surface hover:border-border',
    ghost:
      'border border-transparent text-muted-foreground hover:text-foreground hover:bg-surface',
    danger:
      'bg-destructive text-destructive-foreground hover:bg-destructive/90 border border-transparent shadow-xs',
    link:
      'border-none text-primary hover:text-primary/80 underline-offset-4 hover:underline p-0 h-auto',
  };

  const sizes: Record<string, string> = {
    xs: 'h-7 px-2.5 text-[12px] gap-1',
    sm: 'h-8 px-3 text-[13px] gap-1.5',
    md: 'h-9 px-3.5 text-[13px] gap-1.5',
    lg: 'h-10 px-4 text-sm gap-2',
  };

  const isLink = variant === 'link';

  return (
    <button
      className={`${base} ${variants[variant]} ${isLink ? '' : sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg
          className="animate-spin h-3.5 w-3.5 text-current shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path
            className="opacity-80"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : icon ? (
        <span className="shrink-0 flex items-center justify-center">{icon}</span>
      ) : null}
      {children && <span>{children}</span>}
      {!loading && iconRight && (
        <span className="shrink-0 flex items-center justify-center">{iconRight}</span>
      )}
    </button>
  );
};

export default Button;
