import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserFrame } from './BrowserFrame';

describe('BrowserFrame', () => {
  it('renders the capture inside a viewport under decorative browser chrome', () => {
    const { container } = render(
      <BrowserFrame url="portal.bantai.example/admin/campaigns">
        <img src="x.webp" alt="Campaign detail" />
      </BrowserFrame>,
    );
    expect(
      screen.getByAltText('Campaign detail').closest('.bf__viewport'),
    ).not.toBeNull();
    expect(container.querySelector('.bf__chrome')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('shows the URL as real text', () => {
    render(
      <BrowserFrame url="portal.bantai.example/admin/campaigns">
        <img src="x.webp" alt="Campaign detail" />
      </BrowserFrame>,
    );
    expect(
      screen.getByText('portal.bantai.example/admin/campaigns'),
    ).toBeInTheDocument();
  });
});
