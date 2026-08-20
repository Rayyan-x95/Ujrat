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
  <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6">
    <div className="min-w-0 flex-1">
      {meta && <div className="mb-1.5">{meta}</div>}
      <h1 className="text-[22px] font-semibold text-foreground m-0 tracking-tight leading-tight font-display">
        {title}
      </h1>
      {description && (
        <p className="text-[13px] text-muted-foreground m-0 mt-1 max-w-xl leading-normal">
          {description}
        </p>
      )}
    </div>
    {actions && (
      <div className="flex items-center gap-2 shrink-0">{actions}</div>
    )}
  </header>
);

export default PageHeader;
