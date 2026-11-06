/*
 * Product Showcase — the two BantAI surfaces side by side.
 *
 * Left  — HTML replica of the Android app's "Choose an action" screen
 *         (TakeActionScreen), filled from the landing demo fixture.
 * Right — a real capture of the admin portal running on synthetic demo data
 *         (tools/landing-capture), as a muted loop with a poster fallback.
 *
 * Captions say which is which so nothing passes for something it isn't.
 */

import React from 'react';
import { useReveal } from '../useReveal';
import { BrowserFrame } from '../components/BrowserFrame';
import { MediaLoop } from '../components/MediaLoop';
import { CAPTURES } from '../captures';
import { PhoneMock } from '../components/PhoneMock';
import './product-showcase.css';
import { DEMO_PORTAL_HOST } from '../landingFixture';

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
            The same detection drives the alert on someone&apos;s phone and the
            analyst&apos;s campaign view.
          </p>
        </div>

        <div className="ps__grid">
          <figure className="ps__mobile" data-reveal data-reveal-delay="1">
            <figcaption className="ps__caption">
              <span className="ps__caption-dot" />
              Android app · Screen replica
            </figcaption>
            <PhoneMock screen="action" />
          </figure>

          <figure className="ps__web" data-reveal data-reveal-delay="2">
            <figcaption className="ps__caption">
              <span className="ps__caption-dot" />
              Portal · Real capture, demo data
            </figcaption>
            <BrowserFrame url={`${DEMO_PORTAL_HOST}/admin/campaigns`}>
              <MediaLoop
                {...CAPTURES.psPortalLoop}
                label="BantAI admin portal: the campaigns list, then the GCash campaign's masked messages"
              />
            </BrowserFrame>
          </figure>
        </div>
      </div>
    </section>
  );
}

export default ProductShowcase;
