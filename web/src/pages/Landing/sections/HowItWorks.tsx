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
import { BrowserFrame } from '../components/BrowserFrame';
import { CAPTURES } from '../captures';
import { PhoneMock } from '../components/PhoneMock';
import { DEMO_PORTAL_HOST } from '../landingFixture';
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
    body: 'The Android app reads each SMS on the phone and masks personal details — names, numbers, account IDs — before anything is sent.',
  },
  {
    id: 'classify',
    number: '02',
    title: 'Classify',
    body: 'A trained model sorts each message into Ham, Spam, or Scam, and the app flags everything that is not safe.',
  },
  {
    id: 'explain',
    number: '03',
    title: 'Explain',
    body: 'Named indicators — urgency cues, suspicious links, brand impersonation, OTP and account phishing — explain every alert.',
  },
  {
    id: 'connect',
    number: '04',
    title: 'Connect',
    body: 'The backend links related English, Filipino, and Taglish variants into one tracked campaign.',
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
 * HiwStageVisual: what each stage looks like in the real product.
 *
 *   0 Detect   — the app's Messages list with the new SMS flagged
 *   1 Classify — the app's alert screen and its verdict
 *   2 Explain  — the app's Threat Analysis with its indicators
 *   3 Connect  — a capture of the portal's campaign page (synthetic data)
 */
function HiwStageVisual({ activeIdx }: { activeIdx: number }) {
  switch (activeIdx) {
    case 0:
      return <PhoneMock screen="inbox" className="hiw-phone" />;
    case 1:
      return <PhoneMock screen="alert" className="hiw-phone" />;
    case 2:
      return <PhoneMock screen="analysis" className="hiw-phone" />;
    case 3:
      return (
        <BrowserFrame
          url={`${DEMO_PORTAL_HOST}/admin/campaigns`}
          className="hiw-capture"
        >
          <img
            src={CAPTURES.hiwConnect}
            alt="BantAI portal campaign page grouping English, Filipino, and Taglish variants of the GCash lure"
            loading="lazy"
            decoding="async"
          />
        </BrowserFrame>
      );
    default:
      return <PhoneMock screen="inbox" className="hiw-phone" />;
  }
}

export default HowItWorks;
