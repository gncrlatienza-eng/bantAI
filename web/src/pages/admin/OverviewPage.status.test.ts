import { describe, expect, it } from 'vitest';
import { isOk } from './OverviewPage';

describe('Overview status badges', () => {
  it("treats the backend readiness value 'reachable' as healthy", () => {
    // backend/src/health/health.controller.ts returns { database: 'reachable' }.
    expect(isOk('reachable')).toBe(true);
  });

  it('keeps failure values unhealthy', () => {
    for (const bad of [
      'unreachable',
      'unready',
      'down',
      'error',
      '',
      null,
      undefined,
    ]) {
      expect(isOk(bad), String(bad)).toBe(false);
    }
  });

  it('still accepts the existing healthy values', () => {
    for (const good of ['ok', 'ready', 'healthy', 'operational', 'up']) {
      expect(isOk(good), good).toBe(true);
    }
  });
});
