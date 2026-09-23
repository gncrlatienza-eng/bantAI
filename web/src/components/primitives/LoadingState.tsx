import React from 'react';

interface LoadingStateProps {
  label?: string;
}

export function LoadingState({ label = 'Loading...' }: LoadingStateProps) {
  return (
    <div className="bantai-p-loading" role="status" aria-live="polite">
      <span className="bantai-p-spinner" aria-hidden />
      <p className="bantai-p-loading__label">{label}</p>
    </div>
  );
}
