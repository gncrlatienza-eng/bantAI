/*
 * BantAI Android app, light theme, recreated in HTML with demo data.
 *
 * Layout and wording follow the shipped app (v1.7): the floating tab bar,
 * the filter pills, the AI Summary sheet and the Scam Waves rows, with
 * strings from mobile/.../res/values/strings.xml and colours from
 * ui/theme/Color.kt (LightColors). Every name, number and link comes from
 * the synthetic landing fixture — nothing here is a real person's inbox.
 *
 * These are pictures of the app: one accessible description per frame or
 * crop, the replica itself aria-hidden and never focusable.
 */
import React from 'react';
import {
  BatteryFull,
  Bell,
  Layers,
  MessageSquare,
  Send,
  Settings,
  ShieldCheck,
  Signal,
  Wifi,
} from 'lucide-react';
import {
  DEMO_ALERT,
  DEMO_CAMPAIGN,
  VARIANT_COUNT,
  fullText,
} from '../landingFixture';
import './appkit.css';

export const ALERT_TEXT = fullText(DEMO_ALERT.variant);
export const SUMMARY_TEXT =
  'Says your GCash account will be suspended and pushes you to a look-alike link to “verify”. GCash does not ask you to verify your account through a text link.';

/* ---------- frame ---------- */

export function AppPhone({
  label,
  className = '',
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <figure className={`ak-phone ${className}`} role="img" aria-label={label}>
      <div className="ak-phone__screen" aria-hidden="true">
        <div className="ak-status">
          <span>9:41</span>
          <span className="ak-status__icons">
            <Signal strokeWidth={2.4} />
            <Wifi strokeWidth={2.4} />
            <BatteryFull strokeWidth={2.2} />
          </span>
        </div>
        {children}
      </div>
    </figure>
  );
}

/** A cropped piece of app UI on a light card (no phone frame). */
export function AppCrop({
  label,
  className = '',
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <figure className={`ak-crop ${className}`} role="img" aria-label={label}>
      <div className="ak-crop__inner" aria-hidden="true">
        {children}
      </div>
    </figure>
  );
}

/* ---------- pieces ---------- */

const AVATAR: Record<string, string> = {
  G: '#00BCD4',
  M: '#4CAF50',
  P: '#FF9500',
  S: '#9C27B0',
  L: '#E91E8C',
};

export function Avatar({ name }: { name: string }) {
  const letter =
    name
      .replace(/[^A-Z]/gi, '')
      .charAt(0)
      .toUpperCase() || '#';
  return (
    <span
      className="ak-avatar"
      style={{ background: AVATAR[letter] ?? '#8E8E93' }}
    >
      {letter}
    </span>
  );
}

export function Chip({
  tone,
  children,
}: {
  tone: 'danger' | 'warn' | 'safe' | 'indigo';
  children: React.ReactNode;
}) {
  return <span className={`ak-chip ak-chip--${tone}`}>{children}</span>;
}

export function Pills({ active = 'All' }: { active?: string }) {
  return (
    <div className="ak-pills">
      {['All', 'Spam', 'Unknown', 'Unread'].map((p) => (
        <span key={p} className={p === active ? 'is-active' : undefined}>
          {p}
        </span>
      ))}
    </div>
  );
}

export function Row({
  sender,
  time,
  preview,
  chip,
  unread,
  className = '',
}: {
  sender: string;
  time: string;
  preview: string;
  chip?: React.ReactNode;
  unread?: boolean;
  className?: string;
}) {
  return (
    <div className={`ak-row ${className}`}>
      <Avatar name={sender} />
      <div className="ak-row__main">
        <div className="ak-row__top">
          <b className={unread ? 'is-unread' : undefined}>{sender}</b>
          <span>{time}</span>
        </div>
        <p className="ak-row__preview">{preview}</p>
        {chip}
      </div>
    </div>
  );
}

const TABS = [
  ['Messages', MessageSquare],
  ['Alerts', Bell],
  ['Scam Waves', Layers],
  ['Settings', Settings],
] as const;

export function TabBar({ active = 'Messages' }: { active?: string }) {
  return (
    <div className="ak-tabbar">
      {TABS.map(([t, Icon]) => (
        <span key={t} className={t === active ? 'is-active' : undefined}>
          <Icon strokeWidth={1.8} />
          {t}
        </span>
      ))}
    </div>
  );
}

export const INBOX_ROWS = [
  {
    sender: 'Mama',
    time: '9:20 AM',
    preview: 'Nakauwi ka na? Text mo ako pag nasa bahay ka na.',
  },
  {
    sender: 'PROMO-DATA',
    time: 'Yesterday',
    preview: 'Get 30GB for 7 days! Reply YES to subscribe now.',
  },
  {
    sender: 'Lazada',
    time: 'Mon',
    preview: 'Your parcel is out for delivery today. Track it in the app.',
  },
];

export function SummarySheet() {
  return (
    <div className="ak-sheet">
      <span className="ak-sheet__grab" />
      <p className="ak-sheet__title">
        <span className="ak-spark">✦</span> AI Summary
      </p>
      <Chip tone="danger">Likely scam</Chip>
      <p className="ak-label">WHAT IT&apos;S ABOUT</p>
      <p className="ak-sheet__text">{SUMMARY_TEXT}</p>
      <p className="ak-sheet__link">Report or block this sender ›</p>
    </div>
  );
}

export function Bubble({ children }: { children: React.ReactNode }) {
  return <p className="ak-bubble">{children}</p>;
}

export function ChatHeader() {
  return (
    <div className="ak-chathead">
      <span className="ak-chathead__back">‹</span>
      <b>{DEMO_ALERT.sender}</b>
      <span className="ak-spark">✦</span>
    </div>
  );
}

export function WaveCard({ className = '' }: { className?: string }) {
  return (
    <div className={`ak-wave ${className}`}>
      <span className="ak-wave__icon">◆</span>
      <div className="ak-wave__main">
        <div className="ak-row__top">
          <b>{DEMO_CAMPAIGN.label}</b>
          <Chip tone="danger">Active</Chip>
        </div>
        <p className="ak-wave__meta">
          {VARIANT_COUNT} texts like this · last seen {DEMO_CAMPAIGN.lastSeen}
        </p>
        <p className="ak-row__preview">{ALERT_TEXT}</p>
      </div>
    </div>
  );
}

/* ---------- full screens ---------- */

export function MessagesScreen({ incoming = false }: { incoming?: boolean }) {
  return (
    <div className="ak-screen">
      <p className="ak-title">Messages</p>
      <p className="ak-search">Search</p>
      <Pills />
      <div className="ak-list">
        {incoming && (
          <Row
            className="ak-row--incoming"
            sender={DEMO_ALERT.sender}
            time={DEMO_ALERT.time}
            preview={ALERT_TEXT}
            unread
            chip={
              <span className="ak-row__chip">
                <Chip tone="danger">Likely scam</Chip>
              </span>
            }
          />
        )}
        {INBOX_ROWS.map((r) => (
          <Row key={r.sender} {...r} />
        ))}
      </div>
      <TabBar />
    </div>
  );
}

/** Onboarding step 4 of 5: the default-SMS-app screen (strings.xml
 *  onboarding_default_sms_*). Android's own consent dialog follows it. */
export function SetupScreen() {
  const perms: Array<[string, string, React.ElementType]> = [
    ['Receive and read', 'Receive and read all SMS messages', MessageSquare],
    ['Send messages', 'Send SMS messages on your behalf', Send],
    ['Scan for threats', 'Scan messages for smishing threats', ShieldCheck],
  ];
  return (
    <div className="ak-screen ak-screen--setup">
      <div className="ak-progress" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={n <= 4 ? 'is-done' : undefined} />
        ))}
      </div>
      <p className="ak-step">Step 4 of 5</p>
      <p className="ak-setup__title">Set as your SMS app</p>
      <p className="ak-setup__body">
        BantAI needs to be your default messaging app to read and protect your
        SMS messages from phishing threats.
      </p>
      <div className="ak-list ak-perms">
        {perms.map(([title, detail, Icon]) => (
          <div key={title} className="ak-perm">
            <span className="ak-perm__icon">
              <Icon strokeWidth={2} />
            </span>
            <span>
              <b>{title}</b>
              <small>{detail}</small>
            </span>
          </div>
        ))}
      </div>
      <span className="ak-button">Set as default</span>
    </div>
  );
}

export function ChatScreen({ withSheet = false }: { withSheet?: boolean }) {
  return (
    <div className="ak-screen ak-screen--chat">
      <ChatHeader />
      <p className="ak-daystamp">Today</p>
      <Bubble>{ALERT_TEXT}</Bubble>
      {withSheet && <SummarySheet />}
    </div>
  );
}
