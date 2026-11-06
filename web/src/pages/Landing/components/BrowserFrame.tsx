import React from 'react';
import './BrowserFrame.css';

interface BrowserFrameProps {
  url: string;
  children: React.ReactNode;
  className?: string;
}

/** Frames a real portal capture. The chrome is decorative; the capture carries the alt text. */
export function BrowserFrame({
  url,
  children,
  className = '',
}: BrowserFrameProps) {
  return (
    <div className={`bf ${className}`}>
      <div className="bf__chrome" aria-hidden="true">
        <span className="bf__dot" />
        <span className="bf__dot" />
        <span className="bf__dot" />
        <span className="bf__url">{url}</span>
      </div>
      <div className="bf__viewport">{children}</div>
    </div>
  );
}
