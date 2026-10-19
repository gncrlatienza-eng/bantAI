/*
 * PhoneMock — HTML replicas of four real BantAI Android screens, filled from
 * the landing demo fixture. Layout, wording and the light palette follow the
 * Compose sources (SmishingAlertScreen, MessagesScreen, ThreatAnalysisScreen,
 * TakeActionScreen; ui/theme/Color.kt LightColors). Real DOM text keeps every
 * label readable at any width, unlike the scaled-down SVG phones it replaces.
 *
 * It is a picture of the app, not the app: one accessible description on the
 * frame, the mock UI itself aria-hidden, and nothing focusable.
 */
import React from 'react';
import { BatteryFull, Signal, Wifi } from 'lucide-react';
import {
  APP,
  DEMO_ALERT,
  DEMO_CONFIDENCE,
  INDICATORS,
  MASKED_NUMBER,
  fullText,
} from '../landingFixture';
import './PhoneMock.css';

export type PhoneScreen = 'inbox' | 'alert' | 'analysis' | 'action';

const confidencePct = `${Math.round(DEMO_CONFIDENCE * 100)}%`;
const alertText = fullText(DEMO_ALERT.variant);

const LABELS: Record<PhoneScreen, string> = {
  inbox: `BantAI Android app, Messages: a new SMS from ${DEMO_ALERT.sender} is marked ${APP.inbox.scamBadge}.`,
  alert: `BantAI Android app, alert screen: the message from ${DEMO_ALERT.sender} is marked ${APP.alert.verdict}, with why it was flagged and options to report it or block the sender.`,
  analysis: `BantAI Android app, Threat Analysis: ${confidencePct} confidence and the threat indicators found in the message.`,
  action: `BantAI Android app, Choose an action: report the message as smishing, spam or legitimate, or block the sender.`,
};

interface PhoneMockProps {
  screen: PhoneScreen;
  className?: string;
}

export function PhoneMock({ screen, className = '' }: PhoneMockProps) {
  return (
    <figure
      className={`pm ${className}`}
      role="img"
      aria-label={LABELS[screen]}
    >
      <div className="pm__screen" aria-hidden="true">
        <div className="pm__status">
          <span>9:41</span>
          <span className="pm__status-icons">
            <Signal strokeWidth={2.4} />
            <Wifi strokeWidth={2.4} />
            <BatteryFull strokeWidth={2.2} />
          </span>
        </div>
        {screen === 'inbox' && <InboxScreen />}
        {screen === 'alert' && <AlertScreen />}
        {screen === 'analysis' && <AnalysisScreen />}
        {screen === 'action' && <ActionScreen />}
        <div className="pm__home" />
      </div>
    </figure>
  );
}

function Back() {
  return <p className="pm__back">‹ {APP.alert.back}</p>;
}

function InboxScreen() {
  const rows = [
    {
      sender: DEMO_ALERT.sender,
      time: DEMO_ALERT.time,
      preview: alertText,
      badge: { text: APP.inbox.scamBadge, tone: 'danger' },
      unread: true,
    },
    {
      sender: 'GCash',
      time: '9:12 AM',
      preview:
        'You have received PHP 500.00 via InstaPay. Thank you for using GCash.',
    },
    {
      sender: MASKED_NUMBER,
      time: 'Yesterday',
      preview: 'Sige, kita tayo mamaya. Ingat!',
    },
    {
      sender: 'PROMO',
      time: 'Mon',
      preview: 'Get 30GB for 7 days! Reply YES to subscribe.',
      badge: { text: 'Spam', tone: 'warn' },
    },
  ];
  return (
    <div className="pm__body">
      <p className="pm__title">{APP.inbox.title}</p>
      <p className="pm__search">{APP.inbox.search}</p>
      <ul className="pm__list">
        {rows.map((row) => (
          <li key={row.sender} className="pm__row">
            <span className="pm__avatar">
              {row.sender.replace(/[^A-Z]/gi, '').charAt(0) || '#'}
            </span>
            <span className="pm__row-main">
              <span className="pm__row-top">
                <b className={row.unread ? 'is-unread' : undefined}>
                  {row.sender}
                </b>
                <span className="pm__muted">{row.time}</span>
              </span>
              <span className="pm__row-preview">{row.preview}</span>
              {row.badge && (
                <span className={`pm__badge pm__badge--${row.badge.tone}`}>
                  {row.badge.text}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AlertScreen() {
  return (
    <div className="pm__body">
      <Back />
      <div className="pm__alert-head">
        <span className="pm__avatar pm__avatar--lg">G</span>
        <p className="pm__sender">{DEMO_ALERT.sender}</p>
        <p className="pm__muted">Today, {DEMO_ALERT.time}</p>
        <span className="pm__badge pm__badge--danger">{APP.alert.verdict}</span>
      </div>
      <p className="pm__bubble">{alertText}</p>
      <div className="pm__card">
        <p className="pm__card-title">{APP.alert.whyFlagged}</p>
        {INDICATORS.slice(0, 1).map((i) => (
          <div key={i.tag} className="pm__reason">
            <b>{i.tag}</b>
            <span className="pm__muted">{i.why}</span>
          </div>
        ))}
      </div>
      <div className="pm__card pm__card--wave">
        <b>{APP.alert.wave}</b>
        <span className="pm__muted">{APP.alert.waveDetail}</span>
      </div>
      <span className="pm__btn pm__btn--primary">{APP.alert.report}</span>
      <span className="pm__btn">{APP.alert.block}</span>
    </div>
  );
}

function AnalysisScreen() {
  return (
    <div className="pm__body">
      <Back />
      <p className="pm__title">{APP.analysis.title}</p>
      <div className="pm__card">
        <span className="pm__row-top">
          <span className="pm__muted">{APP.analysis.confidence}</span>
          <b className="pm__danger">{confidencePct}</b>
        </span>
        <span className="pm__meter">
          <span style={{ width: confidencePct }} />
        </span>
      </div>
      <p className="pm__label">{APP.analysis.message}</p>
      <p className="pm__bubble">{alertText}</p>
      <p className="pm__label">{APP.analysis.indicators}</p>
      <ul className="pm__card pm__tags">
        {INDICATORS.map((i) => (
          <li key={i.tag}>{i.tag}</li>
        ))}
      </ul>
    </div>
  );
}

function ActionScreen() {
  return (
    <div className="pm__body">
      <Back />
      <p className="pm__title">{APP.action.title}</p>
      <div className="pm__card pm__choice is-selected">
        <b>{APP.action.report}</b>
      </div>
      <div className="pm__card pm__choice">
        <b>{APP.action.block}</b>
        <span className="pm__muted">Stop messages from this number</span>
      </div>
      <p className="pm__label">{APP.action.question}</p>
      <ul className="pm__card pm__options">
        {APP.action.options.map((option, i) => (
          <li key={option} className={i === 0 ? 'is-selected' : undefined}>
            <span className="pm__radio" />
            {option}
          </li>
        ))}
      </ul>
      <span className="pm__btn pm__btn--primary">{APP.action.report}</span>
    </div>
  );
}
