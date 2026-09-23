/*
 * Threat Context section.
 *
 * A short prose block on the left explains why keyword rules fail. On the
 * right, three stacked SMS variants (Day 01 / 04 / 09) show wording and domain
 * changing while shared campaign signals remain recognizable. A faint plum
 * curve joins them.
 */

import React from 'react';
import { useReveal } from '../useReveal';
import './threat-context.css';

interface Variant {
  day: string;
  body: React.ReactNode;
  domain: string;
}

const VARIANTS: Variant[] = [
  {
    day: 'Day 01',
    body: (
      <>
        Your <mark>GCash</mark> account will be <mark>suspended</mark>.<br />
        Verify: <span className="tc-domain">gcash-secure.link</span>
      </>
    ),
    domain: 'gcash-secure.link',
  },
  {
    day: 'Day 04',
    body: (
      <>
        <mark>GCash</mark> notice: account <mark>restricted</mark>.<br />
        Confirm now: <span className="tc-domain">gcash-update.link</span>
      </>
    ),
    domain: 'gcash-update.link',
  },
  {
    day: 'Day 09',
    body: (
      <>
        G-Cash <mark>security alert</mark>!<br />
        Restore access: <span className="tc-domain">gcash-help.link</span>
      </>
    ),
    domain: 'gcash-help.link',
  },
];

export function ThreatContext() {
  const rootRef = useReveal<HTMLElement>();
  return (
    <section
      ref={rootRef}
      className="landing__section landing__section--warm tc"
    >
      <div className="landing__section-inner">
        <div className="landing__grid landing__grid--split">
          <div data-reveal>
            <p className="landing__eyebrow">Why this is hard</p>
            <h2 className="landing__h2">
              Smishing changes faster than keyword rules.
            </h2>
            <p className="landing__body">
              A rule tuned to one wording misses the next; a rule tuned to a
              domain misses tomorrow&apos;s. BantAI groups variants by semantic
              similarity and URL overlap so the campaign stays traceable across
              drift.
            </p>
          </div>

          <div className="tc__cards">
            <svg
              className="tc__curve"
              viewBox="0 0 40 360"
              preserveAspectRatio="none"
              aria-hidden
            >
              <path
                d="M20 30 C 8 90, 32 180, 20 240 S 32 330, 20 340"
                fill="none"
                stroke="var(--plum-60)"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <circle cx="20" cy="30" r="4" fill="var(--brand-primary)" />
              <circle cx="20" cy="180" r="4" fill="var(--brand-primary)" />
              <circle cx="20" cy="340" r="4" fill="var(--brand-primary)" />
            </svg>

            <ol className="tc__list">
              {VARIANTS.map((v, i) => (
                <li
                  key={v.day}
                  className="tc__card"
                  data-reveal
                  data-reveal-delay={String(i + 1)}
                >
                  <span className="tc__day">{v.day}</span>
                  <p className="tc__body">{v.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ThreatContext;
