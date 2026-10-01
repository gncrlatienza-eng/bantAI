import React from 'react';
import { TickIcon } from './accessSteps';
import signalsArt from '../../assets/request-access/signals.webp';
import optionsArt from '../../assets/request-access/access-options.webp';
import gateArt from '../../assets/request-access/access-gate.webp';

type PickShield = (options?: { pilot?: boolean }) => void;
function SectionArt({ src, className }: { src: string; className: string }) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      className={`ra-art ${className}`}
      width={1672}
      height={941}
      decoding="async"
    />
  );
}
export function Hero() {
  return (
    <header className="ra-hero">
      <SectionArt src={signalsArt} className="ra-art--hero" />
      <div className="ra-hero__content">
        <p className="ra-eyebrow">Shield subscription</p>
        <h1 className="ra-hero__title">
          Understand Philippine smishing campaigns.
        </h1>
        <p className="ra-hero__lede">
          Shield provides published campaign intelligence for security, fraud,
          and risk teams.
        </p>
        <a href="#shield-access" className="ra-button ra-button--primary">
          Request Shield access
        </a>
        <p className="ra-note">No payment is required to submit a request.</p>
      </div>
    </header>
  );
}
export function ChooseAccess({ onPick }: { onPick: PickShield }) {
  return (
    <section
      id="shield-access"
      className="ra-section ra-choose"
      aria-labelledby="ra-choose-title"
    >
      <SectionArt src={optionsArt} className="ra-art--choose" />
      <h2 id="ra-choose-title" className="ra-section-title">
        Shield access
      </h2>
      <div className="ra-cards">
        <article className="ra-card">
          <h3 className="ra-card__name">Shield Subscription</h3>
          <p className="ra-card__purpose">
            Published campaign intelligence for approved operational use.
          </p>
          <p className="ra-card__price">
            Subscription pricing<span> is confirmed during approval</span>
          </p>
          <ul className="ra-card__list">
            <li>
              <TickIcon />
              Published campaign intelligence
            </li>
            <li>
              <TickIcon />
              Approved indicators and campaign evolution
            </li>
            <li>
              <TickIcon />
              Scoped campaign exports
            </li>
            <li>
              <TickIcon />
              Read-only API access when enabled
            </li>
          </ul>
          <button
            type="button"
            className="ra-button ra-button--primary ra-card__cta"
            onClick={() => onPick()}
          >
            Request Shield access
          </button>
        </article>
        <details className="ra-pilot">
          <summary>
            Interested in founding-pilot consideration?{' '}
            <span className="ra-pilot__more">Learn more</span>
          </summary>
          <p>
            Eligible organizations may be considered for pilot access in
            exchange for implementation feedback.
          </p>
          <button
            type="button"
            className="ra-link-button"
            onClick={() => onPick({ pilot: true })}
          >
            Request with pilot consideration →
          </button>
        </details>
      </div>
    </section>
  );
}
export function WhatYouGet() {
  return (
    <section className="ra-section" aria-labelledby="ra-get-title">
      <h2 id="ra-get-title" className="ra-section-title">
        What Shield includes
      </h2>
      <ul className="ra-trio">
        <li>
          <strong>Campaign intelligence</strong>
          <span>Track published smishing campaigns and changes over time.</span>
        </li>
        <li>
          <strong>Approved indicators</strong>
          <span>Use reviewed domain and infrastructure indicators.</span>
        </li>
        <li>
          <strong>Scoped access</strong>
          <span>
            Export only the campaign intelligence authorized for Shield.
          </span>
        </li>
      </ul>
    </section>
  );
}
export function ControlledAccess() {
  return (
    <section className="ra-section" aria-labelledby="ra-trust-title">
      <h2 id="ra-trust-title" className="ra-section-title">
        Built for controlled access
      </h2>
      <ul className="ra-trio">
        <li>
          <strong>No raw SMS</strong>
          <span>
            Shield does not provide message bodies, sender data, or recipient
            information.
          </span>
        </li>
        <li>
          <strong>Human review</strong>
          <span>
            Every subscription request is reviewed before access is granted.
          </span>
        </li>
        <li>
          <strong>Account-scoped</strong>
          <span>
            Use and API activity are limited to your subscribed account.
          </span>
        </li>
      </ul>
    </section>
  );
}
export function HowAccessWorks() {
  return (
    <section className="ra-section" aria-labelledby="ra-how-title">
      <h2 id="ra-how-title" className="ra-section-title">
        How access works
      </h2>
      <ol className="ra-flow-row">
        {['Request', 'Review', 'Accept terms', 'Access'].map((step, index) => (
          <li key={step}>
            <span className="ra-flow-row__n" aria-hidden>
              {String(index + 1).padStart(2, '0')}
            </span>
            {step}
          </li>
        ))}
      </ol>
      <p className="ra-note">
        Approved applicants accept the terms and complete payment before Shield
        activates.
      </p>
    </section>
  );
}
export function FinalCta({ onPick }: { onPick: PickShield }) {
  return (
    <section className="ra-section ra-final" aria-labelledby="ra-final-title">
      <SectionArt src={gateArt} className="ra-art--final" />
      <div className="ra-final__content">
        <div className="ra-final__head">
          <h2 id="ra-final-title" className="ra-final__title">
            Ready to request Shield access?
          </h2>
          <p className="ra-note">
            Create your account, then submit one Shield subscription request.
          </p>
        </div>
        <div className="ra-final__actions">
          <button
            type="button"
            className="ra-button ra-button--primary"
            onClick={() => onPick()}
          >
            Request Shield access
          </button>
        </div>
      </div>
    </section>
  );
}
