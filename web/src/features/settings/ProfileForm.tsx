/*
 * Shared profile form used by client and admin settings pages.
 *
 * Loads the current user, edits firstName/lastName/email in place, and
 * calls updateMyProfile. Read-only rows for phone and role (backend does not
 * expose write endpoints for those on this route).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  ErrorState,
  Input,
  LoadingState,
  StatusBadge,
} from '../../components/primitives';
import { getCurrentUser, type CurrentUser } from '../../services/authService';
import { updateMyProfile } from '../../services/usersService';

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : 'The backend request failed.';
}

export function ProfileForm() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await getCurrentUser();
      setUser(me);
      setFirstName(me.firstName ?? '');
      setLastName(me.lastName ?? '');
      setEmail(me.email ?? '');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveMessage(null);
    try {
      const next = await updateMyProfile({
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        email: email.trim() || undefined,
      });
      setUser(next);
      setSaveMessage('Profile saved.');
    } catch (e) {
      setSaveMessage(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState label="Loading profile" />;
  if (error) {
    return (
      <ErrorState
        title="Profile unavailable"
        description={error}
        action={
          <Button variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
        }
      />
    );
  }
  if (!user) return null;

  return (
    <form
      onSubmit={(e) => void handleSave(e)}
      style={{ display: 'grid', gap: 16, maxWidth: 520 }}
    >
      <div
        style={{
          padding: '12px 14px',
          background: 'var(--surface-raised)',
          border: '1px solid var(--border-default)',
          borderRadius: 8,
          display: 'grid',
          gridTemplateColumns: 'max-content 1fr',
          gap: '8px 16px',
          fontSize: '0.9rem',
        }}
      >
        <span style={{ color: 'var(--text-secondary)' }}>Phone</span>
        <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>
          {user.phone}
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>Role</span>
        <span>
          <StatusBadge
            kind={user.role === 'ADMIN' ? 'suspicious' : 'unknown'}
            label={user.role}
          />
        </span>
      </div>

      <Input
        label="First name"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        autoComplete="given-name"
      />
      <Input
        label="Last name"
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
        autoComplete="family-name"
      />
      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save profile'}
        </Button>
        {saveMessage && (
          <span
            aria-live="polite"
            style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}
          >
            {saveMessage}
          </span>
        )}
      </div>
    </form>
  );
}
