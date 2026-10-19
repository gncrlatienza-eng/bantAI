import { describe, expect, it } from 'vitest';
import {
  ANDROID_DISTRIBUTION,
  ANDROID_RELEASE,
  androidCtaLabel,
} from './android';

describe('Android distribution config', () => {
  it('stays in beta until a public install path is verified', () => {
    expect(ANDROID_DISTRIBUTION).toBe('beta');
    expect(androidCtaLabel()).toBe('Join the Android beta');
  });

  it('labels each mode for what it really offers', () => {
    expect(androidCtaLabel('tester')).toBe('Download tester build');
    expect(androidCtaLabel('public')).toBe('Get BantAI for Android');
  });

  it('documents the exact tester release', () => {
    expect(ANDROID_RELEASE.url).toContain(`/${ANDROID_RELEASE.tag}/`);
    expect(ANDROID_RELEASE.url).toMatch(/\.apk$/);
    expect(ANDROID_RELEASE.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});
