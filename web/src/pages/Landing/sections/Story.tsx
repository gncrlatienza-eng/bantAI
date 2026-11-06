/*
 * The landing page after the hero (plan v2, section 4): short beats, each
 * with one visual, and no two sections built the same way. App visuals are
 * the recreated app UI (../app/AppKit) or the real recordings and captures.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BellRing,
  CloudOff,
  Hand,
  MessageSquareText,
  Plus,
  ShieldCheck,
  ToggleRight,
} from 'lucide-react';
import {
  AppPhone,
  Bubble,
  Chip,
  Pills,
  Row,
  SetupScreen,
  SUMMARY_TEXT,
  WaveCard,
} from '../app/AppKit';
import { AndroidCta } from '../components/AndroidCta';
import { QrCode } from '../components/QrCode';
import { CAPTURES } from '../captures';
import { DEMO_VARIANTS, fullText, langTag } from '../landingFixture';
import { useReveal } from '../useReveal';
import { ANDROID_BETA_PATH, ANDROID_RELEASE } from '../../../config/android';

/* ---------------- How it works ---------------- */

const STEPS = [
  {
    icon: ToggleRight,
    title: 'Make BantAI your SMS app',
    body: 'Android only lets your default SMS app receive texts and block numbers, so BantAI asks for that role. Android shows its own consent screen first.',
  },
  {
    icon: BellRing,
    title: 'Every text gets checked',
    body: 'New messages are checked as they arrive. Likely scams go to Alerts instead of your inbox.',
  },
  {
    icon: Hand,
    title: 'You decide what happens',
    body: 'Report it, block the sender, or mark it safe. Nothing is deleted without you.',
  },
];

export function Steps() {
  const ref = useReveal<HTMLElement>();
  return (
    <section
      ref={ref}
      className="landing__section lv-steps"
      id="how-it-works"
      aria-labelledby="steps-title"
    >
      <div className="landing__section-inner lv-steps__grid">
        <div className="lv-steps__visual" data-reveal>
          <AppPhone
            className="lv-steps__phone"
            label="BantAI setup, step 4 of 5: Set as your SMS app. It lists the access it needs (receive and read, send messages, scan for threats) and a Set as default button."
          >
            <SetupScreen />
          </AppPhone>
        </div>
        <div className="lv-steps__copy">
          <h2 id="steps-title" className="lv-h2">
            Set it up once. It watches every text after that.
          </h2>
          <ol className="lv-steps__list">
            {STEPS.map(({ icon: Icon, title, body }) => (
              <li key={title} data-reveal>
                <span className="lv-steps__icon" aria-hidden="true">
                  <Icon strokeWidth={1.8} />
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Highlights (bento) ---------------- */

export function Highlights() {
  const ref = useReveal<HTMLElement>();
  return (
    <section
      ref={ref}
      className="landing__section lv-bento-section"
      aria-labelledby="highlights-title"
    >
      <div className="landing__section-inner">
        <header className="lv-head">
          <h2 id="highlights-title" className="lv-h2">
            Built for the texts you actually get.
          </h2>
        </header>
        <div className="lv-bento">
          <article className="lv-tile lv-tile--summary" data-reveal>
            <div className="lv-tile__copy">
              <h3>Explained, not just flagged</h3>
              <p>
                Every alert comes with an AI Summary that says what the text is
                after, in plain words.
              </p>
            </div>
            <figure
              className="lv-tile__art ak-scope"
              role="img"
              aria-label={`AI Summary marked Likely scam: ${SUMMARY_TEXT}`}
            >
              <div className="lv-summary" aria-hidden="true">
                <p className="ak-sheet__title">
                  <span className="ak-spark">✦</span> AI Summary
                </p>
                <Chip tone="danger">Likely scam</Chip>
                <p className="ak-label">WHAT IT&apos;S ABOUT</p>
                <p className="ak-sheet__text">{SUMMARY_TEXT}</p>
                <p className="ak-sheet__link">Report or block this sender ›</p>
              </div>
            </figure>
          </article>

          <article className="lv-tile lv-tile--inbox" data-reveal>
            <div className="lv-tile__copy">
              <h3>Your inbox, sorted</h3>
              <p>
                Real messages stay in All. Promos go to Spam, and texts it isn’t
                sure about wait in Unknown.
              </p>
            </div>
            <figure
              className="lv-tile__art ak-scope"
              role="img"
              aria-label="Message filters All, Spam, Unknown and Unread, with a data promo filed under Spam."
            >
              <div className="lv-inbox" aria-hidden="true">
                <Pills active="Spam" />
                <div className="ak-list">
                  <Row
                    sender="PROMO-DATA"
                    time="Yesterday"
                    preview="Get 30GB for 7 days! Reply YES to subscribe now."
                    chip={
                      <span className="ak-row__chip">
                        <Chip tone="warn">Spam</Chip>
                      </span>
                    }
                  />
                </div>
              </div>
            </figure>
          </article>

          <article className="lv-tile lv-tile--lang" data-reveal>
            <h3>Made for Philippine texts</h3>
            <p
              className="lv-tile__langs"
              aria-label="English, Filipino and Taglish"
            >
              <span>English</span>
              <span>Filipino</span>
              <span>Taglish</span>
            </p>
            <p>
              Trained on smishing seen in the Philippines, including texts that
              switch languages mid-sentence.
            </p>
          </article>

          <article className="lv-tile lv-tile--guide" data-reveal>
            <div className="lv-tile__copy">
              <h3>Already tapped the link?</h3>
              <p>
                A short guide walks you through the first hour, from your MPIN
                to reporting the sender.
              </p>
            </div>
            <figure
              className="lv-tile__art ak-scope"
              role="img"
              aria-label="Guide, What to do when scammed: change all passwords and MPIN, call your bank or e-wallet to freeze your account, report the sender to NTC, and block the sender in BantAI."
            >
              <div className="lv-guide" aria-hidden="true">
                <p className="lv-guide__title">What to do when scammed</p>
                <p className="lv-guide__quote">
                  Being scammed is not your fault. What you do next is what
                  matters.
                </p>
                <ol>
                  <li>Change all passwords and MPIN</li>
                  <li>Call your bank or e-wallet to freeze your account</li>
                  <li>Report the sender to NTC</li>
                  <li>Block the sender in BantAI</li>
                </ol>
              </div>
            </figure>
          </article>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Scam waves (the one intelligence visual) ---------------- */

export function ScamWaves() {
  const ref = useReveal<HTMLElement>({ threshold: 0.25 });
  const variants = (['en', 'fil', 'mixed'] as const)
    .map((lang) => DEMO_VARIANTS.find((v) => v.lang === lang))
    .filter(Boolean) as typeof DEMO_VARIANTS;
  return (
    <section
      ref={ref}
      className="landing__section lv-waves"
      id="scam-waves"
      aria-labelledby="waves-title"
    >
      <div className="landing__section-inner">
        <header className="lv-head">
          <p className="lv-eyebrow">Scam Waves</p>
          <h2 id="waves-title" className="lv-h2">
            One scam, many wordings. BantAI sees the pattern.
          </h2>
          <p className="lv-lede">
            Scammers reword the same lure in English, Filipino and Taglish and
            swap links every few days. BantAI groups them into one wave, so a
            new variant is recognised the day it lands.
          </p>
        </header>
        <div
          className="lv-waves__viz"
          role="img"
          aria-label="Three differently worded GCash scam texts, in English, Filipino and Taglish, grouped into one scam wave."
        >
          <ul className="lv-waves__texts ak-scope" aria-hidden="true">
            {variants.map((v, i) => (
              <li
                key={v.id}
                className="lv-waves__text"
                style={{ '--i': i } as React.CSSProperties}
                data-reveal
              >
                <span className="lv-lang">{langTag(v.lang)}</span>
                <Bubble>{fullText(v)}</Bubble>
              </li>
            ))}
          </ul>
          <div className="lv-waves__join" aria-hidden="true" data-reveal>
            <span />
          </div>
          <div
            className="lv-waves__card ak-scope"
            aria-hidden="true"
            data-reveal
          >
            <p className="lv-waves__card-label">In the Scam Waves tab</p>
            <WaveCard />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Privacy ---------------- */

const PRIVACY = [
  {
    icon: MessageSquareText,
    title: 'Full messages stay on your phone',
    body: 'Before a text is checked, links, numbers, emails, amounts and codes are removed. Only that masked text goes to BantAI’s server.',
  },
  {
    icon: CloudOff,
    title: 'Still works without a signal',
    body: 'No connection? A model on your phone checks the text instead.',
  },
  {
    icon: ShieldCheck,
    title: 'You choose what’s shared',
    body: 'Reports are sent for review only if you turn on “Help improve scam detection”, and they’re masked first.',
  },
];

export function Privacy() {
  return (
    <section
      className="landing__section lv-privacy"
      id="privacy"
      aria-labelledby="privacy-title"
    >
      <div className="landing__section-inner lv-privacy__grid">
        <div className="lv-privacy__intro">
          <h2 id="privacy-title" className="lv-h2">
            Your texts are yours.
          </h2>
          <p className="lv-lede">
            What BantAI reads, what it sends, and what stays your call.
          </p>
        </div>
        <ul className="lv-privacy__list">
          {PRIVACY.map(({ icon: Icon, title, body }) => (
            <li key={title}>
              <span className="lv-privacy__icon" aria-hidden="true">
                <Icon strokeWidth={1.8} />
              </span>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------------- Researchers & organizations ---------------- */

export function ForOrganizations() {
  return (
    <section className="lv-orgs" aria-labelledby="orgs-title">
      <div className="landing__section-inner">
        <div className="lv-orgs__panel">
          <div className="lv-orgs__copy">
            <p className="lv-eyebrow">For researchers &amp; organizations</p>
            <h2 id="orgs-title" className="lv-h2 lv-h2--sm">
              Studying smishing in the Philippines?
            </h2>
            <p className="lv-lede">
              The BantAI platform groups masked reports into scam campaigns,
              linked domains and trends, for teams that protect customers or
              study fraud.
            </p>
            <div className="lv-cta-row">
              <Link className="lv-btn lv-btn--dark" to="/platform">
                About the platform
              </Link>
              <Link className="lv-btn lv-btn--ghost" to="/request-access">
                Request access
              </Link>
            </div>
          </div>
          <figure className="lv-orgs__shot">
            <img
              src={CAPTURES.hiwConnect}
              width={1600}
              height={1000}
              loading="lazy"
              decoding="async"
              alt="BantAI platform, campaign detail for the GCash account-suspension lure: 148 masked messages, 4 linked look-alike domains, and each message classified as Scam."
            />
          </figure>
        </div>
      </div>
    </section>
  );
}

/* ---------------- FAQ ---------------- */

const FAQ: Array<[string, React.ReactNode]> = [
  [
    'Why does BantAI need to be my default SMS app?',
    'Android only lets the default SMS app receive and manage your texts and block numbers. BantAI asks through Android’s own consent screen, and you can switch back in Settings, Apps, Default apps, SMS app.',
  ],
  [
    'Can I install it now?',
    'BantAI is in beta with invited testers. In the Philippines, Google Play Protect blocks SMS apps installed from a browser, so there is no public download yet, and we will never ask you to turn Play Protect off.',
  ],
  [
    'Which phones does it work on?',
    `${ANDROID_RELEASE.requires}. iPhone isn’t supported, because iOS doesn’t let apps read your text messages.`,
  ],
  [
    'Does it read all my messages?',
    'It checks each incoming text to decide whether it looks like a scam. Links, numbers, emails, amounts and codes are removed before anything leaves your phone, and nothing is sent for review unless you turn on “Help improve scam detection”.',
  ],
  [
    'Can it be wrong?',
    'Yes. Every alert explains why it was flagged, and you can mark a message safe, spam or scam. Your choice always wins.',
  ],
  [
    'Is it free?',
    'Yes. BantAI is a university thesis project and free to use.',
  ],
];

export function Faq() {
  return (
    <section
      className="landing__section lv-faq"
      id="faq"
      aria-labelledby="faq-title"
    >
      <div className="landing__section-inner lv-faq__grid">
        <div className="lv-faq__intro">
          <h2 id="faq-title" className="lv-h2">
            Questions, answered.
          </h2>
          <p className="lv-lede">
            Anything else? The beta page covers installing and requirements.
          </p>
          <Link className="lv-textlink" to={ANDROID_BETA_PATH}>
            About the Android beta
            <ArrowRight aria-hidden="true" strokeWidth={2} />
          </Link>
        </div>
        <div className="lv-faq__list">
          {FAQ.map(([q, a]) => (
            <details key={q} className="lv-faq__item">
              <summary>
                {q}
                <Plus aria-hidden="true" strokeWidth={2} />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Final CTA ---------------- */

export function FinalCall() {
  return (
    <section className="lv-final" aria-labelledby="final-title">
      <div className="landing__section-inner">
        <div className="lv-final__panel">
          <div className="lv-final__copy">
            <h2 id="final-title" className="lv-final__title">
              Get ahead of the next scam text.
            </h2>
            <p className="lv-final__body">
              Free. For {ANDROID_RELEASE.requires}.
            </p>
            <AndroidCta className="lv-btn lv-btn--light" />
          </div>
          <div className="lv-final__qr">
            <QrCode
              path={ANDROID_BETA_PATH}
              label="QR code that opens the BantAI Android beta page on your phone."
            />
            <p>Scan to open on your phone</p>
          </div>
        </div>
      </div>
    </section>
  );
}
