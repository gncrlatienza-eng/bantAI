import React from 'react';
import { Tone } from '../../types/common';

interface BadgeProps {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, tone = 'gray', className = '' }) => {
  return (
    <span className={`badge badge-${tone} ${className}`.trim()}>
      {children}
    </span>
  );
};
