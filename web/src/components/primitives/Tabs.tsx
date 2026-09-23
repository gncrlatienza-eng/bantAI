import React from 'react';

/*
 * Accessible tab list.
 *
 * Controlled by parent: pass `activeId` and `onChange`. This lets the parent
 * sync tab state to the URL (query string or fragment) so back/forward and
 * deep links work. That is required for the Phase A consolidation of
 * /admin/model and /admin/system into tabbed single pages.
 *
 * Keyboard: ArrowLeft/ArrowRight to move focus + activate, Home/End for
 * first/last. Follows the WAI-ARIA Authoring Practices for tabs.
 */

export interface TabDef {
  id: string;
  label: string;
  badge?: React.ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  tabs: TabDef[];
  activeId: string;
  onChange: (id: string) => void;
  label?: string;
  children?: React.ReactNode;
}

export function Tabs({
  tabs,
  activeId,
  onChange,
  label = 'Sections',
  children,
}: TabsProps) {
  const listRef = React.useRef<HTMLDivElement>(null);

  const focusableIndexes = tabs
    .map((t, i) => (t.disabled ? -1 : i))
    .filter((i) => i >= 0);

  function handleKey(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let target: number | null = null;
    if (e.key === 'ArrowRight') {
      const pos = focusableIndexes.indexOf(index);
      target = focusableIndexes[(pos + 1) % focusableIndexes.length];
    } else if (e.key === 'ArrowLeft') {
      const pos = focusableIndexes.indexOf(index);
      target =
        focusableIndexes[
          (pos - 1 + focusableIndexes.length) % focusableIndexes.length
        ];
    } else if (e.key === 'Home') {
      target = focusableIndexes[0];
    } else if (e.key === 'End') {
      target = focusableIndexes[focusableIndexes.length - 1];
    }
    if (target != null) {
      e.preventDefault();
      const btn = listRef.current?.querySelectorAll('button')[target];
      btn?.focus();
      onChange(tabs[target].id);
    }
  }

  return (
    <div className="bantai-p-tabs">
      <div
        ref={listRef}
        className="bantai-p-tabs__list"
        role="tablist"
        aria-label={label}
      >
        {tabs.map((tab, index) => {
          const selected = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              className="bantai-p-tabs__tab"
              aria-selected={selected}
              aria-controls={`bantai-tabpanel-${tab.id}`}
              id={`bantai-tab-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => onChange(tab.id)}
              onKeyDown={(e) => handleKey(e, index)}
            >
              <span>{tab.label}</span>
              {tab.badge && (
                <span style={{ marginLeft: 6 }} aria-hidden>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {children && (
        <div
          role="tabpanel"
          id={`bantai-tabpanel-${activeId}`}
          aria-labelledby={`bantai-tab-${activeId}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
