import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  disabled,
  ...props
}) => {
  const baseStyle =
    'inline-flex items-center justify-center font-medium rounded-md transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] select-none cursor-pointer';

  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/95 shadow-sm border border-transparent',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-accent border border-transparent',
    outline: 'border border-border text-foreground hover:bg-surface hover:text-foreground',
    ghost: 'text-muted-foreground hover:text-foreground hover:bg-surface border border-transparent',
    danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/95 shadow-sm border border-transparent',
  };

  const sizes = {
    sm: 'h-8 px-3 text-small gap-1.5',
    md: 'h-9 px-4 text-body gap-2',
    lg: 'h-10.5 px-5 text-body gap-2',
  };

  return (
    <button
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-3.5 w-3.5 text-current shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : icon ? (
        <span className="shrink-0 flex items-center justify-center">{icon}</span>
      ) : null}
      {children}
    </button>
  );
};

export default Button;
