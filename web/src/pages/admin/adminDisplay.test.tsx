import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import {
  ShortId,
  classificationKind,
  databaseKind,
  healthKind,
  formatUptime,
  humanizeEnum,
  middleTruncate,
} from './adminDisplay';

describe('healthKind', () => {
  it('reads every healthy word the backend sends as healthy', () => {
    for (const word of ['ok', 'OK', 'ready', 'reachable', 'healthy', 'up']) {
      expect(healthKind(word)).toBe('verified');
    }
  });

  it('never treats a word that only contains a healthy one as healthy', () => {
    expect(healthKind('unhealthy')).not.toBe('verified');
    expect(healthKind('not ready')).not.toBe('verified');
    expect(healthKind('unreachable')).toBe('threat');
  });

  it('leaves unknown or missing status neutral', () => {
    expect(healthKind('starting')).toBe('unknown');
    expect(healthKind(undefined)).toBe('unknown');
  });
});

describe('databaseKind', () => {
  it('is healthy only when the database and readiness both pass', () => {
    expect(databaseKind('reachable', 'ok')).toBe('verified');
    expect(databaseKind('reachable', 'degraded')).toBe('verified');
    expect(databaseKind('unreachable', 'ok')).toBe('threat');
  });
});

describe('classificationKind', () => {
  it('maps the three classes', () => {
    expect(classificationKind('Scam')).toBe('threat');
    expect(classificationKind('Spam')).toBe('suspicious');
    expect(classificationKind('Ham')).toBe('verified');
    expect(classificationKind(null)).toBe('unknown');
  });
});

describe('ShortId', () => {
  it('shows 8 characters and keeps the full id for hover and screen readers', () => {
    const id = 'ef11f568-4742-4566-a7a0-e7281bc53d38';
    render(<ShortId id={id} />);
    const el = screen.getByLabelText(id);
    expect(el.textContent).toBe('ef11f568…');
    expect(el.getAttribute('title')).toBe(id);
  });
});

describe('middleTruncate', () => {
  it('keeps short values and shortens long ones from the middle', () => {
    expect(middleTruncate('v1.2.0')).toBe('v1.2.0');
    const tag = 'candidate-2026-09-21-colab-C-local';
    const out = middleTruncate(tag);
    expect(out).toHaveLength(24);
    expect(out.startsWith('candidate-2')).toBe(true);
    expect(out.endsWith('colab-C-local')).toBe(false);
    expect(out.endsWith('ab-C-local')).toBe(true);
    expect(out).toContain('…');
  });
});

describe('formatUptime', () => {
  it('reads as minutes, hours or days', () => {
    expect(formatUptime(125)).toBe('Up 2m');
    expect(formatUptime(6545)).toBe('Up 1h 49m');
    expect(formatUptime(90000)).toBe('Up 1d 1h');
  });
});

describe('humanizeEnum', () => {
  it('turns enum values into sentence case', () => {
    expect(humanizeEnum('PAST_DUE')).toBe('Past due');
    expect(humanizeEnum('CONTRACT REVIEW')).toBe('Contract review');
    expect(humanizeEnum('SHIELD')).toBe('Shield');
  });
});
