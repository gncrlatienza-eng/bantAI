/*
 * Small display helpers shared by admin pages, so one status word or one id
 * reads the same on Overview, System, Reports and Model.
 */

import React from 'react';
import type { StatusKind } from '../../components/primitives';
import { Button, HelpPopover } from '../../components/primitives';
import {
  ArrowRightIcon,
  SortDescIcon,
} from '../../components/primitives/icons';

const HEALTHY = new Set([
  'ok',
  'up',
  'ready',
  'healthy',
  'reachable',
  'operational',
]);
const DEGRADED = new Set(['degraded', 'warning']);
const DOWN = new Set(['down', 'error', 'failed', 'unreachable']);

/** Exact status words only: "unhealthy" or "not ready" must never read green. */
export function healthKind(status: string | null | undefined): StatusKind {
  const s = (status ?? '').trim().toLowerCase();
  if (HEALTHY.has(s)) return 'verified';
  if (DEGRADED.has(s)) return 'suspicious';
  if (DOWN.has(s)) return 'threat';
  return 'unknown';
}

/** The database is healthy only when it is reachable and readiness passes. */
export function databaseKind(database: string, readiness: string): StatusKind {
  if (
    healthKind(readiness) === 'verified' &&
    healthKind(database) === 'verified'
  )
    return 'verified';
  return healthKind(database);
}

/** Ham / Spam / Scam use the same badge everywhere, labelled with the class. */
export function classificationKind(
  label: string | null | undefined,
): StatusKind {
  switch (label) {
    case 'Scam':
      return 'threat';
    case 'Spam':
      return 'suspicious';
    case 'Ham':
      return 'verified';
    default:
      return 'unknown';
  }
}

const MONO = { fontFamily: 'var(--font-mono)', fontSize: '0.85rem' } as const;

/**
 * A pseudonymous id shortened to its first 8 characters, like Audit events.
 * The full id stays in the tooltip, for screen readers, and in a copy.
 */
export function ShortId({ id }: { id: string }) {
  if (id.length <= 9) return <code style={MONO}>{id}</code>;
  return (
    <code title={id} aria-label={id} style={MONO}>
      {id.slice(0, 8)}…
    </code>
  );
}

/*
 * Header for a column the server already orders by, newest first. It shows
 * the same arrow as a sorted DataTable column, but is not a button: the
 * order comes from the API and paging, not from the browser.
 */
export function NewestFirstHeader({ children }: { children: React.ReactNode }) {
  return (
    <span
      title="Newest first"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
    >
      {children}
      <span aria-hidden style={{ display: 'inline-flex' }}>
        <SortDescIcon />
      </span>
    </span>
  );
}

/* "How this works" popover; see HelpPopover in components/primitives. */
export function HowThisWorks({
  align,
  children,
}: {
  align?: 'start' | 'end';
  children: React.ReactNode;
}) {
  return <HelpPopover align={align}>{children}</HelpPopover>;
}

/** Keeps the start and end of a long id, e.g. "candidate-2026…colab-C-local". */
export function middleTruncate(value: string, max = 24): string {
  if (value.length <= max) return value;
  const head = Math.ceil((max - 1) / 2);
  const tail = Math.floor((max - 1) / 2);
  return `${value.slice(0, head)}…${value.slice(value.length - tail)}`;
}

/*
 * A text value (a version tag) inside a Metric. Metric values are sized for
 * short numbers; a long tag at that size wrapped over three lines, so text
 * values get a smaller size and middle truncation with the full tag on hover.
 */
export function TextMetricValue({ value }: { value: string }) {
  const shown = middleTruncate(value);
  return (
    <span
      title={value}
      aria-label={value}
      style={{
        display: 'block',
        fontSize: '1.15rem',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {shown}
    </span>
  );
}

/** "Up 1h 49m": uptime a person can read at a glance instead of raw seconds. */
export function formatUptime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `Up ${d}d ${h}h`;
  if (h > 0) return `Up ${h}h ${m}m`;
  return `Up ${m}m`;
}

/*
 * A section title with its one action on the right. The action is a real
 * bordered button with an arrow, so it reads as clickable (the ghost style
 * only showed a background on hover).
 */
export function SectionHeading({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 12,
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: '1rem',
          fontWeight: 600,
          letterSpacing: '-0.01em',
          color: 'var(--text-primary)',
        }}
      >
        {title}
      </h2>
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          {actionLabel}
          <ArrowRightIcon aria-hidden />
        </Button>
      )}
    </div>
  );
}

/* One service in "System status": its name, one badge, an optional line. */
export function StatusCard({
  label,
  children,
  detail,
}: {
  label: string;
  children: React.ReactNode;
  detail?: string;
}) {
  return (
    <article
      style={{
        background: 'var(--surface-raised)',
        border: '1px solid var(--border-default)',
        borderRadius: 10,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 8,
      }}
    >
      <span
        style={{
          fontSize: '0.7rem',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
        }}
      >
        {label}
      </span>
      {children}
      {detail && (
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {detail}
        </span>
      )}
    </article>
  );
}

/** "PAST_DUE" → "Past due", "CONTRACT REVIEW" → "Contract review". */
export function humanizeEnum(value: string): string {
  const words = value.replaceAll('_', ' ').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
