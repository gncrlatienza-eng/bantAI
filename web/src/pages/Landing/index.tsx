/*
 * Landing page (plan v2, docs/redesign/landing-redesign-plan.md):
 *
 *   Hero (one demonstration) > How it works > Highlights > The real app
 *   (screen recording) > Scam waves > Privacy > Researchers & organizations
 *   (to /platform) > FAQ > Final CTA
 *
 * The Android app is the centre; the portal story lives on /platform.
 */

import React from 'react';
import { PublicShell } from '../../components/appshell/PublicShell';
import { Hero } from './sections/Hero';
import { Tour } from './sections/Tour';
import {
  Faq,
  FinalCall,
  ForOrganizations,
  Highlights,
  Privacy,
  ScamWaves,
  Steps,
} from './sections/Story';
import './landing.css';
import './landing-v2.css';

export const LandingPage: React.FC = () => {
  return (
    <PublicShell>
      <div className="landing lv">
        <Hero />
        <Steps />
        <Highlights />
        <Tour />
        <ScamWaves />
        <Privacy />
        <ForOrganizations />
        <Faq />
        <FinalCall />
      </div>
    </PublicShell>
  );
};

export default LandingPage;
