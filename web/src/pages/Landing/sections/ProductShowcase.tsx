/*
 * Product Showcase — semi-realistic mock-ups of the two BantAI surfaces.
 *
 * Left  — Android device (Material 3): device chrome with hole-punch camera,
 *         gesture nav pill, real status bar, and the BantAI alert screen.
 * Right — Portal (browser chrome + sidebar + toolbar + campaign detail table).
 *
 * These stay SVG so the site does not need to ship raster device shots. Both
 * carry an "Interface preview" caption so nothing masquerades as a production
 * screenshot.
 */

import React from 'react';
import { useReveal } from '../useReveal';
import './product-showcase.css';

export function ProductShowcase() {
  const rootRef = useReveal<HTMLElement>();
  return (
    <section ref={rootRef} className="landing__section ps">
      <div className="landing__section-inner">
        <div className="ps__intro" data-reveal>
          <p className="landing__eyebrow">Product</p>
          <h2 className="landing__h2">
            From personal protection to campaign intelligence.
          </h2>
          <p className="landing__lede">
            The same detection drives the alert on someone's phone and the
            analyst's campaign view.
          </p>
        </div>

        <div className="ps__grid">
          <figure className="ps__mobile" data-reveal data-reveal-delay="1">
            <figcaption className="ps__caption">
              <span className="ps__caption-dot" />
              Android · Interface preview
            </figcaption>
            <AndroidMock />
          </figure>

          <figure className="ps__web" data-reveal data-reveal-delay="2">
            <figcaption className="ps__caption">
              <span className="ps__caption-dot" />
              Portal · Interface preview
            </figcaption>
            <PortalMock />
          </figure>
        </div>
      </div>
    </section>
  );
}

/*
 * AndroidMock — Material 3 phone with hole-punch camera, gesture nav pill,
 * and the BantAI classification detail screen. viewBox 320×660.
 */
function AndroidMock() {
  return (
    <svg
      viewBox="0 0 320 660"
      className="ps__mobile-svg"
      role="img"
      aria-label="Android interface preview: an SMS is flagged as Likely Smishing with 94% confidence, showing named indicators with weights, campaign match, and Report / Ignore actions."
    >
      {/* Device chrome — subtle inner bezel highlight sells depth */}
      <rect
        x="8"
        y="8"
        width="304"
        height="644"
        rx="42"
        fill="var(--text-primary)"
      />
      <rect
        x="10"
        y="10"
        width="300"
        height="640"
        rx="40"
        fill="none"
        stroke="color-mix(in srgb, var(--text-primary) 40%, transparent)"
        strokeWidth="1"
      />
      {/* Side buttons (power + volume rocker) — small realism cue */}
      <rect x="6" y="150" width="2" height="50" rx="1" fill="color-mix(in srgb, var(--text-primary) 55%, transparent)" />
      <rect x="6" y="220" width="2" height="34" rx="1" fill="color-mix(in srgb, var(--text-primary) 55%, transparent)" />
      <rect x="312" y="170" width="2" height="60" rx="1" fill="color-mix(in srgb, var(--text-primary) 55%, transparent)" />
      {/* Screen */}
      <rect
        x="18"
        y="18"
        width="284"
        height="624"
        rx="32"
        fill="var(--surface-canvas)"
      />
      {/* Hole-punch camera — smaller, matches modern devices */}
      <circle cx="160" cy="36" r="4" fill="var(--text-primary)" />
      <circle cx="160" cy="36" r="2.4" fill="color-mix(in srgb, var(--text-primary) 55%, var(--brand-primary) 45%)" opacity="0.6" />

      {/* Status bar — real signal / wifi / battery glyphs */}
      <text
        x="34"
        y="52"
        fontSize="12"
        fontFamily="var(--font-sans)"
        fontWeight="600"
        fill="var(--text-primary)"
      >
        9:41
      </text>
      <g fill="var(--text-primary)">
        {/* Signal bars — rising staircase */}
        <rect x="242" y="49" width="2.5" height="3" rx="0.5" />
        <rect x="246" y="47" width="2.5" height="5" rx="0.5" />
        <rect x="250" y="45" width="2.5" height="7" rx="0.5" />
        <rect x="254" y="43" width="2.5" height="9" rx="0.5" />
        {/* Wifi glyph (three arcs + dot) */}
        <path d="M 264 51 A 6 6 0 0 1 276 51" fill="none" stroke="var(--text-primary)" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M 266 50 A 4 4 0 0 1 274 50" fill="none" stroke="var(--text-primary)" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="270" cy="51.5" r="1" />
        {/* Battery capsule */}
        <rect x="282" y="45" width="16" height="8" rx="2" fill="none" stroke="var(--text-primary)" strokeWidth="1" />
        <rect x="298" y="47" width="1.5" height="4" rx="0.5" />
        <rect x="284" y="47" width="12" height="4" rx="1" />
      </g>

      {/* App top-app-bar — back arrow + overflow, like Material 3 */}
      <g fill="none" stroke="var(--text-primary)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M 30 82 L 22 88 L 30 94" />
        <path d="M 22 88 L 40 88" />
      </g>
      <g fill="var(--text-primary)">
        <circle cx="284" cy="88" r="1.4" />
        <circle cx="290" cy="88" r="1.4" />
        <circle cx="296" cy="88" r="1.4" />
      </g>
      <text
        x="50"
        y="92"
        fontSize="12"
        fontFamily="var(--font-sans)"
        fontWeight="600"
        fill="var(--text-primary)"
      >
        BantAI · Alert
      </text>

      <text x="24" y="128" fontSize="21" fontWeight="700" fill="var(--text-primary)" letterSpacing="-0.01em">
        Message flagged
      </text>
      <text x="24" y="146" fontSize="12" fill="var(--text-secondary)">
        Received 9:38 · from BDO-INFO
      </text>

      {/* Verdict card — Material 3 elevated */}
      <rect
        x="24"
        y="158"
        width="272"
        height="72"
        rx="14"
        fill="var(--surface-raised)"
        stroke="var(--border-default)"
        filter="url(#ps-card-elev)"
      />
      <rect x="24" y="158" width="4" height="72" rx="2" fill="var(--status-threat)" />
      <text
        x="40"
        y="180"
        fontSize="9"
        letterSpacing="0.14em"
        fill="var(--text-secondary)"
        fontFamily="var(--font-mono, monospace)"
      >
        VERDICT
      </text>
      <text x="40" y="202" fontSize="18" fontWeight="700" fill="var(--text-primary)">
        Likely Smishing
      </text>
      <text
        x="288"
        y="202"
        fontSize="20"
        fontWeight="700"
        fill="var(--brand-primary)"
        textAnchor="end"
        fontFamily="var(--font-mono, monospace)"
      >
        94%
      </text>
      <text x="40" y="220" fontSize="11" fill="var(--text-secondary)">
        Model v0.4.2 · macro-F1 0.887
      </text>

      {/* Message quote — with sender chip + timestamp header */}
      <text
        x="24"
        y="258"
        fontSize="9"
        letterSpacing="0.14em"
        fill="var(--text-secondary)"
        fontFamily="var(--font-mono, monospace)"
      >
        MESSAGE
      </text>
      <rect
        x="24"
        y="266"
        width="272"
        height="96"
        rx="14"
        fill="var(--surface-raised)"
        stroke="var(--border-default)"
      />
      {/* Sender avatar + label row */}
      <circle cx="40" cy="286" r="10" fill="var(--plum-14)" />
      <text
        x="40"
        y="290"
        fontSize="9"
        fontWeight="700"
        fill="var(--brand-primary)"
        textAnchor="middle"
        fontFamily="var(--font-mono, monospace)"
      >
        B
      </text>
      <text x="58" y="282" fontSize="12" fontWeight="600" fill="var(--text-primary)">
        BDO-INFO
      </text>
      <text x="58" y="294" fontSize="10" fill="var(--text-secondary)">
        SMS · 9:38 AM
      </text>
      <line x1="34" y1="308" x2="286" y2="308" stroke="var(--border-default)" />
      <text x="40" y="326" fontSize="12" fill="var(--text-primary)">
        Your BDO account will be suspended
      </text>
      <text x="40" y="342" fontSize="12" fill="var(--text-primary)">
        in 24 hours. Verify at{' '}
        <tspan
          fill="var(--brand-primary)"
          fontFamily="var(--font-mono, monospace)"
          fontWeight="600"
        >
          bdo-secure.link
        </tspan>
      </text>
      <text x="40" y="358" fontSize="12" fill="var(--text-primary)" fontWeight="600">
        Ref: PHP 15,000
      </text>

      {/* Indicators — small progress bars alongside weight numerals */}
      <text
        x="24"
        y="392"
        fontSize="9"
        letterSpacing="0.14em"
        fill="var(--text-secondary)"
        fontFamily="var(--font-mono, monospace)"
      >
        INDICATORS
      </text>
      {[
        ['Urgency', '0.42', 0.42],
        ['Look-alike URL', '0.31', 0.31],
        ['Brand impersonation', '0.18', 0.18],
        ['Account threat', '0.09', 0.09],
      ].map(([label, w, wn], i) => (
        <g key={String(label)} transform={`translate(0, ${i * 22})`}>
          <text x="24" y={412} fontSize="12" fill="var(--text-primary)">
            {label}
          </text>
          {/* Weight bar (relative to max 0.42) */}
          <rect x="220" y={405} width="46" height="4" rx="2" fill="var(--plum-14)" />
          <rect
            x="220"
            y={405}
            width={((wn as number) / 0.42) * 46}
            height="4"
            rx="2"
            fill="var(--brand-primary)"
          />
          <text
            x="296"
            y={412}
            fontSize="11"
            fill="var(--text-secondary)"
            textAnchor="end"
            fontFamily="var(--font-mono, monospace)"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {w}
          </text>
        </g>
      ))}

      {/* Campaign match — tonal card + chevron affordance */}
      <text
        x="24"
        y="504"
        fontSize="9"
        letterSpacing="0.14em"
        fill="var(--text-secondary)"
        fontFamily="var(--font-mono, monospace)"
      >
        CAMPAIGN MATCH
      </text>
      <rect
        x="24"
        y="512"
        width="272"
        height="54"
        rx="14"
        fill="var(--plum-08)"
        stroke="var(--plum-35)"
      />
      <circle cx="46" cy="539" r="10" fill="var(--brand-primary)" />
      <text
        x="46"
        y="543"
        fontSize="9"
        fill="var(--text-on-brand)"
        textAnchor="middle"
        fontWeight="700"
        fontFamily="var(--font-mono, monospace)"
      >
        23
      </text>
      <text x="66" y="533" fontSize="13" fill="var(--text-primary)" fontWeight="600">
        Campaign PH-023
      </text>
      <text x="66" y="551" fontSize="11" fill="var(--text-secondary)">
        12 related variants · first seen Sep 4
      </text>
      {/* Chevron */}
      <g fill="none" stroke="var(--brand-primary)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M 278 534 L 284 540 L 278 546" />
      </g>

      {/* Actions — Material 3 filled + tonal button pair */}
      <rect x="24" y="582" width="130" height="46" rx="23" fill="var(--brand-primary)" />
      <text
        x="89"
        y="610"
        fontSize="13"
        fill="var(--text-on-brand)"
        fontWeight="700"
        textAnchor="middle"
      >
        Report
      </text>
      <rect
        x="166"
        y="582"
        width="130"
        height="46"
        rx="23"
        fill="var(--plum-14)"
      />
      <text
        x="231"
        y="610"
        fontSize="13"
        fill="var(--brand-primary)"
        fontWeight="600"
        textAnchor="middle"
      >
        Ignore
      </text>

      {/* Gesture nav pill */}
      <rect
        x="130"
        y="636"
        width="60"
        height="4"
        rx="2"
        fill="var(--text-primary)"
        opacity="0.55"
      />
      {/* Elevation filter for cards */}
      <defs>
        <filter id="ps-card-elev" x="-10%" y="-30%" width="120%" height="180%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
          <feOffset dx="0" dy="2" result="off" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.10" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}

/*
 * PortalMock — a laptop-style browser preview: browser chrome (traffic lights,
 * URL bar), sidebar with icons, filter/toolbar row, and a campaign detail
 * table. viewBox 900×540.
 */
function PortalMock() {
  return (
    <svg
      viewBox="0 0 900 540"
      className="ps__web-svg"
      role="img"
      aria-label="Portal interface preview: the BantAI web dashboard showing a campaign detail table with variant rows, similarity scores, timestamps, and top domains."
    >
      <defs>
        <filter id="ps-window-elev" x="-5%" y="-5%" width="110%" height="115%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="8" />
          <feOffset dx="0" dy="6" result="off" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.08" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Window shell */}
      <rect
        x="0"
        y="0"
        width="900"
        height="540"
        rx="12"
        fill="var(--surface-raised)"
        stroke="var(--border-default)"
        filter="url(#ps-window-elev)"
      />

      {/* Browser chrome */}
      <rect x="0" y="0" width="900" height="34" rx="12" fill="var(--surface-canvas)" />
      <rect x="0" y="24" width="900" height="10" fill="var(--surface-canvas)" />
      <line x1="0" y1="34" x2="900" y2="34" stroke="var(--border-default)" />
      <circle cx="20" cy="17" r="5" fill="#E97F7F" />
      <circle cx="38" cy="17" r="5" fill="#E9C874" />
      <circle cx="56" cy="17" r="5" fill="#78C58A" />
      {/* Tab pill */}
      <path d="M 84 34 L 90 22 L 194 22 L 200 34 Z" fill="var(--surface-raised)" stroke="var(--border-default)" />
      <text x="102" y="30" fontSize="9" fill="var(--text-primary)" fontFamily="var(--font-sans)">
        BantAI · Admin
      </text>
      <rect x="220" y="8" width="480" height="18" rx="9" fill="var(--surface-raised)" stroke="var(--border-default)" />
      {/* Lock icon */}
      <rect x="230" y="13" width="6" height="6" rx="1" fill="none" stroke="var(--text-secondary)" strokeWidth="0.8" />
      <path d="M 231.5 13 L 231.5 11.5 A 1.5 1.5 0 0 1 234.5 11.5 L 234.5 13" fill="none" stroke="var(--text-secondary)" strokeWidth="0.8" />
      <text
        x="460"
        y="21"
        fontSize="10"
        fill="var(--text-secondary)"
        textAnchor="middle"
        fontFamily="var(--font-mono, monospace)"
      >
        bantai.ph/admin/campaigns/PH-023
      </text>

      {/* Sidebar */}
      <rect x="0" y="34" width="180" height="506" fill="var(--surface-canvas)" />
      <line x1="180" y1="34" x2="180" y2="540" stroke="var(--border-default)" />
      {/* Logo mark */}
      <g transform="translate(20, 54)">
        <circle cx="8" cy="8" r="8" fill="var(--brand-primary)" />
        <text x="24" y="12" fontSize="12" fontWeight="700" fill="var(--text-primary)">
          BantAI
        </text>
        <text x="24" y="24" fontSize="9" fill="var(--text-secondary)" letterSpacing="0.14em" fontFamily="var(--font-mono, monospace)">
          ADMIN
        </text>
      </g>
      {[
        ['Overview', false],
        ['Campaigns', true],
        ['Alerts', false],
        ['Models', false],
        ['Users', false],
        ['Reports', false],
      ].map(([label, active], i) => (
        <g key={String(label)} transform={`translate(0, ${i * 32})`}>
          {active && (
            <>
              <rect x="8" y={100} width="164" height="30" rx="8" fill="var(--plum-14)" />
              {/* Left active-indicator bar */}
              <rect x="0" y={106} width="3" height="18" rx="1.5" fill="var(--brand-primary)" />
            </>
          )}
          {/* Icon glyph */}
          <rect x="20" y={110} width="10" height="10" rx="2" fill={active ? 'var(--brand-primary)' : 'var(--text-secondary)'} />
          <text
            x="42"
            y={119}
            fontSize="12"
            fill={active ? 'var(--brand-primary)' : 'var(--text-primary)'}
            fontWeight={active ? 700 : 500}
          >
            {label}
          </text>
          {active && (
            <text x="164" y={119} fontSize="10" fill="var(--brand-primary)" textAnchor="end" fontFamily="var(--font-mono, monospace)" fontWeight="700">
              12
            </text>
          )}
        </g>
      ))}
      {/* Footer avatar row */}
      <line x1="8" y1="490" x2="172" y2="490" stroke="var(--border-default)" />
      <circle cx="24" cy="510" r="10" fill="var(--plum-14)" />
      <text x="24" y="514" fontSize="9" fontWeight="700" fill="var(--brand-primary)" textAnchor="middle" fontFamily="var(--font-mono, monospace)">
        R
      </text>
      <text x="42" y="508" fontSize="11" fill="var(--text-primary)" fontWeight="600">
        R. De Castro
      </text>
      <text x="42" y="520" fontSize="9" fill="var(--text-secondary)">
        Analyst
      </text>

      {/* Main header — breadcrumb + title + status pill */}
      <g transform="translate(204, 60)">
        <text fontSize="10" fontFamily="var(--font-mono, monospace)" fill="var(--text-secondary)" letterSpacing="0.14em">
          <tspan>CAMPAIGNS</tspan>
          <tspan dx="6" fill="var(--text-secondary)">/</tspan>
          <tspan dx="6" fill="var(--brand-primary)">PH-023</tspan>
        </text>
      </g>
      <text x="204" y="94" fontSize="22" fontWeight="700" fill="var(--text-primary)" letterSpacing="-0.01em">
        E-wallet account-suspension lure
      </text>
      {/* Active status pill */}
      <rect
        x="586"
        y="78"
        width="72"
        height="20"
        rx="10"
        fill="color-mix(in srgb, var(--status-threat) 12%, transparent)"
        stroke="color-mix(in srgb, var(--status-threat) 32%, transparent)"
      />
      <circle cx="598" cy="88" r="3" fill="var(--status-threat)" />
      <text x="608" y="92" fontSize="10" fill="var(--status-threat)" fontWeight="700" fontFamily="var(--font-mono, monospace)" letterSpacing="0.08em">
        ACTIVE
      </text>
      <text x="204" y="112" fontSize="12" fill="var(--text-secondary)">
        Multilingual smishing family targeting BDO and GCash customers
      </text>

      {/* Metric strip — cards, not floating text */}
      <g transform="translate(204, 130)">
        <MetricBlock label="Detected" value="148" delta="+12" x={0} />
        <MetricBlock label="First seen" value="Sep 4" x={168} />
        <MetricBlock label="Last seen" value="Sep 20" x={336} />
        <MetricBlock label="Model conf." value="0.94" x={504} />
      </g>

      {/* Toolbar — real filter chips + button-styled export */}
      <g transform="translate(204, 214)">
        <text x="0" y="14" fontSize="13" fill="var(--text-primary)" fontWeight="700">
          Variants
        </text>
        <text x="60" y="14" fontSize="11" fill="var(--text-secondary)" fontFamily="var(--font-mono, monospace)">
          12 total
        </text>
        {/* Filter chips */}
        <g transform="translate(160, 0)">
          <rect x="0" y="0" width="86" height="24" rx="12" fill="var(--plum-14)" />
          <circle cx="12" cy="12" r="3" fill="var(--brand-primary)" />
          <text x="22" y="16" fontSize="10.5" fill="var(--brand-primary)" fontWeight="600">
            Language · 3
          </text>
        </g>
        <g transform="translate(254, 0)">
          <rect x="0" y="0" width="106" height="24" rx="12" fill="var(--surface-canvas)" stroke="var(--border-default)" />
          <text x="12" y="16" fontSize="10.5" fill="var(--text-primary)">
            Sep 1 – Sep 20
          </text>
          <path d="M 92 10 L 98 10 L 95 14 Z" fill="var(--text-secondary)" />
        </g>
        <g transform="translate(368, 0)">
          <rect x="0" y="0" width="72" height="24" rx="12" fill="var(--surface-canvas)" stroke="var(--border-default)" />
          <text x="36" y="16" fontSize="10.5" fill="var(--text-primary)" textAnchor="middle">
            All domains
          </text>
        </g>
        {/* Export button (proper filled tonal button) */}
        <g transform="translate(600, 0)">
          <rect x="0" y="0" width="76" height="24" rx="6" fill="var(--brand-primary)" />
          <text x="38" y="16" fontSize="10.5" fill="var(--text-on-brand)" textAnchor="middle" fontWeight="600">
            Export CSV
          </text>
        </g>
      </g>

      {/* Table header */}
      <g transform="translate(204, 254)">
        <rect x="0" y="0" width="676" height="28" fill="var(--surface-canvas)" />
        <line x1="0" y1="0" x2="676" y2="0" stroke="var(--border-default)" />
        <line x1="0" y1="28" x2="676" y2="28" stroke="var(--border-default)" />
        <text x="14" y="18" fontSize="10" fill="var(--text-secondary)" letterSpacing="0.1em" fontFamily="var(--font-mono, monospace)" fontWeight="600">
          MESSAGE
        </text>
        <text x="330" y="18" fontSize="10" fill="var(--text-secondary)" letterSpacing="0.1em" fontFamily="var(--font-mono, monospace)" fontWeight="600">
          LANG
        </text>
        <text x="400" y="18" fontSize="10" fill="var(--brand-primary)" letterSpacing="0.1em" fontFamily="var(--font-mono, monospace)" fontWeight="700">
          SIM
        </text>
        <path d="M 428 12 L 434 12 L 431 16 Z" fill="var(--brand-primary)" />
        <text x="490" y="18" fontSize="10" fill="var(--text-secondary)" letterSpacing="0.1em" fontFamily="var(--font-mono, monospace)" fontWeight="600">
          DOMAIN
        </text>
        <text x="640" y="18" fontSize="10" fill="var(--text-secondary)" letterSpacing="0.1em" fontFamily="var(--font-mono, monospace)" fontWeight="600" textAnchor="end">
          SEEN
        </text>
      </g>

      {[
        {
          msg: 'Your BDO account will be suspended in 24 hours.',
          lang: 'EN',
          sim: '0.94',
          dom: 'bdo-secure.link',
          seen: 'Sep 20',
        },
        {
          msg: 'Ang inyong account ay pansamantalang naka-lock.',
          lang: 'TL',
          sim: '0.91',
          dom: 'bdo-verify.ph',
          seen: 'Sep 18',
        },
        {
          msg: 'Account mo temporarily blocked. Verify agad.',
          lang: 'TAG',
          sim: '0.92',
          dom: 'bdo-check.link',
          seen: 'Sep 16',
        },
        {
          msg: 'GCash account restriction — confirm identity now.',
          lang: 'EN',
          sim: '0.89',
          dom: 'gcash-help.link',
          seen: 'Sep 12',
        },
        {
          msg: 'GCash: i-verify ang account mo sa loob ng 24 oras.',
          lang: 'TL',
          sim: '0.87',
          dom: 'gcash-update.link',
          seen: 'Sep 09',
        },
      ].map((row, i) => (
        <g key={row.dom} transform={`translate(204, ${282 + i * 42})`}>
          {/* First row highlighted (selected) — reads as an interactive table */}
          {i === 0 && (
            <rect x="0" y="0" width="676" height="42" fill="var(--plum-08)" />
          )}
          {/* Zebra hint every other row */}
          {i % 2 === 1 && (
            <rect x="0" y="0" width="676" height="42" fill="color-mix(in srgb, var(--surface-canvas) 55%, transparent)" />
          )}
          <line x1="0" y1="42" x2="676" y2="42" stroke="var(--border-default)" />
          <text x="14" y="26" fontSize="12" fill="var(--text-primary)">
            {row.msg}
          </text>
          <rect
            x="326"
            y="12"
            width="30"
            height="18"
            rx="4"
            fill="var(--surface-canvas)"
            stroke="var(--brand-primary)"
          />
          <text
            x="341"
            y="24"
            fontSize="9"
            fill="var(--brand-primary)"
            textAnchor="middle"
            fontWeight="700"
            fontFamily="var(--font-mono, monospace)"
          >
            {row.lang}
          </text>
          {/* Similarity: number + tiny bar */}
          <text
            x="400"
            y="26"
            fontSize="12"
            fill="var(--text-primary)"
            fontWeight="700"
            fontFamily="var(--font-mono, monospace)"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {row.sim}
          </text>
          <rect x="434" y="20" width="42" height="4" rx="2" fill="var(--plum-14)" />
          <rect x="434" y="20" width={Number(row.sim) * 42} height="4" rx="2" fill="var(--brand-primary)" />
          <text
            x="490"
            y="26"
            fontSize="12"
            fill="var(--text-primary)"
            fontFamily="var(--font-mono, monospace)"
          >
            {row.dom}
          </text>
          <text
            x="640"
            y="26"
            fontSize="12"
            fill="var(--text-secondary)"
            textAnchor="end"
          >
            {row.seen}
          </text>
        </g>
      ))}

      {/* Footer strip — pagination */}
      <line x1="204" y1="502" x2="880" y2="502" stroke="var(--border-default)" />
      <text
        x="204"
        y="522"
        fontSize="10"
        fill="var(--text-secondary)"
        fontFamily="var(--font-mono, monospace)"
      >
        5 of 12 variants · sorted by similarity
      </text>
      {/* Pagination controls */}
      <g transform="translate(760, 508)">
        <rect x="0" y="0" width="24" height="20" rx="4" fill="var(--surface-canvas)" stroke="var(--border-default)" />
        <path d="M 14 6 L 10 10 L 14 14" fill="none" stroke="var(--text-secondary)" strokeWidth="1.4" strokeLinecap="round" />
        <rect x="30" y="0" width="24" height="20" rx="4" fill="var(--brand-primary)" />
        <text x="42" y="14" fontSize="10" fill="var(--text-on-brand)" textAnchor="middle" fontWeight="700" fontFamily="var(--font-mono, monospace)">
          1
        </text>
        <rect x="60" y="0" width="24" height="20" rx="4" fill="var(--surface-canvas)" stroke="var(--border-default)" />
        <text x="72" y="14" fontSize="10" fill="var(--text-primary)" textAnchor="middle" fontFamily="var(--font-mono, monospace)">
          2
        </text>
        <rect x="90" y="0" width="24" height="20" rx="4" fill="var(--surface-canvas)" stroke="var(--border-default)" />
        <path d="M 100 6 L 104 10 L 100 14" fill="none" stroke="var(--text-secondary)" strokeWidth="1.4" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function MetricBlock({
  label,
  value,
  delta,
  x,
}: {
  label: string;
  value: string;
  delta?: string;
  x: number;
}) {
  return (
    <g transform={`translate(${x}, 0)`}>
      <rect x="0" y="-4" width="152" height="64" rx="10" fill="var(--surface-canvas)" stroke="var(--border-default)" />
      <text
        x="14"
        y="16"
        fontSize="9"
        letterSpacing="0.14em"
        fill="var(--text-secondary)"
        fontFamily="var(--font-mono, monospace)"
      >
        {label.toUpperCase()}
      </text>
      <text x="14" y="44" fontSize="22" fontWeight="700" fill="var(--text-primary)" fontFamily="var(--font-mono, monospace)" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </text>
      {delta && (
        <g transform="translate(96, 34)">
          <path d="M 0 6 L 4 0 L 8 6 Z" fill="var(--status-verified)" />
          <text
            x="12"
            y="6"
            fontSize="10"
            fill="var(--status-verified)"
            fontWeight="700"
            fontFamily="var(--font-mono, monospace)"
          >
            {delta}
          </text>
        </g>
      )}
    </g>
  );
}

export default ProductShowcase;
