import React from 'react';

/*
 * The heading above a table or form section inside a screen: title, an
 * optional one-line description, and actions (filters, buttons) at the
 * right. One style for every section in the portal.
 * Styles live in appshell.css (.bantai-section-header).
 */
export function SectionHeader({
  id,
  title,
  description,
  actions,
}: {
  id?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="bantai-section-header">
      <div className="bantai-section-header__text">
        <h2 id={id} className="bantai-section-header__title">
          {title}
        </h2>
        {description && (
          <p className="bantai-section-header__description">{description}</p>
        )}
      </div>
      {actions && (
        <div className="bantai-section-header__actions">{actions}</div>
      )}
    </div>
  );
}

export default SectionHeader;
