import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { HubPage } from './HubPage';
import { PageHeader } from './AppShell';
import { ADMIN_NAV } from '../../navigation/portalNav';

const review = ADMIN_NAV[0].sections.find((s) => s.id === 'review')!;

function mount(path: string, permissions: string[]) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/admin/review"
          element={
            <HubPage
              section={review}
              permissions={permissions}
              legacyTabs={{ senders: '/admin/review/senders' }}
            />
          }
        >
          <Route
            path="reports"
            element={
              <>
                <PageHeader title="Reports" description="Report queue" />
                <p>Reports screen</p>
              </>
            }
          />
          <Route path="senders" element={<p>Senders screen</p>} />
          <Route path="detections" element={<p>Detections screen</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('HubPage', () => {
  it('opens the first permitted tab from the bare hub path', () => {
    mount('/admin/review', ['*']);
    expect(screen.getByText('Reports screen')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Message reports' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('shows one h1 (the hub) and steps the screen header down', () => {
    mount('/admin/review/reports', ['*']);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Review' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Report queue')).toBeInTheDocument();
  });

  it('lists only the tabs the account may open', () => {
    mount('/admin/review', ['verification:read', 'models:read']);
    expect(screen.getByText('Senders screen')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Message reports' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Detections' }),
    ).toBeInTheDocument();
  });

  it('maps an old ?tab= deep link to its new tab', () => {
    mount('/admin/review?tab=senders', ['*']);
    expect(screen.getByText('Senders screen')).toBeInTheDocument();
  });
});
