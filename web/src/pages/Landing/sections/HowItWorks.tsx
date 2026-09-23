/*
 * How It Works — Detect → Classify → Explain → Connect.
 *
 * Layout: two-column on desktop. Left column is a stack of four step blocks
 * that the visitor scrolls through at their own pace. Right column is a
 * `position: sticky` visual pane whose contents crossfade to match the step
 * closest to the viewport centre (IntersectionObserver, no scrolljacking).
 *
 * Mobile / reduced motion: the sticky behavior falls off; each step's visual
 * renders inline directly below its copy.
 */

import React from 'react';
import { useReveal } from '../useReveal';
import './how-it-works.css';

interface Step {
  id: string;
  number: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    id: 'detect',
    number: '01',
    title: 'Detect',
    body: 'The Android app captures the SMS locally. The raw body never leaves the phone.',
  },
  {
    id: 'classify',
    number: '02',
    title: 'Classify',
    body: 'A trained model labels the message Ham, Spam, or Smishing with a confidence score.',
  },
  {
    id: 'explain',
    number: '03',
    title: 'Explain',
    body: 'Named indicators — urgency, look-alike URL, brand, account threat — justify every alert.',
  },
  {
    id: 'connect',
    number: '04',
    title: 'Connect',
    body: 'The backend groups related variants into a single tracked campaign.',
  },
];

export function HowItWorks() {
  const [activeIdx, setActiveIdx] = React.useState(0);
  const stepRefs = React.useRef<Array<HTMLLIElement | null>>([]);
  const rootRef = useReveal<HTMLElement>();

  React.useEffect(() => {
    /*
     * On any intersection change we recompute across ALL step refs, not
     * only the entries in the callback. Observer entries only include
     * targets whose state changed, so a fast scroll that lands two new
     * steps in the viewport at once would otherwise miss the second.
     * The picker chooses the step whose top is closest to the viewport
     * centre — good enough for a linear pipeline, no scroll-jank.
     */
    const pickActive = () => {
      const centre = window.innerHeight / 2;
      let bestIdx = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      stepRefs.current.forEach((el, i) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        const dist = Math.abs(mid - centre);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      });
      setActiveIdx(bestIdx);
    };

    const observer = new IntersectionObserver(() => pickActive(), {
      rootMargin: '-30% 0px -30% 0px',
      threshold: [0, 0.25, 0.5, 0.75, 1],
    });

    stepRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });
    // Initial pick so the pane matches the section's entry position.
    pickActive();
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={rootRef}
      className="landing__section hiw"
      id="how-it-works"
      aria-labelledby="hiw-heading"
    >
      <div className="landing__section-inner">
        <div className="hiw__intro" data-reveal>
          <p className="landing__eyebrow">How it works</p>
          <h2 id="hiw-heading" className="landing__h2">
            From an incoming SMS to campaign intelligence.
          </h2>
          <p className="landing__lede">
            Every stage is observable and correctable.
          </p>
        </div>

        <div className="hiw__scroller">
          <ol className="hiw__steps" aria-label="Pipeline stages">
            {STEPS.map((step, i) => {
              const isActive = i === activeIdx;
              return (
                <li
                  key={step.id}
                  ref={(el) => {
                    stepRefs.current[i] = el;
                  }}
                  data-step-index={i}
                  className={`hiw__step${isActive ? ' is-active' : ''}`}
                >
                  <div className="hiw__step-rail" aria-hidden />
                  <div className="hiw__step-head">
                    <span className="hiw__step-number">{step.number}</span>
                    <h3 className="hiw__step-title">{step.title}</h3>
                  </div>
                  <p className="hiw__step-body">{step.body}</p>
                  {/*
                   * Mobile-only inline visual, hidden on desktop where the
                   * sticky pane takes over.
                   */}
                  <div className="hiw__step-viz" aria-hidden>
                    <HiwStageVisual activeIdx={i} />
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="hiw__viz" aria-hidden>
            <div className="hiw__viz-inner">
              <div className="hiw__viz-caption">
                <span className="hiw__viz-caption-dot" />
                {STEPS[activeIdx]?.title ?? 'Detect'} — stage {activeIdx + 1} of{' '}
                {STEPS.length}
              </div>
              {STEPS.map((step, i) => (
                <div
                  key={step.id}
                  className={`hiw__viz-slide${
                    i === activeIdx ? ' is-active' : ''
                  }`}
                >
                  <HiwStageVisual activeIdx={i} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/*
 * HiwStageVisual: one small, editorial infographic per stage. Same 460×360
 * viewBox so the sticky pane doesn't jump when the visual crossfades.
 *
 *   0 Detect   — a phone frame receives one incoming SMS row
 *   1 Classify — the model returns a verdict chip with a confidence bar
 *   2 Explain  — the SMS is annotated with reason labels connected by lines
 *   3 Connect  — a small cluster graph with three variant nodes
 */
function HiwStageVisual({ activeIdx }: { activeIdx: number }) {
  switch (activeIdx) {
    case 0:
      return <StageDetect />;
    case 1:
      return <StageClassify />;
    case 2:
      return <StageExplain />;
    case 3:
      return <StageConnect />;
    default:
      return <StageDetect />;
  }
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  // Material-3-flavored phone chrome: rounded corners, thin outline, hole
  // punch camera, gesture pill, believable status glyphs. Screen inner region
  // is x=170..290, y=48..332.
  return (
    <g>
      <rect
        x="158"
        y="34"
        width="144"
        height="298"
        rx="26"
        fill="var(--surface-raised)"
        stroke="var(--text-primary)"
        strokeWidth="1.4"
      />
      <rect
        x="168"
        y="46"
        width="124"
        height="274"
        rx="16"
        fill="var(--surface-canvas)"
      />
      {/* Hole-punch camera */}
      <circle cx="230" cy="52" r="2.2" fill="var(--text-primary)" />
      {/* Status bar */}
      <text
        x="174"
        y="65"
        fontSize="7"
        fill="var(--text-primary)"
        fontFamily="var(--font-sans)"
        fontWeight="700"
      >
        9:41
      </text>
      <g fill="var(--text-primary)">
        {/* Signal staircase */}
        <rect x="256" y="63" width="1.4" height="2" rx="0.3" />
        <rect x="258.2" y="62" width="1.4" height="3" rx="0.3" />
        <rect x="260.4" y="61" width="1.4" height="4" rx="0.3" />
        <rect x="262.6" y="60" width="1.4" height="5" rx="0.3" />
        {/* Wifi arcs */}
        <path
          d="M 268 64 A 3 3 0 0 1 274 64"
          fill="none"
          stroke="var(--text-primary)"
          strokeWidth="0.9"
          strokeLinecap="round"
        />
        <path
          d="M 269.2 63.4 A 1.8 1.8 0 0 1 272.8 63.4"
          fill="none"
          stroke="var(--text-primary)"
          strokeWidth="0.9"
          strokeLinecap="round"
        />
        <circle cx="271" cy="64.2" r="0.6" />
        {/* Battery */}
        <rect
          x="278"
          y="60.5"
          width="10"
          height="4.5"
          rx="1"
          fill="none"
          stroke="var(--text-primary)"
          strokeWidth="0.7"
        />
        <rect x="288" y="61.8" width="1" height="2" rx="0.3" />
        <rect x="279" y="61.5" width="7.5" height="2.5" rx="0.4" />
      </g>
      {/* Gesture nav pill */}
      <rect
        x="210"
        y="316"
        width="40"
        height="3"
        rx="1.5"
        fill="var(--text-primary)"
        opacity="0.55"
      />
      {children}
    </g>
  );
}

function StageDetect() {
  return (
    <svg viewBox="0 0 460 360" className="hiw-viz-svg" role="img" aria-label="">
      <PhoneFrame>
        {/* Messages header */}
        <text
          x="176"
          y="86"
          fontSize="9"
          fontFamily="var(--font-mono, monospace)"
          fill="var(--text-secondary)"
          letterSpacing="0.1em"
        >
          MESSAGES
        </text>
        <line
          x1="176"
          y1="94"
          x2="284"
          y2="94"
          stroke="var(--border-default)"
        />

        {/* Contact row */}
        <circle cx="184" cy="112" r="10" fill="var(--plum-14)" />
        <text
          x="184"
          y="115"
          fontSize="8"
          fill="var(--brand-primary)"
          textAnchor="middle"
          fontWeight="700"
          fontFamily="var(--font-mono, monospace)"
        >
          B
        </text>
        <text
          x="200"
          y="110"
          fontSize="10"
          fill="var(--text-primary)"
          fontWeight="600"
        >
          BDO-INFO
        </text>
        <text x="200" y="122" fontSize="8" fill="var(--text-secondary)">
          Your BDO account will be suspended…
        </text>
        <text
          x="284"
          y="110"
          fontSize="7"
          fill="var(--text-secondary)"
          textAnchor="end"
        >
          9:38
        </text>

        {/* Unread indicator */}
        <circle cx="278" cy="118" r="3" fill="var(--brand-primary)" />

        {/* Ambient rows */}
        <g opacity="0.35">
          <line
            x1="176"
            y1="140"
            x2="284"
            y2="140"
            stroke="var(--border-default)"
          />
          <text x="200" y="156" fontSize="8" fill="var(--text-secondary)">
            GCash 9:12 AM
          </text>
          <line
            x1="176"
            y1="170"
            x2="284"
            y2="170"
            stroke="var(--border-default)"
          />
          <text x="200" y="186" fontSize="8" fill="var(--text-secondary)">
            +63 917 555 0132
          </text>
        </g>

        {/* Detect banner */}
        <rect
          x="176"
          y="240"
          width="108"
          height="42"
          rx="6"
          fill="var(--plum-14)"
          stroke="var(--plum-35)"
        />
        <text
          x="184"
          y="256"
          fontSize="7"
          fill="var(--brand-primary)"
          fontFamily="var(--font-mono, monospace)"
          letterSpacing="0.14em"
          fontWeight="700"
        >
          DETECTED
        </text>
        <text x="184" y="270" fontSize="9" fill="var(--text-primary)">
          1 new suspicious SMS
        </text>
      </PhoneFrame>

      {/* Side annotation */}
      <g>
        <line
          x1="60"
          y1="120"
          x2="152"
          y2="180"
          stroke="var(--plum-35)"
          strokeWidth="1"
        />
        <text
          x="20"
          y="112"
          fontSize="9"
          fill="var(--text-secondary)"
          letterSpacing="0.12em"
          fontFamily="var(--font-mono, monospace)"
        >
          01 · INTAKE
        </text>
        <text
          x="20"
          y="128"
          fontSize="10"
          fill="var(--text-primary)"
          fontWeight="600"
        >
          Local capture
        </text>
        <text x="20" y="142" fontSize="9" fill="var(--text-secondary)">
          On the phone only.
        </text>
      </g>
    </svg>
  );
}

function StageClassify() {
  return (
    <svg viewBox="0 0 460 360" className="hiw-viz-svg" role="img" aria-label="">
      <PhoneFrame>
        {/* Header */}
        <text
          x="176"
          y="86"
          fontSize="9"
          fontFamily="var(--font-mono, monospace)"
          fill="var(--text-secondary)"
          letterSpacing="0.1em"
        >
          BANTAI · VERDICT
        </text>
        <line
          x1="176"
          y1="94"
          x2="284"
          y2="94"
          stroke="var(--border-default)"
        />

        {/* SMS quote */}
        <rect
          x="176"
          y="104"
          width="108"
          height="60"
          rx="6"
          fill="var(--surface-raised)"
          stroke="var(--border-default)"
        />
        <text
          x="184"
          y="120"
          fontSize="7"
          fill="var(--text-secondary)"
          fontFamily="var(--font-mono, monospace)"
        >
          BDO-INFO · 9:38
        </text>
        <text x="184" y="134" fontSize="8" fill="var(--text-primary)">
          Your BDO account will be
        </text>
        <text x="184" y="146" fontSize="8" fill="var(--text-primary)">
          suspended in 24 hours.
        </text>
        <text
          x="184"
          y="158"
          fontSize="8"
          fill="var(--brand-primary)"
          fontFamily="var(--font-mono, monospace)"
        >
          bdo-secure.link
        </text>

        {/* Verdict card */}
        <rect
          x="176"
          y="176"
          width="108"
          height="52"
          rx="6"
          fill="var(--surface-raised)"
          stroke="var(--border-default)"
        />
        <rect
          x="176"
          y="176"
          width="3"
          height="52"
          fill="var(--status-threat)"
        />
        <text
          x="186"
          y="192"
          fontSize="6.5"
          fill="var(--text-secondary)"
          letterSpacing="0.14em"
          fontFamily="var(--font-mono, monospace)"
        >
          CLASS
        </text>
        <text
          x="186"
          y="205"
          fontSize="10"
          fill="var(--text-primary)"
          fontWeight="700"
        >
          Smishing
        </text>
        <text x="186" y="220" fontSize="8" fill="var(--text-secondary)">
          Ham · Spam · Scam
        </text>

        {/* Confidence bar */}
        <text
          x="176"
          y="248"
          fontSize="7"
          fill="var(--text-secondary)"
          letterSpacing="0.14em"
          fontFamily="var(--font-mono, monospace)"
        >
          CONFIDENCE
        </text>
        <rect
          x="176"
          y="254"
          width="108"
          height="4"
          rx="2"
          fill="var(--plum-14)"
        />
        <rect
          x="176"
          y="254"
          width="102"
          height="4"
          rx="2"
          fill="var(--brand-primary)"
        />
        <text
          x="284"
          y="272"
          fontSize="9"
          fill="var(--brand-primary)"
          fontWeight="700"
          textAnchor="end"
          fontFamily="var(--font-mono, monospace)"
        >
          0.94
        </text>
      </PhoneFrame>

      {/* Side annotation */}
      <g>
        <line
          x1="60"
          y1="180"
          x2="152"
          y2="210"
          stroke="var(--plum-35)"
          strokeWidth="1"
        />
        <text
          x="20"
          y="172"
          fontSize="9"
          fill="var(--text-secondary)"
          letterSpacing="0.12em"
          fontFamily="var(--font-mono, monospace)"
        >
          02 · MODEL
        </text>
        <text
          x="20"
          y="188"
          fontSize="10"
          fill="var(--text-primary)"
          fontWeight="600"
        >
          Ham / Spam / Scam
        </text>
        <text x="20" y="202" fontSize="9" fill="var(--text-secondary)">
          Multiclass with score.
        </text>
      </g>
    </svg>
  );
}

function StageExplain() {
  return (
    <svg viewBox="0 0 460 360" className="hiw-viz-svg" role="img" aria-label="">
      <PhoneFrame>
        <text
          x="176"
          y="86"
          fontSize="9"
          fontFamily="var(--font-mono, monospace)"
          fill="var(--text-secondary)"
          letterSpacing="0.1em"
        >
          WHY THIS DECISION
        </text>
        <line
          x1="176"
          y1="94"
          x2="284"
          y2="94"
          stroke="var(--border-default)"
        />

        {/* Annotated message */}
        <text x="176" y="112" fontSize="8" fill="var(--text-primary)">
          <tspan>Your BDO account </tspan>
        </text>
        <text x="176" y="124" fontSize="8" fill="var(--text-primary)">
          <tspan fill="var(--brand-primary)" fontWeight="700">
            suspended in 24 hours
          </tspan>
        </text>
        <text x="176" y="136" fontSize="8" fill="var(--text-primary)">
          Verify at{' '}
          <tspan
            fill="var(--brand-primary)"
            fontFamily="var(--font-mono, monospace)"
          >
            bdo-secure.link
          </tspan>
        </text>

        {/* Indicator list */}
        <line
          x1="176"
          y1="152"
          x2="284"
          y2="152"
          stroke="var(--border-default)"
        />
        {[
          ['Urgency', '0.42'],
          ['Look-alike URL', '0.31'],
          ['Brand impersonation', '0.18'],
          ['Account threat', '0.09'],
        ].map(([label, weight], i) => (
          <g key={label} transform={`translate(0, ${i * 22})`}>
            <circle cx="180" cy={168} r="2" fill="var(--brand-primary)" />
            <text x="188" y="171" fontSize="8" fill="var(--text-primary)">
              {label}
            </text>
            <text
              x="284"
              y="171"
              fontSize="8"
              fill="var(--text-secondary)"
              textAnchor="end"
              fontFamily="var(--font-mono, monospace)"
            >
              w {weight}
            </text>
          </g>
        ))}
      </PhoneFrame>

      {/* Side annotation */}
      <g>
        <line
          x1="60"
          y1="140"
          x2="152"
          y2="150"
          stroke="var(--plum-35)"
          strokeWidth="1"
        />
        <text
          x="20"
          y="132"
          fontSize="9"
          fill="var(--text-secondary)"
          letterSpacing="0.12em"
          fontFamily="var(--font-mono, monospace)"
        >
          03 · EVIDENCE
        </text>
        <text
          x="20"
          y="148"
          fontSize="10"
          fill="var(--text-primary)"
          fontWeight="600"
        >
          Named indicators
        </text>
        <text x="20" y="162" fontSize="9" fill="var(--text-secondary)">
          Each with a weight.
        </text>
      </g>
    </svg>
  );
}

function StageConnect() {
  return (
    <svg viewBox="0 0 460 360" className="hiw-viz-svg" role="img" aria-label="">
      {/* Frame */}
      <rect
        x="24"
        y="24"
        width="412"
        height="312"
        rx="10"
        fill="var(--surface-raised)"
        stroke="var(--border-default)"
      />
      <text
        x="38"
        y="46"
        fontSize="9"
        fontFamily="var(--font-mono, monospace)"
        fill="var(--text-secondary)"
        letterSpacing="0.1em"
      >
        CAMPAIGN GRAPH · PH-023
      </text>
      <line x1="24" y1="58" x2="436" y2="58" stroke="var(--border-default)" />

      {/* Edges */}
      <g stroke="var(--plum-60)" strokeWidth="1.2" strokeLinecap="round">
        <line x1="230" y1="200" x2="110" y2="120" />
        <line x1="230" y1="200" x2="350" y2="120" />
        <line x1="230" y1="200" x2="110" y2="280" />
        <line x1="230" y1="200" x2="350" y2="280" />
      </g>

      {/* Variant nodes */}
      <GraphChip x={82} y={104} tag="EN" label="Similar 0.94" />
      <GraphChip x={322} y={104} tag="TL" label="Similar 0.91" />
      <GraphChip x={82} y={264} tag="TAG" label="Similar 0.92" />
      <GraphChip x={322} y={264} tag="EN" label="Similar 0.89" />

      {/* Center campaign node */}
      <circle cx="230" cy="200" r="26" fill="var(--brand-primary)" />
      <text
        x="230"
        y="200"
        fontSize="9"
        fill="var(--text-on-brand)"
        textAnchor="middle"
        fontWeight="700"
        fontFamily="var(--font-mono, monospace)"
      >
        PH-023
      </text>
      <text
        x="230"
        y="212"
        fontSize="7"
        fill="var(--text-on-brand)"
        textAnchor="middle"
        opacity="0.85"
      >
        12 variants
      </text>

      {/* Footer */}
      <line x1="24" y1="308" x2="436" y2="308" stroke="var(--border-default)" />
      <text
        x="38"
        y="325"
        fontSize="8"
        fill="var(--text-secondary)"
        fontFamily="var(--font-mono, monospace)"
      >
        first seen Sep 04 · last seen Sep 20 · top domain bdo-secure.link
      </text>
    </svg>
  );
}

function GraphChip({
  x,
  y,
  tag,
  label,
}: {
  x: number;
  y: number;
  tag: string;
  label: string;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width="56"
        height="32"
        rx="4"
        fill="var(--surface-canvas)"
        stroke="var(--border-default)"
      />
      <rect
        x={x + 4}
        y={y + 4}
        width="20"
        height="10"
        rx="2"
        fill="var(--surface-raised)"
        stroke="var(--brand-primary)"
      />
      <text
        x={x + 14}
        y={y + 12}
        fontSize="6.5"
        fill="var(--brand-primary)"
        textAnchor="middle"
        fontWeight="700"
        fontFamily="var(--font-mono, monospace)"
      >
        {tag}
      </text>
      <text x={x + 4} y={y + 24} fontSize="7" fill="var(--text-secondary)">
        {label}
      </text>
    </g>
  );
}

export default HowItWorks;
