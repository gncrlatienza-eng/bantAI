/*
 * Landing page composer. One scrollable experience:
 *
 *   Hero → Threat Context → How It Works → Product Showcase →
 *   Campaign Intelligence → Transparency → About → Final CTA
 *
 * Each section owns its own copy, layout, and motion. This file just wires
 * them into the PublicShell.
 */

import React from 'react';
import { PublicShell } from '../../components/appshell/PublicShell';
import { Hero } from './sections/Hero';
import { ThreatContext } from './sections/ThreatContext';
import { HowItWorks } from './sections/HowItWorks';
import { ProductShowcase } from './sections/ProductShowcase';
import { CampaignIntelligence } from './sections/CampaignIntelligence';
import { Transparency } from './sections/Transparency';
import { About } from './sections/About';
import { FinalCta } from './sections/FinalCta';
import './landing.css';

export const LandingPage: React.FC = () => {
  // Root ref exists so the shared reveal hook (used per-section below) can
  // observe descendants without each section needing its own observer.
  return (
    <PublicShell>
      <div className="landing">
        <Hero />
        <ThreatContext />
        <HowItWorks />
        <ProductShowcase />
        <CampaignIntelligence />
        <Transparency />
        <About />
        <FinalCta />
      </div>
    </PublicShell>
  );
};

export default LandingPage;
