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
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ flexShrink: 0, ...style }}
    >
      <defs>
        <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="50%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="cyberGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>
      </defs>
      
      {/* Outer Shield Path */}
      <path
        d="M16 2L4 7V15C4 22.5 9.2 28.6 16 30C22.8 28.6 28 22.5 28 15V7L16 2Z"
        fill="url(#shieldGrad)"
        stroke="#60a5fa"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Inner Cyber Core Grid / Node */}
      <path
        d="M16 7L8 11V15C8 20 11.4 24.5 16 25.8C20.6 24.5 24 20 24 15V11L16 7Z"
        fill="rgba(10, 15, 30, 0.65)"
        stroke="url(#cyberGlow)"
        strokeWidth="1"
      />

      {/* Center AI Node Core */}
      <circle cx="16" cy="15" r="3" fill="#ffffff" />
      <circle cx="16" cy="15" r="5" stroke="#93c5fd" strokeWidth="1" strokeDasharray="2 2" />

      {/* Connecting Circuit Nodes */}
      <path d="M16 10V12" stroke="#dbeafe" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16 18V20" stroke="#dbeafe" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M11 15H13" stroke="#dbeafe" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M19 15H21" stroke="#dbeafe" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
};
