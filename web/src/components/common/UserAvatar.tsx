import React from 'react';
import { AvatarState } from '../../context/UserAvatarContext';

interface UserAvatarProps {
  avatar?: AvatarState;
  role: 'client' | 'admin';
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  fallbackInitials?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  avatar,
  role,
  size = 36,
  className = '',
  style = {},
  fallbackInitials,
}) => {
  const isClient = role === 'client';
  const defaultGrad = isClient
    ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
    : 'linear-gradient(135deg, #d97706 0%, #b45309 100%)';
  const defaultInitials = fallbackInitials || (isClient ? 'MS' : 'GA');

  const activeGrad = avatar?.gradient || defaultGrad;
  const activeType = avatar?.type || 'initials';

  return (
    <div
      className={`avatar ${role} ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        borderRadius: '50%',
        background: activeGrad,
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: `${size * 0.42}px`,
        boxShadow: isClient ? '0 0 16px rgba(37, 99, 235, 0.35)' : '0 0 16px rgba(217, 119, 6, 0.35)',
        border: '2px solid rgba(255, 255, 255, 0.25)',
        overflow: 'hidden',
        lineHeight: 1,
        userSelect: 'none',
        flexShrink: 0,
        ...style,
      }}
    >
      {activeType === 'preset' && (
        <span style={{ fontSize: `${size * 0.52}px`, display: 'inline-block', transform: 'translateY(-1px)' }}>
          {avatar?.presetIcon || '👤'}
        </span>
      )}

      {activeType === 'image' && avatar?.imageUrl ? (
        <img
          src={avatar.imageUrl}
          alt="User Avatar"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : null}

      {activeType === 'initials' && (
        <span>{avatar?.initials || defaultInitials}</span>
      )}
    </div>
  );
};
