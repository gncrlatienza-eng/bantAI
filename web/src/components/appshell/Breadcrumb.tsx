import React from 'react';
import type { BreadcrumbPart } from '../../navigation/portalNav';

/* Top-bar breadcrumb: "Section / Tab", generated from the route registry. */
export function Breadcrumb({
  parts,
  onNavigate,
}: {
  parts: BreadcrumbPart[];
  onNavigate: (path: string) => void;
}) {
  if (!parts.length) return null;
  return (
    <nav aria-label="Breadcrumb" className="bantai-breadcrumb">
      <ol>
        {parts.map((part, index) => {
          const last = index === parts.length - 1;
          return (
            <li key={`${part.label}-${index}`}>
              {part.path && !last ? (
                <a
                  href={part.path}
                  onClick={(event) => {
                    event.preventDefault();
                    onNavigate(part.path!);
                  }}
                >
                  {part.label}
                </a>
              ) : (
                <span aria-current={last ? 'page' : undefined}>
                  {part.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default Breadcrumb;
