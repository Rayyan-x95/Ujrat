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
    { id: 'profile', name: 'Profile & Account' },
    { id: 'banking', name: 'Banking & UPI' },
    { id: 'branding', name: 'Branding & GST' },
    { id: 'security', name: 'Security & Keys' },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-10 lg:gap-14">
      <aside className="w-full lg:w-48 shrink-0">
        <nav className="flex lg:flex-col gap-0.5 overflow-x-auto pb-2 lg:pb-0" aria-label="Settings sections">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`whitespace-nowrap rounded-md px-3 py-2 text-body text-left w-full transition-colors duration-[120ms] ${
                  isActive
                    ? 'bg-primary-muted text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-surface'
                }`}
              >
                {tab.name}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 max-w-2xl min-w-0">
        {children}
      </div>
    </div>
  );
};

export default SettingsLayout;
