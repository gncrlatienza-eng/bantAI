import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PhoneMock } from './PhoneMock';
import { APP, DEMO_ALERT, INDICATORS } from '../landingFixture';

describe('PhoneMock', () => {
  it('describes itself once and hides the mock UI from assistive tech', () => {
    const { container } = render(<PhoneMock screen="alert" />);
    const phone = screen.getByRole('img');
    expect(phone).toHaveAccessibleName(/BantAI Android app/);
    expect(container.querySelector('.pm__screen')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    // A picture of an app, not an app: nothing focusable.
    expect(container.querySelector('button, a, input')).toBeNull();
  });

  it('renders the alert screen with the app strings', () => {
    const { container } = render(<PhoneMock screen="alert" />);
    const text = container.textContent ?? '';
    expect(text).toContain(DEMO_ALERT.sender);
    expect(text).toContain(APP.alert.verdict);
    expect(text).toContain(APP.alert.whyFlagged);
    expect(text).toContain(INDICATORS[0].tag);
    expect(text).toContain(APP.alert.wave);
    expect(text).toContain(APP.alert.report);
    expect(text).toContain(APP.alert.block);
    expect(text).not.toMatch(/\d+%/);
  });

  it('renders the inbox with the flagged message badge', () => {
    const { container } = render(<PhoneMock screen="inbox" />);
    const text = container.textContent ?? '';
    expect(text).toContain(APP.inbox.title);
    expect(text).toContain(DEMO_ALERT.sender);
    expect(text).toContain(APP.inbox.scamBadge);
  });

  it('renders the threat analysis with confidence and indicators', () => {
    const { container } = render(<PhoneMock screen="analysis" />);
    const text = container.textContent ?? '';
    expect(text).toContain(APP.analysis.title);
    expect(text).toContain('97%');
    for (const i of INDICATORS) expect(text).toContain(i.tag);
  });

  it('renders the take-action screen with the report options', () => {
    const { container } = render(<PhoneMock screen="action" />);
    const text = container.textContent ?? '';
    expect(text).toContain(APP.action.title);
    for (const option of APP.action.options) expect(text).toContain(option);
  });
});
