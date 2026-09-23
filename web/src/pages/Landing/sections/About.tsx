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
              An undergraduate Computer Science thesis on on-device SMS
              classification and server-side campaign clustering for Filipino
              users — scoped to Tagalog, English, and Taglish.
            </p>
            <p className="landing__body landing__body--secondary">
              A research prototype, not a commercial product. Raw SMS bodies
              stay on the phone; only the classification result, indicators, and
              URL domains cross the wire.
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
 * ArchitectureDiagram — Swiss/editorial. Three columns for Device / Backend /
 * ML service; the Portal sits underneath and reads from the Backend. Arrows
 * are typed: solid = data flow, dashed = read-only. A distinct plum treatment
 * on the Device column signals what never leaves the phone.
 */
function ArchitectureDiagram() {
  return (
    <svg
      viewBox="0 0 660 420"
      className="about-arch"
      role="img"
      aria-label="Architecture: the Android device holds the raw SMS body and runs the on-device classifier; only the classification result, indicators, and URL domains flow to the NestJS backend; the ML service handles retraining and drift; the portal reads aggregated data from the backend."
    >
      {/* Top row of nodes */}
      <ArchNode
        x={20}
        y={20}
        width={200}
        title="Android device"
        subtitle="Kotlin · on-device"
        rows={[
          'SMS receiver',
          'On-device classifier',
          'Local corrections cache',
        ]}
        variant="stay"
      />

      <ArchNode
        x={240}
        y={20}
        width={180}
        title="Backend"
        subtitle="NestJS · PostgreSQL"
        rows={['Alert records', 'Campaign membership', 'User corrections']}
      />

      <ArchNode
        x={440}
        y={20}
        width={200}
        title="ML service"
        subtitle="Python · offline"
        rows={['Trained model', 'Retraining queue', 'Drift signal']}
      />

      {/* Arrows between top row nodes */}
      <ArchArrow x1={220} x2={240} y={100} />
      <ArchArrow x1={420} x2={440} y={100} />

      {/* Portal (bottom) */}
      <ArchNode
        x={140}
        y={240}
        width={380}
        title="BantAI portal"
        subtitle="React · reviewer surface"
        rows={[
          'Aggregated alerts and campaigns',
          'Admin corrections and model promotion',
        ]}
      />

      {/* Portal reads from Backend — dashed arrow */}
      <ArchArrow x1={330} x2={330} y1={220} y2={240} vertical dashed />

      {/* Stays-on-device pill callout on the device column */}
      <g transform="translate(20, 200)">
        <rect
          x="0"
          y="0"
          width="200"
          height="26"
          rx="4"
          fill="var(--plum-14)"
          stroke="var(--plum-35)"
        />
        <text
          x="10"
          y="12"
          fontSize="7.5"
          fill="var(--brand-primary)"
          letterSpacing="0.14em"
          fontFamily="var(--font-mono, monospace)"
          fontWeight="700"
        >
          STAYS ON DEVICE
        </text>
        <text x="10" y="22" fontSize="9" fill="var(--brand-primary)">
          Raw SMS body and sender
        </text>
      </g>

      {/* What crosses the boundary */}
      <g transform="translate(240, 200)">
        <text
          x="0"
          y="10"
          fontSize="7.5"
          fill="var(--text-secondary)"
          letterSpacing="0.14em"
          fontFamily="var(--font-mono, monospace)"
        >
          CROSSES THE WIRE
        </text>
        <text x="0" y="24" fontSize="9" fill="var(--text-primary)">
          class · indicators · domain
        </text>
      </g>

      {/* Arrow labels */}
      <text
        x="230"
        y="94"
        fontSize="8"
        fill="var(--text-secondary)"
        fontFamily="var(--font-mono, monospace)"
      >
        POST
      </text>
      <text
        x="428"
        y="94"
        fontSize="8"
        fill="var(--text-secondary)"
        fontFamily="var(--font-mono, monospace)"
      >
        train
      </text>
      <text
        x="336"
        y="235"
        fontSize="8"
        fill="var(--text-secondary)"
        fontFamily="var(--font-mono, monospace)"
      >
        read
      </text>

      {/* Bottom rule */}
      <line
        x1="20"
        y1="400"
        x2="640"
        y2="400"
        stroke="var(--border-default)"
        strokeDasharray="2 6"
      />
      <text
        x="20"
        y="416"
        fontSize="8"
        fill="var(--text-secondary)"
        fontFamily="var(--font-mono, monospace)"
        letterSpacing="0.14em"
      >
        THIS SITE IS THE PORTAL
      </text>
    </svg>
  );
}

interface ArchNodeProps {
  x: number;
  y: number;
  width: number;
  title: string;
  subtitle: string;
  rows: string[];
  variant?: 'default' | 'stay';
}

function ArchNode({
  x,
  y,
  width,
  title,
  subtitle,
  rows,
  variant = 'default',
}: ArchNodeProps) {
  const fill = variant === 'stay' ? 'var(--plum-08)' : 'var(--surface-raised)';
  const stroke =
    variant === 'stay' ? 'var(--plum-35)' : 'var(--border-default)';
  const height = 160;
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        x="0"
        y="0"
        width={width}
        height={height}
        rx="8"
        fill={fill}
        stroke={stroke}
      />
      <text
        x="16"
        y="26"
        fontSize="9"
        letterSpacing="0.14em"
        fill="var(--text-secondary)"
        fontFamily="var(--font-mono, monospace)"
      >
        {title.toUpperCase()}
      </text>
      <text x="16" y="42" fontSize="10" fill="var(--text-secondary)">
        {subtitle}
      </text>
      <line
        x1="16"
        y1="54"
        x2={width - 16}
        y2="54"
        stroke={variant === 'stay' ? 'var(--plum-35)' : 'var(--border-default)'}
      />
      {rows.map((r, i) => (
        <g key={r} transform={`translate(16, ${76 + i * 22})`}>
          <rect
            x="0"
            y="-6"
            width="3"
            height="3"
            fill={
              variant === 'stay'
                ? 'var(--brand-primary)'
                : 'var(--text-primary)'
            }
          />
          <text x="10" y="0" fontSize="11" fill="var(--text-primary)">
            {r}
          </text>
        </g>
      ))}
    </g>
  );
}

interface ArchArrowProps {
  x1: number;
  x2: number;
  y?: number;
  y1?: number;
  y2?: number;
  vertical?: boolean;
  dashed?: boolean;
}

function ArchArrow({
  x1,
  x2,
  y,
  y1,
  y2,
  vertical = false,
  dashed = false,
}: ArchArrowProps) {
  const strokeProps = {
    stroke: 'var(--brand-primary)',
    strokeWidth: 1.2,
    strokeDasharray: dashed ? '4 4' : undefined,
  } as const;

  if (vertical) {
    const sy = y1 ?? 0;
    const ey = y2 ?? 0;
    return (
      <g>
        <line x1={x1} y1={sy} x2={x2} y2={ey - 6} {...strokeProps} />
        <polygon
          points={`${x2 - 5},${ey - 6} ${x2 + 5},${ey - 6} ${x2},${ey}`}
          fill="var(--brand-primary)"
        />
      </g>
    );
  }
  const yy = y ?? 100;
  return (
    <g>
      <line x1={x1} y1={yy} x2={x2 - 6} y2={yy} {...strokeProps} />
      <polygon
        points={`${x2 - 6},${yy - 5} ${x2 - 6},${yy + 5} ${x2},${yy}`}
        fill="var(--brand-primary)"
      />
    </g>
  );
}

export default About;
