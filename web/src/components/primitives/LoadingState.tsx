import React from 'react';

interface LoadingStateProps {
  label?: string;
  /**
   * Fill the whole screen on the light theme with the spinner centered:
   * for route-level loading, which renders before any page shell exists
   * (it used to fall through to the legacy dark background, top-aligned).
   */
  fullScreen?: boolean;
}

export function LoadingState({
  label = 'Loading...',
  fullScreen = false,
}: LoadingStateProps) {
  const content = (
    <div className="bantai-p-loading" role="status" aria-live="polite">
      <span className="bantai-p-spinner" aria-hidden />
      <p className="bantai-p-loading__label">{label}</p>
    </div>
  );
  if (!fullScreen) return content;
  return (
    <div data-theme="mineral" className="bantai-p-loading-screen">
      {content}
    </div>
  );
}
