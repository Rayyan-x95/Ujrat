import React from 'react';

type BadgeVariant =
  | 'default'
  | 'neutral'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'primary'
  | 'outline';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default:
    'bg-secondary text-secondary-foreground border border-transparent',
  neutral:
    'bg-transparent text-muted-foreground border border-border',
  primary:
    'bg-primary-subtle text-primary border border-primary/15',
  success:
    'bg-success/8 text-success border border-success/15',
  warning:
    'bg-warning/10 text-warning border border-warning/20',
  destructive:
    'bg-destructive/8 text-destructive border border-destructive/15',
  outline:
    'bg-transparent text-muted-foreground border border-border',
};

const dotColors: Record<BadgeVariant, string> = {
  default:    'bg-muted-foreground',
  neutral:    'bg-muted-foreground',
  primary:    'bg-primary',
  success:    'bg-success',
  warning:    'bg-warning',
  destructive:'bg-destructive',
  outline:    'bg-muted-foreground',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'h-5 px-1.5 text-[10px] gap-1',
  md: 'h-[22px] px-2 text-[11px] gap-1.5',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  className = '',
}) => (
  <span
    className={`inline-flex items-center font-medium rounded-sm whitespace-nowrap select-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
  >
    {dot && (
      <span
        className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColors[variant]}`}
        aria-hidden="true"
      />
    )}
    {children}
  </span>
);

export const ProjectStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, BadgeVariant> = {
    draft:           'outline',
    active:          'primary',
    in_progress:     'success',
    review:          'warning',
    completed:       'success',
    cancelled:       'destructive',
    on_hold:         'warning',
    lead:            'outline',
    proposal:        'primary',
    approved:        'primary',
    contract_signed: 'success',
  };
  const labels: Record<string, string> = {
    draft:           'Draft',
    active:          'Active',
    in_progress:     'In Progress',
    review:          'In Review',
    completed:       'Completed',
    cancelled:       'Cancelled',
    on_hold:         'On Hold',
    lead:            'Lead',
    proposal:        'Proposal Sent',
    approved:        'Approved',
    contract_signed: 'Contract Signed',
  };
  return (
    <Badge variant={map[status] ?? 'default'} dot size="sm">
      {labels[status] ?? status.replace(/_/g, ' ')}
    </Badge>
  );
};

export const InvoiceStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, BadgeVariant> = {
    draft:           'outline',
    sent:            'primary',
    viewed:          'warning',
    partially_paid:  'warning',
    paid:            'success',
    overdue:         'destructive',
    cancelled:       'destructive',
  };
  const labels: Record<string, string> = {
    draft:          'Draft',
    sent:           'Sent',
    viewed:         'Viewed',
    partially_paid: 'Partial',
    paid:           'Paid',
    overdue:        'Overdue',
    cancelled:      'Cancelled',
  };
  return (
    <Badge variant={map[status] ?? 'default'} dot size="sm">
      {labels[status] ?? status}
    </Badge>
  );
};

export const PaymentMethodBadge: React.FC<{ method: string }> = ({ method }) => {
  const labels: Record<string, string> = {
    upi:           'UPI',
    bank_transfer: 'Bank Transfer',
    cash:          'Cash',
    cheque:        'Cheque',
    other:         'Other',
  };
  return (
    <Badge variant="neutral" size="sm">
      {labels[method] ?? method}
    </Badge>
  );
};

export default Badge;
