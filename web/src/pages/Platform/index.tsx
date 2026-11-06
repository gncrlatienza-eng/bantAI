/*
 * /platform — the BantAI platform for researchers and organizations. The
 * landing page keeps the Android app central and links here; the campaign
 * intelligence, portal walkthrough and review model live on this page.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { PublicShell } from '../../components/appshell/PublicShell';
import { ThreatContext } from '../Landing/sections/ThreatContext';
import { HowItWorks } from '../Landing/sections/HowItWorks';
import { CampaignIntelligence } from '../Landing/sections/CampaignIntelligence';
import { ProductShowcase } from '../Landing/sections/ProductShowcase';
import { Transparency } from '../Landing/sections/Transparency';
import { About } from '../Landing/sections/About';
import '../Landing/landing.css';
import '../Landing/landing-v2.css';

export function PlatformPage() {
  return (
    <PublicShell>
      <div className="landing lv">
        <section className="lv-hero" aria-labelledby="platform-title">
          <div className="landing__section-inner">
            <p className="landing__eyebrow">
              For researchers &amp; organizations
            </p>
            <h1 id="platform-title" className="lv-hero__title">
              Smishing, seen as campaigns.
            </h1>
            <p className="lv-hero__lede">
              The BantAI platform groups reports from the Android app into scam
              campaigns, indicators and trends, reviewed before anything is
              shared.
            </p>
            <div className="landing__cta-row">
              <Link className="landing__cta-primary" to="/request-access">
                Request access
              </Link>
              <Link className="landing__cta-ghost" to="/">
                About the Android app
              </Link>
            </div>
          </div>
        </section>
        <ThreatContext />
        <HowItWorks />
        <CampaignIntelligence />
        <ProductShowcase />
        <Transparency />
        <About />
      </div>
    </PublicShell>
  );
}

export default PlatformPage;
