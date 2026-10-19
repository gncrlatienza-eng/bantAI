/// <reference types="node" />
// The app tsconfig only loads vite/client types; this test reads CSS source
// from disk (vitest stubs `?raw` CSS imports to ''), so it opts into Node types.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (rel: string) =>
  readFileSync(new URL(rel, import.meta.url), 'utf8');
const css = read('./landing.css');
const hiw = read('./sections/how-it-works.css');

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

describe('landing text contrast', () => {
  it('overrides secondary text with an AA colour on every landing surface', () => {
    const match = css.match(
      /\.landing\s*{[^}]*--text-secondary:\s*(#[0-9a-f]{6})/i,
    );
    expect(match, '.landing must set --text-secondary').not.toBeNull();
    // mineral-fog canvas, porcelain cards, warm section mix (measured #e3dfd8)
    for (const bg of ['#f2efe8', '#fbf9f4', '#e3dfd8']) {
      expect(contrast(match![1], bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('does not dim inactive How-It-Works steps with opacity', () => {
    const stepBlock = hiw.match(/\.hiw__step\s*{[^}]*}/)?.[0] ?? '';
    expect(stepBlock).not.toMatch(/opacity\s*:/);
  });
});
