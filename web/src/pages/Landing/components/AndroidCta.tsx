/*
 * The one Android call to action, labelled for the current distribution
 * mode (config/android.ts): the beta page while installs aren't verified,
 * the tester APK only in tester mode.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import {
  ANDROID_BETA_PATH,
  ANDROID_DISTRIBUTION,
  ANDROID_RELEASE,
  androidCtaLabel,
} from '../../../config/android';

export function AndroidCta({
  className = 'lv-btn lv-btn--primary',
}: {
  className?: string;
}) {
  return ANDROID_DISTRIBUTION === 'tester' ? (
    <a className={className} href={ANDROID_RELEASE.url}>
      {androidCtaLabel()}
    </a>
  ) : (
    <Link className={className} to={ANDROID_BETA_PATH}>
      {androidCtaLabel()}
    </Link>
  );
}
