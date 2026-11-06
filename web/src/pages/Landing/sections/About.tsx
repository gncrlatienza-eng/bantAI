/*
 * About — about the application and thesis system, not the developers.
 *
 * Left: two short paragraphs about scope, philosophy, and what BantAI is not.
 * Right: a labeled architecture diagram — Device → Backend → ML service, with
 * the Portal drawn as a separate consumer that only reads aggregated data. A
 * small legend distinguishes data flow from control flow; a stays-on-device
 * pill anchors the privacy claim to the actual boundary.
 */

import React from 'react';
import { useReveal } from '../useReveal';
import './about.css';

export function About() {
  const rootRef = useReveal<HTMLElement>();
  return (
    <section
      ref={rootRef}
      className="landing__section landing__section--warm about"
      id="about"
      aria-labelledby="about-heading"
    >
      <div className="landing__section-inner">
        <div className="landing__grid landing__grid--about">
          <div className="about__copy" data-reveal>
            <p className="landing__eyebrow">About BantAI</p>
            <h2 id="about-heading" className="landing__h2">
              Built in the Philippines, for Philippine smishing.
            </h2>
            <p className="landing__body">
              An undergraduate Computer Science thesis on Android SMS triage,
              Model C classification through the BantAI service, and server-side
              campaign clustering for Filipino users — scoped to Tagalog,
              English, and Taglish.
            </p>
            <p className="landing__body landing__body--secondary">
              A research prototype, not a commercial product. The app masks SMS
              content before an authenticated service request; Model C runs on
              the device as an offline fallback. The original message remains in
              the device SMS inbox.
            </p>
          </div>

          <div
            className="about__architecture"
            aria-hidden
            data-reveal
            data-reveal-delay="1"
          >
            <ArchitectureDiagram />
            <ul className="about__legend" aria-hidden>
              <li>
                <span className="about__legend-swatch about__legend-swatch--stay" />
                Stays on device
              </li>
              <li>
                <span className="about__legend-swatch about__legend-swatch--flow" />
                Data flow
              </li>
              <li>
                <span className="about__legend-swatch about__legend-swatch--read" />
                Read only
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/*
 * ArchitectureDiagram — plain HTML so every label stays readable at any width
 * (the earlier SVG scaled its text down to 4–9px). Device → Backend → ML
 * service across the top; the Portal underneath only reads from the Backend.
 * The device node is tinted to anchor what stays on the phone.
 */
function ArchitectureDiagram() {
  return (
    <figure
      className="arch"
      aria-label="Architecture: the Android device receives the SMS and masks its content before an authenticated backend classification request. The backend uses Model C through the ML service, while the device can use Model C as an offline fallback. The portal reads aggregated data from the backend."
    >
      <div className="arch__row">
        <ArchNode
          variant="stay"
          title="Android device"
          subtitle="Kotlin · local SMS handling"
          rows={[
            'SMS receiver',
            'Local privacy masking',
            'Model C offline fallback',
            'Local corrections cache',
          ]}
        />
        <ArchLink label="masked text" />
        <ArchNode
          title="Backend"
          subtitle="NestJS · PostgreSQL"
          rows={['Alert records', 'Campaign membership', 'User corrections']}
        />
        <ArchLink label="classify · train" />
        <ArchNode
          title="ML service"
          subtitle="Python · Model C service"
          rows={['Model C classification', 'Retraining queue', 'Drift signal']}
        />
      </div>

      <div className="arch__wire">
        <p className="arch__pill arch__pill--stay">
          <span className="arch__key">Stays on device</span>
          Original SMS inbox
        </p>
        <p className="arch__pill">
          <span className="arch__key">Crosses the wire</span>
          Masked SMS text · pseudonymized sender · telemetry
        </p>
      </div>

      <ArchLink label="read" direction="down" dashed />

      <ArchNode
        variant="portal"
        title="BantAI portal"
        subtitle="React · reviewer surface"
        rows={[
          'Aggregated alerts and campaigns',
          'Admin corrections and model promotion',
        ]}
        note="This site is the portal"
      />
    </figure>
  );
}

interface ArchNodeProps {
  title: string;
  subtitle: string;
  rows: string[];
  variant?: 'default' | 'stay' | 'portal';
  note?: string;
}

function ArchNode({
  title,
  subtitle,
  rows,
  variant = 'default',
  note,
}: ArchNodeProps) {
  return (
    <div className={`arch__node arch__node--${variant}`}>
      <p className="arch__title">{title}</p>
      <p className="arch__sub">{subtitle}</p>
      <ul className="arch__rows">
        {rows.map((row) => (
          <li key={row}>{row}</li>
        ))}
      </ul>
      {note && <p className="arch__note">{note}</p>}
    </div>
  );
}

function ArchLink({
  label,
  direction = 'right',
  dashed = false,
}: {
  label: string;
  direction?: 'right' | 'down';
  dashed?: boolean;
}) {
  return (
    <div
      className={`arch__link arch__link--${direction}${dashed ? ' arch__link--dashed' : ''}`}
      aria-hidden
    >
      <span>{label}</span>
    </div>
  );
}

export default About;
