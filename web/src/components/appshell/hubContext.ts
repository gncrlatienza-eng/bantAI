import React from 'react';

/*
 * Set by HubPage around its tab content. A screen that also works on its own
 * (Reports, Users...) keeps its PageHeader; inside a hub that header gives up
 * its title (the hub owns the h1) and sends its description and actions to
 * `slot`, the right end of the hub's tab bar, so nothing floats under the
 * tabs.
 */
export const HubContext = React.createContext<{
  title: string;
  slot: HTMLElement | null;
} | null>(null);
