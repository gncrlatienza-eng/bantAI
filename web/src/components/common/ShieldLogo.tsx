import React, { useId } from 'react';

interface ShieldLogoProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  /*
   * 'indigo' (default) — the official gradient mark from Bantai-Logo.dc.html.
   * 'brand'            — same geometry, flat fill in the cream/plum theme's
   *                      --brand-primary, for surfaces built on that palette.
   */
  tone?: 'indigo' | 'brand';
}

/* Official BantAI mark: a chat bubble carrying a shield. */
export const ShieldLogo: React.FC<ShieldLogoProps> = ({
  size = 32,
  className = '',
  style,
  tone = 'indigo',
}) => {
  const uid = useId().replace(/:/g, '');
  const gradId = `bantai-logo-grad-${uid}`;
  const shadowId = `bantai-logo-shadow-${uid}`;
  const isBrand = tone === 'brand';
  const tileFill = isBrand ? 'var(--brand-primary)' : `url(#${gradId})`;
  const shieldFill = isBrand ? 'var(--brand-primary)' : '#4338CA';

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
        filter: isBrand
          ? undefined
          : 'drop-shadow(0 4px 12px rgba(49, 46, 129, 0.45))',
        ...style,
      }}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#4338CA" />
        </linearGradient>
        <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy="6"
            stdDeviation="10"
            floodColor={isBrand ? '#211f24' : '#312E81'}
            floodOpacity={isBrand ? 0.25 : 0.35}
          />
        </filter>
      </defs>
      <rect x="0" y="0" width="512" height="512" rx="120" fill={tileFill} />
      <path
        d="M256 112 C169 112 100 168 100 238 C100 288 137 331 190 351 C186 368 176 384 163 397 C160 400 162 405 166 405 C198 404 227 393 250 377 C252 377 254 377 256 377 C343 377 412 321 412 238 C412 168 343 112 256 112 Z"
        fill="#FFFFFF"
        filter={`url(#${shadowId})`}
      />
      <path
        d="M256 194 L304 211 V244 C304 277 285 298 256 309 C227 298 208 277 208 244 V211 Z"
        fill={shieldFill}
      />
    </svg>
  );
};
