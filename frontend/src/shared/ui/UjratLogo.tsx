import React from 'react';

interface UjratLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

export const UjratLogo: React.FC<UjratLogoProps> = ({
  className = '',
  size = 32,
  showText = false,
}) => {
  if (showText) {
    return (
      <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
        <img
          src="/favicon-transparent.png"
          alt="Ujrat"
          height={size}
          width={size}
          className="object-contain shrink-0 transition-transform duration-300 group-hover:scale-105"
          draggable={false}
        />
        <span 
          className="font-bold font-display tracking-tight text-foreground"
          style={{ fontSize: `${Math.round(size * 0.6)}px`, lineHeight: 1 }}
        >
          Ujrat
        </span>
      </div>
    );
  }

  // Icon-only: transparent U+arrow mark
  return (
    <img
      src="/favicon-transparent.png"
      alt="Ujrat"
      height={size}
      width={size}
      className={`object-contain select-none shrink-0 ${className}`}
      draggable={false}
    />
  );
};

export default UjratLogo;
