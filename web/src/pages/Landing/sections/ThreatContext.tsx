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
import { DEMO_VARIANTS } from '../landingFixture';
import { highlight } from '../highlight';
import './threat-context.css';

// Day 01 / 04 / 09: the first three variants show wording + domain drift.
const DRIFT = DEMO_VARIANTS.slice(0, 3);

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
              {DRIFT.map((v, i) => (
                <li
                  key={v.id}
                  className="tc__card"
                  data-reveal
                  data-reveal-delay={String(i + 1)}
                >
                  <span className="tc__day">
                    Day {String(v.day).padStart(2, '0')}
                  </span>
                  <p className="tc__body">
                    {highlight(v.lead, v.marks)}
                    <br />
                    {v.cta}: <span className="tc-domain">{v.domain}</span>
                  </p>
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
