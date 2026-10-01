/*
 * Shield documentation, served by the backend (GET /shield/documentation) so
 * the routes, scopes, limits and errors shown here always match the running
 * API. It never exposes administration, training or raw mobile material.
 */

import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/appshell/AppShell';
import {
  Button,
  DataTable,
  ErrorState,
  LoadingState,
  type Column,
} from '../../components/primitives';
import { logout } from '../../services/authService';
import { useClientSidebarGroups } from './clientNav';
import {
  getShieldDocumentation,
  type ShieldDocEndpoint,
  type ShieldDocError,
  type ShieldDocSection,
  type ShieldDocumentation,
} from '../../services/portalNotificationsService';

const MUTED = { color: 'var(--text-secondary)' } as const;
const MONO = { fontFamily: 'var(--font-mono)', fontSize: '0.85rem' } as const;

const SCOPE_LABEL: Record<string, string> = {
  READ_CAMPAIGNS: 'Read campaigns',
  READ_INDICATORS: 'Read indicators',
  READ_MASKED_MESSAGES: 'Read masked examples',
  EXPORT_CAMPAIGNS: 'Export campaigns',
};

const ENDPOINT_COLUMNS: Column<ShieldDocEndpoint>[] = [
  {
    key: 'route',
    header: 'Request',
    render: (e) => (
      <code style={MONO}>
        {e.method} {e.path}
      </code>
    ),
  },
  {
    key: 'scope',
    header: 'Scope',
    width: '18%',
    render: (e) => SCOPE_LABEL[e.scope] ?? e.scope,
  },
  { key: 'description', header: 'Returns', render: (e) => e.description },
];

const ERROR_COLUMNS: Column<ShieldDocError>[] = [
  { key: 'status', header: 'Status', width: '9%', render: (e) => e.status },
  {
    key: 'message',
    header: 'Message',
    width: '30%',
    render: (e) => <code style={MONO}>{e.message}</code>,
  },
  { key: 'action', header: 'What to do', render: (e) => e.action },
];

function DocSection({ section }: { section: ShieldDocSection }) {
  const [copied, setCopied] = useState(false);
  return (
    <section
      id={`doc-${section.id}`}
      aria-labelledby={`doc-${section.id}-title`}
      style={{
        background: 'var(--surface-raised)',
        border: '1px solid var(--border-default)',
        borderRadius: 8,
        padding: 20,
        scrollMarginTop: 80,
      }}
    >
      <h2
        id={`doc-${section.id}-title`}
        style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}
      >
        {section.title}
      </h2>
      <p style={{ margin: '6px 0 0', lineHeight: 1.6 }}>{section.summary}</p>
      {section.paragraphs?.map((paragraph) => (
        <p
          key={paragraph}
          style={{ ...MUTED, margin: '10px 0 0', lineHeight: 1.6 }}
        >
          {paragraph}
        </p>
      ))}
      {section.list && (
        <ul
          style={{
            ...MUTED,
            margin: '10px 0 0',
            paddingLeft: 20,
            lineHeight: 1.6,
          }}
        >
          {section.list.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      {section.code && (
        <div style={{ position: 'relative', marginTop: 12 }}>
          <pre
            style={{
              ...MONO,
              margin: 0,
              padding: '12px 14px',
              paddingRight: 88,
              background: 'var(--surface-canvas)',
              border: '1px solid var(--border-default)',
              borderRadius: 6,
              overflowX: 'auto',
              whiteSpace: 'pre',
            }}
          >
            {section.code}
          </pre>
          <div style={{ position: 'absolute', top: 8, right: 8 }}>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(section.code ?? '')
                  .then(() => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1500);
                  });
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>
      )}
      {section.endpoints && (
        <div style={{ marginTop: 12 }}>
          <DataTable<ShieldDocEndpoint>
            ariaLabel="Shield API endpoints"
            rowKey={(e) => e.path}
            rows={section.endpoints}
            columns={ENDPOINT_COLUMNS}
          />
        </div>
      )}
      {section.errors && (
        <div style={{ marginTop: 12 }}>
          <DataTable<ShieldDocError>
            ariaLabel="Shield API errors"
            rowKey={(e) => `${e.status}-${e.message}`}
            rows={section.errors}
            columns={ERROR_COLUMNS}
          />
        </div>
      )}
    </section>
  );
}

export function HelpPage() {
  const sidebarGroups = useClientSidebarGroups();
  const navigate = useNavigate();
  const location = useLocation();
  const [documentation, setDocumentation] =
    useState<ShieldDocumentation | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setDocumentation(await getShieldDocumentation());
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Documentation could not be loaded.',
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell
      role="client"
      groups={sidebarGroups}
      brandInitial="S"
      brandLabel="BantAI Shield"
      currentPath={location.pathname}
      onNavigate={(p) => void navigate(p)}
      topbarContext={<span>Shield &middot; Documentation</span>}
      topbarUtility={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            logout();
            void navigate('/login');
          }}
        >
          Sign out
        </Button>
      }
      footer={
        <span style={{ fontSize: '0.85rem' }}>
          Shield intelligence subscription
        </span>
      }
    >
      <PageHeader
        title="Documentation"
        description="How to read Shield campaign intelligence and use the Shield API safely."
        meta={
          documentation
            ? `Updated ${new Date(documentation.updatedAt).toLocaleDateString()}`
            : undefined
        }
      />
      {!documentation ? (
        error ? (
          <ErrorState
            title="Documentation unavailable"
            description={error}
            action={
              <Button variant="secondary" onClick={() => void load()}>
                Retry
              </Button>
            }
          />
        ) : (
          <LoadingState label="Loading Shield documentation…" />
        )
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gap: 16,
            maxWidth: 920,
          }}
        >
          <p
            role="note"
            style={{
              margin: 0,
              padding: '10px 14px',
              borderRadius: 6,
              border: '1px solid var(--border-default)',
              background: 'var(--surface-raised)',
              fontSize: '0.9rem',
            }}
          >
            <strong>
              {documentation.api.released
                ? 'The Shield API is available.'
                : 'The Shield API is not released yet.'}
            </strong>{' '}
            <span style={MUTED}>
              {documentation.api.released
                ? `Requests go to ${documentation.api.basePath}.`
                : 'Everything else in the portal works today; API requests return 403 until BantAI enables them.'}
            </span>
          </p>
          <nav aria-label="On this page">
            <p
              style={{
                ...MUTED,
                margin: '0 0 6px',
                fontSize: '0.8rem',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              On this page
            </p>
            <ul
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px 16px',
                listStyle: 'none',
                margin: 0,
                padding: 0,
                fontSize: '0.9rem',
              }}
            >
              {documentation.sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#doc-${section.id}`}
                    style={{
                      color: 'var(--brand-primary)',
                      textDecoration: 'underline',
                    }}
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          {documentation.sections.map((section) => (
            <DocSection key={section.id} section={section} />
          ))}
        </div>
      )}
    </AppShell>
  );
}

export default HelpPage;
