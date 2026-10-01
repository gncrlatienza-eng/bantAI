import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Select,
} from '../../components/primitives';
import {
  getNotificationInbox,
  getNotificationPreferences,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
  type NotificationInbox,
  type NotificationPreferences,
  type PortalNotification,
} from '../../services/portalNotificationsService';

type Area = 'shield' | 'admin';
type CategoryKey =
  | 'campaignChangesEnabled'
  | 'subscriptionUpdatesEnabled'
  | 'apiUsageAlertsEnabled'
  | 'systemHealthAlertsEnabled';

// Only categories with a real event source are offered. Email delivery and
// export notices are not wired to anything yet, so they are not shown.
const CATEGORIES: Record<
  Area,
  { key: CategoryKey; label: string; help: string }[]
> = {
  shield: [
    {
      key: 'campaignChangesEnabled',
      label: 'Campaign intelligence',
      help: 'A campaign is published, or an approved change is added to its timeline.',
    },
    {
      key: 'subscriptionUpdatesEnabled',
      label: 'Subscription and access',
      help: 'Renewal reminders 14 days before expiry, and changes to your subscription or members.',
    },
    {
      key: 'apiUsageAlertsEnabled',
      label: 'API keys and usage',
      help: 'Keys are created, rotated or revoked, limits change, or usage reaches 80% or 100% of the monthly quota.',
    },
  ],
  admin: [
    {
      key: 'campaignChangesEnabled',
      label: 'Campaign review queue',
      help: 'Evolution entries, including analysis proposals, are waiting for approval.',
    },
    {
      key: 'subscriptionUpdatesEnabled',
      label: 'Applications and contracts',
      help: 'New Shield applications, historical contracts awaiting review, and licenses that expire or are suspended.',
    },
    {
      key: 'apiUsageAlertsEnabled',
      label: 'API quota',
      help: 'An organization reaches its monthly API quota.',
    },
    {
      key: 'systemHealthAlertsEnabled',
      label: 'AI system health',
      help: 'The AI service is unreachable or not ready, the serving model differs from the registry, a candidate awaits review, retraining fails, or drift is under investigation.',
    },
  ],
};

function errorText(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback;
}

function when(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
}

const PANEL = {
  background: 'var(--surface-raised)',
  border: '1px solid var(--border-default)',
  borderRadius: 8,
  padding: 20,
} as const;

export function NotificationCenter({ area }: { area: Area }) {
  const navigate = useNavigate();
  const [preferences, setPreferences] =
    useState<NotificationPreferences | null>(null);
  const [inbox, setInbox] = useState<NotificationInbox | null>(null);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [saving, setSaving] = useState<string>('');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const [nextPreferences, nextInbox] = await Promise.all([
        getNotificationPreferences(area),
        getNotificationInbox(area),
      ]);
      setPreferences(nextPreferences);
      setInbox(nextInbox);
    } catch (caught) {
      setLoadError(errorText(caught, 'Notifications could not be loaded.'));
    }
  }, [area]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo(
    () =>
      (inbox?.items ?? []).filter((item) => filter === 'all' || !item.readAt),
    [inbox, filter],
  );

  function applyRead(ids: string[] | 'all') {
    setInbox((current) => {
      if (!current) return current;
      const now = new Date().toISOString();
      const next = current.items.map((item) =>
        !item.readAt && (ids === 'all' || ids.includes(item.id))
          ? { ...item, readAt: now }
          : item,
      );
      return {
        items: next,
        unreadCount: next.filter((item) => !item.readAt).length,
      };
    });
  }

  async function save(key: keyof NotificationPreferences, value: boolean) {
    setSaving(key);
    setActionError('');
    try {
      setPreferences(
        await updateNotificationPreferences(area, { [key]: value }),
      );
      // A re-enabled category may have events waiting to be delivered.
      if (value) setInbox(await getNotificationInbox(area));
    } catch (caught) {
      setActionError(errorText(caught, 'Preferences could not be saved.'));
    } finally {
      setSaving('');
    }
  }

  async function read(item: PortalNotification) {
    setActionError('');
    try {
      await markNotificationRead(area, item.id);
      applyRead([item.id]);
    } catch (caught) {
      setActionError(errorText(caught, 'The notice could not be updated.'));
    }
  }

  async function open(item: PortalNotification) {
    if (!item.readAt) await read(item);
    if (item.link) void navigate(item.link);
  }

  async function readAll() {
    setActionError('');
    try {
      await markAllNotificationsRead(area);
      applyRead('all');
    } catch (caught) {
      setActionError(errorText(caught, 'Notices could not be updated.'));
    }
  }

  if (!preferences || !inbox) {
    return loadError ? (
      <ErrorState
        title="Notifications unavailable"
        description={loadError}
        action={
          <Button variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
        }
      />
    ) : (
      <LoadingState label="Loading notifications…" />
    );
  }

  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: 880 }}>
      {actionError && (
        <p role="alert" style={{ margin: 0, fontWeight: 600 }}>
          {actionError}
        </p>
      )}

      <section aria-labelledby={`${area}-inbox-title`} style={PANEL}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 12,
          }}
        >
          <h2
            id={`${area}-inbox-title`}
            style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}
          >
            Inbox
            <span
              style={{
                marginLeft: 8,
                fontWeight: 400,
                color: 'var(--text-secondary)',
              }}
            >
              {inbox.unreadCount
                ? `${inbox.unreadCount} unread`
                : 'All caught up'}
            </span>
          </h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 140 }}>
              <Select
                aria-label="Show notices"
                value={filter}
                options={[
                  { value: 'all', label: 'All notices' },
                  { value: 'unread', label: 'Unread only' },
                ]}
                onChange={(event) =>
                  setFilter(event.target.value as 'all' | 'unread')
                }
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              disabled={!inbox.unreadCount}
              onClick={() => void readAll()}
            >
              Mark all read
            </Button>
          </div>
        </div>

        {!preferences.inAppEnabled && (
          <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)' }}>
            In-app notifications are off, so no new notices are being added.
          </p>
        )}

        {items.length === 0 ? (
          <EmptyState
            title={filter === 'unread' ? 'No unread notices' : 'No notices yet'}
            description="Notices are created from verified system records as they happen."
          />
        ) : (
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'grid',
              gap: 1,
              background: 'var(--border-default)',
              border: '1px solid var(--border-default)',
              borderRadius: 6,
              overflow: 'hidden',
            }}
          >
            {items.map((item) => (
              <li
                key={item.id}
                style={{
                  // Actions sit beside the text on wide screens and wrap
                  // below it on phones instead of squeezing the message.
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px 12px',
                  alignItems: 'flex-start',
                  padding: '12px 14px',
                  background: 'var(--surface-raised)',
                  boxShadow: item.readAt
                    ? undefined
                    : 'inset 3px 0 0 var(--brand-primary)',
                }}
              >
                <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: item.readAt ? 500 : 700 }}>
                    {item.title}
                    {!item.readAt && (
                      <span className="bantai-visually-hidden"> (unread)</span>
                    )}
                  </p>
                  <p
                    style={{
                      margin: '4px 0 0',
                      color: 'var(--text-secondary)',
                      fontSize: '0.9rem',
                    }}
                  >
                    {item.body}
                  </p>
                  <p
                    style={{
                      margin: '4px 0 0',
                      color: 'var(--text-secondary)',
                      fontSize: '0.8rem',
                    }}
                  >
                    {when(item.createdAt)}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 6, flex: '0 0 auto' }}>
                  {item.link && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void open(item)}
                    >
                      Open
                    </Button>
                  )}
                  {!item.readAt && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void read(item)}
                    >
                      Mark read
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby={`${area}-preferences-title`} style={PANEL}>
        <h2
          id={`${area}-preferences-title`}
          style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 600 }}
        >
          What to notify me about
        </h2>
        <p
          style={{
            margin: '0 0 16px',
            color: 'var(--text-secondary)',
            fontSize: '0.9rem',
          }}
        >
          Notices appear here in the portal. Email delivery is not available
          yet.
        </p>
        <fieldset
          style={{ border: 0, margin: 0, padding: 0, display: 'grid', gap: 14 }}
        >
          <legend className="bantai-visually-hidden">
            Notification categories
          </legend>
          <PreferenceToggle
            id={`${area}-inApp`}
            label="In-app notifications"
            help="Turn off to stop new notices for every category below."
            checked={preferences.inAppEnabled}
            busy={saving === 'inAppEnabled'}
            onChange={(value) => void save('inAppEnabled', value)}
          />
          {CATEGORIES[area].map((category) => (
            <PreferenceToggle
              key={category.key}
              id={`${area}-${category.key}`}
              label={category.label}
              help={category.help}
              checked={preferences[category.key]}
              disabled={!preferences.inAppEnabled}
              busy={saving === category.key}
              onChange={(value) => void save(category.key, value)}
            />
          ))}
        </fieldset>
      </section>
    </div>
  );
}

function PreferenceToggle({
  id,
  label,
  help,
  checked,
  disabled = false,
  busy,
  onChange,
}: {
  id: string;
  label: string;
  help: string;
  checked: boolean;
  disabled?: boolean;
  busy: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: '2px 10px',
        alignItems: 'start',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled || busy}
        aria-describedby={`${id}-help`}
        onChange={(event) => onChange(event.target.checked)}
        style={{ marginTop: 3 }}
      />
      <label htmlFor={id} style={{ fontWeight: 600, fontSize: '0.9rem' }}>
        {label}
        {busy && (
          <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>
            {' '}
            · saving…
          </span>
        )}
      </label>
      <span
        id={`${id}-help`}
        style={{
          gridColumn: 2,
          color: 'var(--text-secondary)',
          fontSize: '0.85rem',
        }}
      >
        {help}
      </span>
    </div>
  );
}
