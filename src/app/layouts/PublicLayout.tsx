import React from 'react';

export const PublicLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground transition-colors duration-200">
      <main className="flex-1 flex flex-col justify-center items-center p-6">
        {children}
      </main>
    </div>
  );
};

export default PublicLayout;
