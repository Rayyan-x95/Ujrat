import React from 'react';

interface SettingsLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const SettingsLayout: React.FC<SettingsLayoutProps> = ({
  children,
  activeTab,
  onTabChange,
}) => {
  const tabs = [
    { id: 'profile',   name: 'Profile & Account' },
    { id: 'banking',   name: 'Banking & UPI' },
    { id: 'branding',  name: 'Branding & GST' },
    { id: 'security',  name: 'Security & Keys' },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
      {/* Sidebar nav */}
      <aside className="w-full lg:w-44 shrink-0">
        <nav
          className="flex lg:flex-col gap-0.5 overflow-x-auto pb-2 lg:pb-0"
          aria-label="Settings sections"
        >
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`relative whitespace-nowrap rounded-md px-3 py-2 text-[13px] text-left w-full transition-colors ${
                  isActive
                    ? 'text-foreground font-medium bg-surface'
                    : 'text-muted-foreground hover:text-foreground hover:bg-surface/60'
                }`}
              >
                {/* Active left indicator — only on desktop */}
                {isActive && (
                  <span
                    className="hidden lg:block absolute left-0 inset-y-2 w-0.75 bg-primary rounded-r-full"
                    aria-hidden="true"
                  />
                )}
                <span className="lg:pl-2">{tab.name}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex-1 max-w-2xl min-w-0">
        {children}
      </div>
    </div>
  );
};

export default SettingsLayout;
