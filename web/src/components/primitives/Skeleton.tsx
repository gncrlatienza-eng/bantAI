import React from 'react';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  variant?: 'line' | 'row' | 'plain';
  style?: React.CSSProperties;
}

export function Skeleton({
  width,
  height,
  variant = 'line',
  style,
}: SkeletonProps) {
  const classes = `bantai-p-skeleton bantai-p-skeleton--${variant}`;
  const inline: React.CSSProperties = { ...style };
  if (width != null)
    inline.width = typeof width === 'number' ? `${width}px` : width;
  if (height != null)
    inline.height = typeof height === 'number' ? `${height}px` : height;
  return <span className={classes} style={inline} aria-hidden />;
}
