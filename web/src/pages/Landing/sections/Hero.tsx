/*
 * Hero visual.
 *
 * A hand-authored SVG composition in Bauhaus/Swiss-modernist style. No
 * wrapping card — the phone, SMS variants, and connecting lines sit directly
 * on the cream background with muted plum geometric shapes as backdrop.
 *
 * Storytelling animation (14 s, one-shot, then hold):
 *   0.0–1.0 s   phone frame settles in
 *   1.0–2.5 s   incoming SMS slides up into the phone
 *   2.5–4.0 s   suspicious spans get highlighter marks in sequence
 *               (urgency phrase → URL → amount)
 *   4.0–5.5 s   "Analyzing…" progress bar sweeps
 *   5.5–7.0 s   analyzing resolves into "Likely Smishing · 94%" chip
 *   7.0–8.5 s   three reason chips settle in
 *   8.5–10.0 s  three language variant cards (EN / TL / Taglish) appear
 *  10.0–12.0 s  thin plum lines draw from phone to each variant
 *  12.0–13.5 s  campaign match badge lands at the base
 *  13.5 s+     end state holds
 *
 * Reduced motion: renders the end state directly with no animation.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import './hero.css';

export function Hero() {
  return (
    <section className="landing__section landing__section--tight hero" id="top">
      <div className="landing__section-inner">
        <div className="landing__grid landing__grid--hero">
          <div className="hero__copy">
            <p className="landing__eyebrow">
              Philippine SMS threat intelligence
            </p>
            <h1 className="landing__display">
              Understand smishing beyond a single SMS.
            </h1>
            <p className="landing__lede">
              Flag suspicious SMS on Android and trace Tagalog, English, and
              Taglish variants back to the same Philippine campaign.
            </p>
            <div className="landing__cta-row">
              <a
                href="#how-it-works"
                className="landing__cta-primary"
                onClick={(e) => {
                  e.preventDefault();
                  document
                    .getElementById('how-it-works')
                    ?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Explore how it works ↓
              </a>
              <Link to="/request-access" className="landing__cta-ghost">
                Request access
              </Link>
            </div>
          </div>

          <div className="hero__stage" aria-hidden>
            <HeroVisual />
          </div>
        </div>
      </div>
    </section>
  );
}

/*
 * HeroVisual: one SVG, 720×560 viewBox. Nothing here relies on JS timers —
 * every element's entrance is driven by an `animation-delay` in hero.css so
 * the sequence unrolls once and holds the end state via `fill-mode: forwards`.
 */
function HeroVisual() {
  return (
    <svg
      className="hero-vis"
      viewBox="0 0 720 560"
      role="img"
      aria-label="A suspicious SMS from BDO-INFO is highlighted for urgency, a look-alike URL, and a peso amount, classified as likely smishing at 94% confidence, and connected to English, Tagalog, and Taglish variants of the same Philippine smishing campaign."
    >
      <defs>
        {/*
         * Subtle risograph/screen-print grain. Applied at ~4% opacity on top of
         * the whole composition so nothing reads as sterile CGI, but the noise
         * never draws attention on its own.
         */}
        <filter id="hero-vis-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            seed="4"
          />
          <feColorMatrix
            values="0 0 0 0 0.16
                    0 0 0 0 0.13
                    0 0 0 0 0.20
                    0 0 0 0.6 0"
          />
        </filter>

        {/* Soft shadow anchoring the phone to the composition. */}
        <filter
          id="hero-vis-phone-shadow"
          x="-10%"
          y="-6%"
          width="120%"
          height="115%"
        >
          <feGaussianBlur in="SourceAlpha" stdDeviation="6" />
          <feOffset dx="0" dy="6" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.14" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Small shadow for floating variant cards. */}
        <filter
          id="hero-vis-card-shadow"
          x="-6%"
          y="-6%"
          width="112%"
          height="118%"
        >
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
          <feOffset dx="0" dy="3" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.10" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ————— Bauhaus decorative backdrop ————— */}
      <g className="hero-vis__bg" aria-hidden>
        {/* Top-right quarter circle */}
        <circle cx="720" cy="0" r="150" fill="var(--plum-08)" />
        {/* Bottom-left triangle */}
        <polygon points="-20,560 130,560 -20,420" fill="var(--plum-14)" />
        {/* Swiss column tension: dashed vertical rule between phone and cluster */}
        <line
          x1="390"
          y1="30"
          x2="390"
          y2="500"
          stroke="var(--plum-35)"
          strokeWidth="1"
          strokeDasharray="2 6"
        />
        {/* Baseline */}
        <line
          x1="20"
          y1="522"
          x2="700"
          y2="522"
          stroke="var(--plum-35)"
          strokeWidth="1"
        />
        {/* Small solid circle mark on baseline (Swiss registration dot) */}
        <circle cx="20" cy="522" r="3" fill="var(--brand-primary)" />
      </g>

      {/* ————— Phone ————— */}
      <g className="hero-vis__phone" filter="url(#hero-vis-phone-shadow)">
        {/* Frame */}
        <rect
          x="70"
          y="40"
          width="270"
          height="460"
          rx="30"
          fill="var(--surface-raised)"
          stroke="var(--text-primary)"
          strokeWidth="1.5"
        />
        {/* Screen */}
        <rect
          x="82"
          y="54"
          width="246"
          height="432"
          rx="22"
          fill="var(--surface-canvas)"
        />
        {/* Dynamic island / notch */}
        <rect
          x="170"
          y="52"
          width="70"
          height="10"
          rx="5"
          fill="var(--text-primary)"
        />

        {/* Status bar */}
        <text
          x="102"
          y="82"
          fontSize="10"
          fontFamily="var(--font-mono, monospace)"
          fill="var(--text-primary)"
          fontWeight="600"
        >
          9:41
        </text>
        <g fill="var(--text-primary)">
          <circle cx="278" cy="79" r="1.6" />
          <circle cx="284" cy="79" r="1.6" />
          <circle cx="290" cy="79" r="1.6" />
          <rect x="296" y="76" width="12" height="6" rx="1.5" />
          <rect x="309" y="77.5" width="1.5" height="3" rx="0.5" />
        </g>

        {/* Header row */}
        <text
          x="102"
          y="106"
          fontSize="11"
          fontFamily="var(--font-mono, monospace)"
          fill="var(--text-secondary)"
          letterSpacing="0.08em"
        >
          MESSAGES
        </text>
        <line
          x1="94"
          y1="114"
          x2="316"
          y2="114"
          stroke="var(--border-default)"
          strokeWidth="1"
        />

        {/* SMS bubble ——————————————————————————————— */}
        <g className="hero-vis__sms">
          <rect
            x="94"
            y="124"
            width="222"
            height="138"
            rx="12"
            fill="var(--surface-raised)"
            stroke="var(--border-default)"
            strokeWidth="1"
          />

          {/* Sender + timestamp */}
          <text
            x="106"
            y="144"
            fontSize="10"
            fontFamily="var(--font-mono, monospace)"
            fill="var(--text-primary)"
            fontWeight="700"
            letterSpacing="0.04em"
          >
            BDO-INFO
          </text>
          <text
            x="306"
            y="144"
            fontSize="9"
            fill="var(--text-secondary)"
            textAnchor="end"
          >
            9:38 AM
          </text>

          {/*
           * Highlighter marks sit behind the body text so the plum stroke
           * reads as an editorial highlight, not a fill under the word.
           * Each mark animates scaleX 0 → 1 from left origin, staggered.
           */}
          <rect
            className="hero-vis__mark hero-vis__mark--urgency"
            x="106"
            y="160"
            width="186"
            height="30"
            rx="2"
            fill="var(--plum-14)"
          />
          <rect
            className="hero-vis__mark hero-vis__mark--url"
            x="146"
            y="192"
            width="154"
            height="14"
            rx="2"
            fill="var(--plum-14)"
          />
          <rect
            className="hero-vis__mark hero-vis__mark--amount"
            x="106"
            y="208"
            width="118"
            height="14"
            rx="2"
            fill="var(--plum-14)"
          />

          {/* Body text */}
          <text
            x="106"
            y="172"
            fontSize="11"
            fill="var(--text-primary)"
            fontFamily="var(--font-sans)"
          >
            Your BDO account will be
          </text>
          <text
            x="106"
            y="186"
            fontSize="11"
            fill="var(--text-primary)"
            fontFamily="var(--font-sans)"
          >
            suspended in 24 hours.
          </text>
          <text
            x="106"
            y="202"
            fontSize="11"
            fill="var(--text-primary)"
            fontFamily="var(--font-sans)"
          >
            Verify at{' '}
            <tspan
              fill="var(--brand-primary)"
              fontFamily="var(--font-mono, monospace)"
              fontWeight="600"
            >
              bdo-secure.link
            </tspan>
          </text>
          <text
            x="106"
            y="218"
            fontSize="11"
            fill="var(--text-primary)"
            fontFamily="var(--font-sans)"
          >
            Ref: <tspan fontWeight="700">PHP 15,000</tspan>
          </text>

          {/* Small underline glyph beneath the URL (draws in with the URL mark) */}
          <line
            className="hero-vis__ul"
            x1="150"
            y1="204"
            x2="298"
            y2="204"
            stroke="var(--brand-primary)"
            strokeWidth="1"
          />
        </g>

        {/* Analyzing state ——————————————————————————— */}
        <g className="hero-vis__analyzing">
          <text
            x="102"
            y="286"
            fontSize="9"
            fontFamily="var(--font-mono, monospace)"
            fill="var(--text-secondary)"
            letterSpacing="0.14em"
          >
            BANTAI · ANALYZING
          </text>
          <rect
            x="102"
            y="292"
            width="208"
            height="3"
            rx="1.5"
            fill="var(--plum-14)"
          />
          <rect
            className="hero-vis__analyzing-progress"
            x="102"
            y="292"
            width="208"
            height="3"
            rx="1.5"
            fill="var(--brand-primary)"
          />
        </g>

        {/* Classification chip ————————————————————— */}
        <g className="hero-vis__verdict">
          <rect
            x="94"
            y="276"
            width="222"
            height="56"
            rx="10"
            fill="var(--surface-raised)"
            stroke="var(--border-default)"
            strokeWidth="1"
          />
          {/* Left accent bar */}
          <rect
            x="94"
            y="276"
            width="4"
            height="56"
            rx="2"
            fill="var(--status-threat)"
          />
          <text
            x="112"
            y="296"
            fontSize="9"
            fontFamily="var(--font-mono, monospace)"
            fill="var(--text-secondary)"
            letterSpacing="0.14em"
          >
            BANTAI VERDICT
          </text>
          <text
            x="112"
            y="316"
            fontSize="13"
            fill="var(--text-primary)"
            fontWeight="700"
          >
            Likely Smishing
          </text>
          <text
            x="306"
            y="316"
            fontSize="12"
            fill="var(--brand-primary)"
            fontWeight="700"
            textAnchor="end"
          >
            94%
          </text>
        </g>

        {/* Reason chips ————————————————————————————— */}
        <g className="hero-vis__reasons">
          <ReasonChip
            x={94}
            y={346}
            label="Urgency"
            delayClass="hero-vis__reason--1"
          />
          <ReasonChip
            x={162}
            y={346}
            label="Look-alike URL"
            delayClass="hero-vis__reason--2"
          />
          <ReasonChip
            x={252}
            y={346}
            label="Brand"
            delayClass="hero-vis__reason--3"
          />
        </g>

        {/* Subtle Report / Ignore hint at bottom of screen */}
        <g opacity="0.72">
          <rect
            x="94"
            y="440"
            width="106"
            height="30"
            rx="8"
            fill="var(--brand-primary)"
          />
          <text
            x="147"
            y="459"
            fontSize="11"
            fill="var(--text-on-brand)"
            fontWeight="600"
            textAnchor="middle"
          >
            Report
          </text>
          <rect
            x="210"
            y="440"
            width="106"
            height="30"
            rx="8"
            fill="var(--surface-raised)"
            stroke="var(--border-default)"
          />
          <text
            x="263"
            y="459"
            fontSize="11"
            fill="var(--text-primary)"
            textAnchor="middle"
          >
            Ignore
          </text>
        </g>
      </g>

      {/* ————— Campaign cluster (right of phone) ————— */}
      <g className="hero-vis__cluster">
        {/* Anchor node — small plum dot in the negative space between the
             phone's verdict chip and the variant cards. Every connecting line
             originates here so the cluster feels centered on the classification
             moment, not on the phone frame. */}
        <g className="hero-vis__anchor">
          <circle cx="380" cy="304" r="7" fill="var(--brand-primary)" />
          <circle
            cx="380"
            cy="304"
            r="13"
            fill="none"
            stroke="var(--plum-35)"
            strokeWidth="1"
          />
        </g>

        {/* Connecting lines (draw in via stroke-dashoffset) */}
        <line
          className="hero-vis__edge hero-vis__edge--en"
          x1="380"
          y1="304"
          x2="452"
          y2="128"
          stroke="var(--plum-60)"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
        <line
          className="hero-vis__edge hero-vis__edge--tl"
          x1="380"
          y1="304"
          x2="470"
          y2="278"
          stroke="var(--plum-60)"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
        <line
          className="hero-vis__edge hero-vis__edge--tag"
          x1="380"
          y1="304"
          x2="452"
          y2="426"
          stroke="var(--plum-60)"
          strokeWidth="1.25"
          strokeLinecap="round"
        />

        {/* Variant cards */}
        <VariantCard
          x={452}
          y={80}
          lang="EN"
          line1="BDO account temporarily locked."
          line2="Verify at bdo-safe.link"
          delayClass="hero-vis__variant--en"
        />
        <VariantCard
          x={470}
          y={230}
          lang="TL"
          line1="Account ninyo pansamantalang"
          line2="naka-lock. Pumunta sa bdo-verify.ph"
          delayClass="hero-vis__variant--tl"
        />
        <VariantCard
          x={452}
          y={378}
          lang="TAG"
          line1="Account mo temporarily blocked."
          line2="Verify agad sa bdo-check.link"
          delayClass="hero-vis__variant--tag"
        />
      </g>

      {/* ————— Campaign match badge ————— */}
      <g className="hero-vis__badge">
        <rect
          x="230"
          y="536"
          width="260"
          height="16"
          rx="8"
          fill="var(--surface-raised)"
          stroke="var(--brand-primary)"
          strokeWidth="1"
        />
        <circle cx="244" cy="544" r="3" fill="var(--brand-primary)" />
        <text
          x="360"
          y="548"
          fontSize="10"
          fill="var(--text-primary)"
          fontFamily="var(--font-mono, monospace)"
          letterSpacing="0.06em"
          textAnchor="middle"
        >
          CAMPAIGN MATCH · PH-023 · 12 VARIANTS
        </text>
      </g>

      {/* Riso grain overlay — front, very subtle */}
      <rect
        x="0"
        y="0"
        width="720"
        height="560"
        filter="url(#hero-vis-grain)"
        opacity="0.05"
        pointerEvents="none"
      />
    </svg>
  );
}

interface ReasonChipProps {
  x: number;
  y: number;
  label: string;
  delayClass: string;
}

function ReasonChip({ x, y, label, delayClass }: ReasonChipProps) {
  const w = Math.max(50, label.length * 5.5 + 16);
  return (
    <g className={`hero-vis__reason ${delayClass}`}>
      <rect
        x={x}
        y={y}
        width={w}
        height="20"
        rx="10"
        fill="var(--surface-canvas)"
        stroke="var(--plum-35)"
        strokeWidth="1"
      />
      <text
        x={x + w / 2}
        y={y + 14}
        fontSize="9"
        fill="var(--brand-primary)"
        textAnchor="middle"
        fontWeight="600"
      >
        {label}
      </text>
    </g>
  );
}

interface VariantCardProps {
  x: number;
  y: number;
  lang: string;
  line1: string;
  line2: string;
  delayClass: string;
}

function VariantCard({
  x,
  y,
  lang,
  line1,
  line2,
  delayClass,
}: VariantCardProps) {
  return (
    <g
      className={`hero-vis__variant ${delayClass}`}
      filter="url(#hero-vis-card-shadow)"
    >
      <rect
        x={x}
        y={y}
        width="230"
        height="92"
        rx="6"
        fill="var(--surface-raised)"
        stroke="var(--border-default)"
        strokeWidth="1"
      />
      {/* Language badge */}
      <rect
        x={x + 12}
        y={y + 12}
        width={lang.length * 7 + 12}
        height="18"
        rx="3"
        fill="var(--surface-canvas)"
        stroke="var(--brand-primary)"
        strokeWidth="1"
      />
      <text
        x={x + 12 + (lang.length * 7 + 12) / 2}
        y={y + 25}
        fontSize="9"
        fill="var(--brand-primary)"
        textAnchor="middle"
        fontWeight="700"
        letterSpacing="0.08em"
        fontFamily="var(--font-mono, monospace)"
      >
        {lang}
      </text>
      {/* Similarity score, right-aligned */}
      <text
        x={x + 218}
        y={y + 25}
        fontSize="9"
        fill="var(--text-secondary)"
        textAnchor="end"
        fontFamily="var(--font-mono, monospace)"
      >
        SIM 0.9{lang === 'EN' ? '4' : lang === 'TL' ? '1' : '2'}
      </text>
      {/* Body text */}
      <text x={x + 12} y={y + 52} fontSize="11" fill="var(--text-primary)">
        {line1}
      </text>
      <text x={x + 12} y={y + 70} fontSize="11" fill="var(--text-primary)">
        {line2}
      </text>
      {/* Small threat dot */}
      <circle cx={x + 220} cy={y + 82} r="3" fill="var(--status-threat)" />
    </g>
  );
}

export default Hero;
