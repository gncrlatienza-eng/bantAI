import React from 'react';

interface ShieldLogoProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const ShieldLogo: React.FC<ShieldLogoProps> = ({ size = 32, className = '', style }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ flexShrink: 0, borderRadius: size * 0.22, filter: 'drop-shadow(0 4px 12px rgba(49, 46, 129, 0.45))', ...style }}
    >
      <defs>
        {/* Deep Indigo Background Gradient */}
        <linearGradient id="bgIndigoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2e2570" />
          <stop offset="50%" stopColor="#1e1b4b" />
          <stop offset="100%" stopColor="#0c0a20" />
        </linearGradient>

        {/* Speech Bubble Indigo Gradient */}
        <linearGradient id="bubbleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>

        {/* Top Bevel Highlight Rim */}
        <linearGradient id="rimHighlight" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#c7d2fe" stopOpacity="0.25" />
        </linearGradient>
      </defs>

      {/* Squircle Background Base */}
      <rect width="40" height="40" rx="9" fill="url(#bgIndigoGrad)" />
      
      {/* Top Edge Bevel Rim */}
      <rect x="0.75" y="0.75" width="38.5" height="38.5" rx="8.25" stroke="url(#rimHighlight)" strokeWidth="1.5" fill="none" />

      {/* SMS Speech Bubble Shape */}
      <path
        d="M12 12C12 9.79086 13.7909 8 16 8H24C26.2091 8 28 9.79086 28 12V20C28 22.2091 26.2091 24 24 24H18.5L14 28V24H16C13.7909 24 12 22.2091 12 20V12Z"
        fill="url(#bubbleGrad)"
        stroke="#818cf8"
        strokeWidth="1"
      />

      {/* Centered Integrated Security Shield */}
      <path
        d="M20 11L15.5 13V16.5C15.5 19.5 17.5 21.8 20 22.5C22.5 21.8 24.5 19.5 24.5 16.5V13L20 11Z"
        fill="#ffffff"
        opacity="0.95"
      />

      {/* Shield Inner Detail Cutout */}
      <path
        d="M20 12.8L17 14.1V16.5C17 18.5 18.3 20 20 20.6C21.7 20 23 18.5 23 16.5V14.1L20 12.8Z"
        fill="#4f46e5"
        opacity="0.8"
      />
    </svg>
  );
};

