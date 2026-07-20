import React from 'react';

interface UjratLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

/**
 * UjratLogo — renders the official Ujrat brand logo.
 *
 * - showText=true  → full lockup (symbol + "UJRAT" wordmark)
 * - showText=false → icon-only mark (U + arrow)
 *
 * The images are white-background PNGs, so on dark backgrounds
 * we use a CSS `invert` filter to flip them to a dark-mode-friendly
 * white rendering. On light backgrounds they render natively.
 */
export const UjratLogo: React.FC<UjratLogoProps> = ({
  className = '',
  size = 32,
  showText = false,
}) => {
  if (showText) {
    // Full lockup: show the logo with text. The PNG is ~1:1 aspect.
    // We constrain by height derived from size.
    const height = size * 2.4;
    const width = height * (1); // logo PNG is roughly square (logo + text stacked)
    return (
      <img
        src="/logo.png"
        alt="Ujrat"
        height={height}
        width={width}
        className={`object-contain select-none dark:invert transition-transform duration-300 hover:scale-105 ${className}`}
        draggable={false}
      />
    );
  }

  // Icon-only: the U+arrow mark
  return (
    <img
      src="/logo-icon.png"
      alt="Ujrat"
      height={size}
      width={size}
      className={`object-contain select-none dark:invert shrink-0 ${className}`}
      draggable={false}
    />
  );
};

export default UjratLogo;
