/*
 * A hub: one sidebar destination whose screens are tabs (Review, Model,
 * Customers, System, Settings). Tabs are links, since each changes the URL;
 * the tab strip shows only the tabs this account may open, and the hub's
 * bare path opens the first of them.
 */

import React from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { PortalSection } from '../../navigation/portalNav';
import { visibleTabs } from '../../navigation/portalNav';
import { PageHeader } from './AppShell';
import { HubContext } from './hubContext';

interface HubPageProps {
  section: PortalSection;
  permissions: string[];
  description?: string;
  /** Shown above the tabs (e.g. an account-wide notice). */
  notice?: React.ReactNode;
  /** Old `?tab=` values → new paths, so pre-hub deep links still land. */
  legacyTabs?: Record<string, string>;
}

export function HubPage({
  section,
  permissions,
  description,
  notice,
  legacyTabs,
}: HubPageProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [slot, setSlot] = React.useState<HTMLElement | null>(null);
  const tabs = visibleTabs(section, permissions);
  const active = tabs.find(
    (t) =>
      location.pathname === t.path ||
      location.pathname.startsWith(t.path + '/'),
  );

  if (!active) {
    const legacy = new URLSearchParams(location.search).get('tab');
    if (legacy && legacyTabs?.[legacy]) {
      return <Navigate to={legacyTabs[legacy]} replace />;
    }
    return tabs.length ? <Navigate to={tabs[0].path} replace /> : null;
  }

  return (
    <>
      <PageHeader title={section.label} description={description} />
      {notice}
      <div className="bantai-hubbar">
        {tabs.length > 1 ? (
          <nav
            className="bantai-hubtabs"
            aria-label={`${section.label} sections`}
          >
            {tabs.map((tab) => (
              <a
                key={tab.id}
                href={tab.path}
                className="bantai-hubtabs__tab"
                aria-current={tab === active ? 'page' : undefined}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey) return;
                  event.preventDefault();
                  void navigate(tab.path);
                }}
              >
                {tab.label}
              </a>
            ))}
          </nav>
        ) : (
          <span className="bantai-hubbar__single">{active.label}</span>
        )}
        {/* The current screen's help and actions are portalled in here. */}
        <div ref={setSlot} className="bantai-hubbar__aside" />
      </div>
      <HubContext.Provider value={{ title: section.label, slot }}>
        <div className="bantai-hubpanel">
          <Outlet />
        </div>
      </HubContext.Provider>
    </>
  );
}

export default HubPage;
