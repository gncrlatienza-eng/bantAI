import React from 'react';

interface ShieldLogoProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const ShieldLogo: React.FC<ShieldLogoProps> = ({
  size = 32,
  className = '',
  style,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{
        flexShrink: 0,
        borderRadius: size * 0.22,
        filter: 'drop-shadow(0 4px 12px rgba(49, 46, 129, 0.45))',
        ...style,
      }}
    >
      <defs>
        <linearGradient id="bantaiOfficialLogoGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#4338CA" />
        </linearGradient>
      </defs>
      <rect
        x="0"
        y="0"
        width="512"
        height="512"
        rx="120"
        fill="url(#bantaiOfficialLogoGrad)"
      />
      <path
        d="M256 112 C169 112 100 168 100 238 C100 288 137 331 190 351 C186 368 176 384 163 397 C160 400 162 405 166 405 C198 404 227 393 250 377 C252 377 254 377 256 377 C343 377 412 321 412 238 C412 168 343 112 256 112 Z"
        fill="#FFFFFF"
      />
      <path
        d="M256 212 L282 223 V245 C282 267 271 282 256 289 C241 282 230 267 230 245 V223 Z"
        fill="#4338CA"
      />
    </svg>
  );
};
