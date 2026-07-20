import React from 'react';

export const ErrorLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
    <div className="w-full max-w-md space-y-4 animate-slide-up">
      {children}
    </div>
  </div>
);

export default ErrorLayout;
