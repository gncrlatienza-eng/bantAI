/*
 * Hero: the page's one demonstration. The phone plays the moment BantAI
 * exists for: a scam text arrives, it's marked "Likely scam", and the AI
 * Summary explains why. Pure CSS animation (no video weight), with a pause
 * control (WCAG 2.2.2) and a still end state under reduced motion.
 */
import React, { useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { AppPhone, ChatScreen, MessagesScreen } from '../app/AppKit';
import { AndroidCta } from '../components/AndroidCta';
import { DEMO_ALERT } from '../landingFixture';

export function Hero() {
  const [paused, setPaused] = useState(false);

  return (
    <section className="hero lv-hero" id="top" aria-labelledby="hero-title">
      <div className="landing__section-inner lv-hero__grid">
        <div className="lv-hero__copy">
          <h1 id="hero-title" className="lv-hero__title">
            Know a scam text before you tap.
          </h1>
          <p className="lv-hero__lede">
            BantAI becomes your SMS app and flags scam texts in English,
            Filipino and Taglish, then tells you why.
          </p>
          <div className="lv-cta-row">
            <AndroidCta />
            <a className="lv-btn lv-btn--ghost" href="#tour">
              See the real app
            </a>
          </div>
        </div>

        <div className="lv-stage" data-paused={paused ? 'true' : 'false'}>
          <AppPhone
            className="lv-stage__phone"
            label={`BantAI app demo: a text from ${DEMO_ALERT.sender} arrives, is marked Likely scam, and the AI Summary explains that it pushes a look-alike link.`}
          >
            <div className="lv-scene lv-scene--inbox">
              <MessagesScreen incoming />
            </div>
            <div className="lv-scene lv-scene--chat">
              <ChatScreen withSheet />
            </div>
          </AppPhone>
          <button
            type="button"
            className="lv-icon-btn lv-stage__pause"
            aria-pressed={paused}
            aria-label="Pause animation"
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? (
              <Play aria-hidden="true" strokeWidth={2} />
            ) : (
              <Pause aria-hidden="true" strokeWidth={2} />
            )}
          </button>
        </div>
      </div>
    </section>
  );
}

export default Hero;
