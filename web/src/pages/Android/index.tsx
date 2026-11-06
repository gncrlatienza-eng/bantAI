/*
 * /android — the Android beta page. The public landing button leads here
 * while distribution is in beta (src/config/android.ts): Play Protect's
 * enhanced fraud protection, on by default in the Philippines, blocks SMS
 * apps installed from a browser, so there is no public download yet.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { PublicShell } from '../../components/appshell/PublicShell';
import { ANDROID_DISTRIBUTION, ANDROID_RELEASE } from '../../config/android';
import '../Landing/landing.css';
import '../Landing/landing-v2.css';
import './android.css';

const TESTER_MAIL =
  'mailto:research@bantai.ph?subject=' +
  encodeURIComponent('BantAI Android beta: tester invite') +
  '&body=' +
  encodeURIComponent('Phone brand and model:\nAndroid version:\n');

export function AndroidPage() {
  return (
    <PublicShell>
      <div className="landing lv ab">
        <section className="landing__section-inner ab__head">
          <p className="landing__eyebrow">BantAI for Android</p>
          <h1 className="lv-hero__title ab__title">The Android beta</h1>
          <p className="lv-hero__lede">
            BantAI is being tested with invited testers before a public release.
            Here’s what to expect and how to join.
          </p>
          <div className="ab__status" role="note">
            <b>Why there’s no download button yet</b>
            <p>
              In the Philippines, Google Play Protect blocks apps that read SMS
              when they’re installed from a browser. That protection is good for
              you, and we won’t ask you to turn it off. We’re testing a proper
              install path first.
            </p>
          </div>
          <div className="landing__cta-row">
            <a className="landing__cta-primary" href={TESTER_MAIL}>
              Ask for a tester invite
            </a>
            <Link className="landing__cta-ghost" to="/">
              Back to BantAI
            </Link>
          </div>
        </section>

        <section className="landing__section-inner ab__grid">
          <div>
            <h2 className="ab__h2">What you need</h2>
            <ul className="ab__list">
              <li>{ANDROID_RELEASE.requires}</li>
              <li>A Philippine SIM for real-world texts</li>
              <li>
                About {ANDROID_RELEASE.sizeLabel} of free space (the scam model
                is built in, so it works offline)
              </li>
            </ul>
          </div>
          <div>
            <h2 className="ab__h2">BantAI becomes your SMS app</h2>
            <p className="ab__p">
              To check each text as it arrives, sort your inbox and block
              numbers, BantAI asks to be your default SMS app. Android shows its
              own consent screen and nothing changes until you approve.
            </p>
            <ol className="ab__list ab__list--num">
              <li>Open BantAI and follow setup to “Set as your SMS app”.</li>
              <li>Tap “Set as default”, then confirm in Android’s dialog.</li>
              <li>
                To switch back later: Settings → Apps → Default apps → SMS app.
              </li>
            </ol>
          </div>
        </section>

        {ANDROID_DISTRIBUTION !== 'beta' && (
          <section className="landing__section-inner ab__release">
            <h2 className="ab__h2">Current tester build</h2>
            <dl>
              <dt>Version</dt>
              <dd>
                {ANDROID_RELEASE.version} ({ANDROID_RELEASE.published})
              </dd>
              <dt>File</dt>
              <dd>
                {ANDROID_RELEASE.fileName}, {ANDROID_RELEASE.sizeLabel}
              </dd>
              <dt>SHA-256</dt>
              <dd className="ab__mono">{ANDROID_RELEASE.sha256}</dd>
            </dl>
          </section>
        )}
      </div>
    </PublicShell>
  );
}

export default AndroidPage;
