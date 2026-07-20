import React from 'react';

interface SectionProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** When true, adds subtle surface background. Default: no card wrapper */
  elevated?: boolean;
  divider?: boolean;
}

export const Section: React.FC<SectionProps> = ({
  title,
  description,
  actions,
  children,
  className = '',
  elevated = false,
  divider = false,
}) => (
  <section
    className={`${divider ? 'pt-8 section-divider' : ''} ${className}`}
  >
    {(title || actions) && (
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="space-y-0.5">
          {title && (
            <h2 className="text-heading text-foreground m-0">{title}</h2>
          )}
          {description && (
            <p className="text-small text-muted-foreground m-0">{description}</p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    )}
    <div className={elevated ? 'rounded-lg bg-surface p-5 md:p-6' : ''}>
      {children}
    </div>
  </section>
);

export default Section;
