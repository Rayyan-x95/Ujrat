import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  actions,
  meta,
}) => (
  <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-8">
    <div className="space-y-1.5 min-w-0">
      {meta && <div className="mb-1">{meta}</div>}
      <h1 className="text-display text-foreground m-0">{title}</h1>
      {description && (
        <p className="text-small text-muted-foreground m-0 max-w-xl">{description}</p>
      )}
    </div>
    {actions && (
      <div className="flex items-center gap-2 shrink-0">{actions}</div>
    )}
  </header>
);

export default PageHeader;
