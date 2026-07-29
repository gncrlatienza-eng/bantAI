import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

interface NavGroup {
  title?: string;
  items: NavItem[];
}

interface PortalShellProps {
  role: 'client' | 'admin';
  sidebarGroups: NavGroup[];
  title: string;
  tag: string;
  userInitials: string;
  userName: string;
  userMeta: string;
  org: string;
  children: React.ReactNode;
}

export const PortalShell: React.FC<PortalShellProps> = ({
  role,
  sidebarGroups,
  title,
  tag,
  userInitials,
  userName,
  userMeta,
  org,
  children,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="dashboard-shell">
      <Sidebar
        role={role}
        groups={sidebarGroups}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        userInitials={userInitials}
        userName={userName}
        userMeta={userMeta}
        org={org}
      />

      <main
        className="dashboard-main"
        style={{
          marginLeft: collapsed ? 76 : 260,
          transition: 'margin-left 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <Topbar role={role} title={title} tag={tag} userInitials={userInitials} />
        <div className="dashboard-content animate-fade-in">{children}</div>
      </main>
    </div>
  );
};
