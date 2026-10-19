import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { verifyAssets } from './verify-assets.mjs';

function dirWith(files) {
  const dir = mkdtempSync(join(tmpdir(), 'landing-assets-'));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

describe('verifyAssets', () => {
  it('passes synthetic text', () => {
    const dir = dirWith({
      'hiw-detect.webp': 'x',
      'hiw-detect.txt': 'GCASH-NOTICE Your GCash account will be suspended. Verify: gcash-secure.example Demo Analyst +63 9•• ••• 0132',
    });
    assert.deepEqual(verifyAssets(dir), { ok: true, problems: [] });
  });

  it('allows the synthetic demo login number in either form', () => {
    const dir = dirWith({ 'a.png': 'x', 'a.txt': 'Signed in as +639000000132 (09000000132)' });
    assert.equal(verifyAssets(dir).ok, true);
  });

  it('fails closed when a capture has no sidecar text', () => {
    const dir = dirWith({ 'hero-alert.mp4': 'x' });
    const result = verifyAssets(dir);
    assert.equal(result.ok, false);
    assert.match(result.problems[0], /hero-alert\.mp4.*no sidecar/);
  });

  for (const [label, leak] of [
    ['team name', 'Reymark De Castro'],
    ['real email', 'someone@gmail.com'],
    ['unmasked number', '+63 917 555 0132'],
    ['local-format number', '0917 555 0132'],
    ['production host', 'bantai-student-api.azurecontainerapps.io'],
    ['old fake host', 'bantai.ph/admin'],
    ['non-example lure', 'gcash-help.link'],
  ]) {
    it(`rejects ${label}`, () => {
      const dir = dirWith({ 'ps-portal.webp': 'x', 'ps-portal.txt': `Campaigns ${leak}` });
      assert.equal(verifyAssets(dir).ok, false);
    });
  }

  it('shares one sidecar across poster and video variants', () => {
    const dir = dirWith({
      'hero-alert.mp4': 'x', 'hero-alert.webm': 'x', 'hero-alert-poster.webp': 'x',
      'hero-alert.txt': 'Likely Smishing',
    });
    assert.equal(verifyAssets(dir).ok, true);
  });
});
