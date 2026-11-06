import React from 'react';

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Wraps each occurrence of a mark phrase in <mark>. */
export function highlight(
  text: string,
  marks: readonly string[],
): React.ReactNode[] {
  if (marks.length === 0) return [text];
  const pattern = new RegExp(`(${marks.map(escape).join('|')})`, 'g');
  return text
    .split(pattern)
    .map((part, i) =>
      marks.includes(part) ? <mark key={i}>{part}</mark> : part,
    );
}
