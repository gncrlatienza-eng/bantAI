import React from 'react';
import { InfoIcon } from './icons';

/*
 * Method, threshold and "what is this screen" detail, one click away
 * instead of a sentence under every heading (progressive disclosure): a
 * quiet info button that opens a small popover. Native <details> keeps it
 * keyboard and screen-reader accessible; a click outside or Escape closes it.
 * Styles live in appshell.css (.bantai-howto).
 */
export function HelpPopover({
  label = 'How this works',
  align = 'start',
  children,
}: {
  label?: string;
  /** Which edge the popover lines up with: 'end' for buttons at a right edge. */
  align?: 'start' | 'end';
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDetailsElement>(null);
  React.useEffect(() => {
    const close = () => {
      if (ref.current) ref.current.open = false;
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && ref.current?.open) {
        close();
        ref.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);
  return (
    <details ref={ref} className="bantai-howto" data-align={align}>
      <summary className="bantai-howto__toggle">
        <InfoIcon aria-hidden />
        {label}
      </summary>
      <div className="bantai-howto__body">{children}</div>
    </details>
  );
}

export default HelpPopover;
