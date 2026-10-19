import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MediaLoop } from './MediaLoop';

const props = {
  webm: 'a.webm',
  mp4: 'a.mp4',
  poster: 'a.webp',
  label: 'Portal walkthrough',
};
const g = globalThis as unknown as { IntersectionObserver?: unknown };
type Entry = { isIntersecting: boolean; intersectionRatio: number };
let ioCallback: ((entries: Entry[]) => void) | null = null;

function mockMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: reduce && q.includes('reduce'),
    media: q,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  }));
}
function mockIO() {
  g.IntersectionObserver = class {
    constructor(cb: (entries: Entry[]) => void) {
      ioCallback = cb;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
afterEach(() => {
  ioCallback = null;
  delete g.IntersectionObserver;
});

describe('MediaLoop', () => {
  it('shows only the poster when the visitor prefers reduced motion', () => {
    mockMotion(true);
    mockIO();
    const { container } = render(<MediaLoop {...props} />);
    expect(screen.getByAltText('Portal walkthrough')).toHaveAttribute(
      'src',
      'a.webp',
    );
    expect(container.querySelector('video')).toBeNull();
  });

  it('shows only the poster when IntersectionObserver is unavailable', () => {
    mockMotion(false);
    const { container } = render(<MediaLoop {...props} />);
    expect(container.querySelector('video')).toBeNull();
    expect(screen.getByAltText('Portal walkthrough')).toBeInTheDocument();
  });

  it('renders a muted, inline, lazy video with webm + mp4 sources', () => {
    mockMotion(false);
    mockIO();
    const { container } = render(<MediaLoop {...props} />);
    const video = container.querySelector('video')!;
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute('playsinline');
    expect(video).toHaveAttribute('preload', 'none');
    expect(video).toHaveAttribute('poster', 'a.webp');
    expect(
      Array.from(video.querySelectorAll('source')).map((s) =>
        s.getAttribute('type'),
      ),
    ).toEqual(['video/webm', 'video/mp4']);
  });

  it('plays when half visible and pauses when scrolled away', () => {
    mockMotion(false);
    mockIO();
    const play = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockResolvedValue();
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, 'pause')
      .mockImplementation(() => {});
    render(<MediaLoop {...props} />);
    ioCallback!([{ isIntersecting: true, intersectionRatio: 0.6 }]);
    expect(play).toHaveBeenCalled();
    ioCallback!([{ isIntersecting: false, intersectionRatio: 0 }]);
    expect(pause).toHaveBeenCalled();
  });

  it('falls back to the poster image when the video fails to load', () => {
    mockMotion(false);
    mockIO();
    const { container } = render(<MediaLoop {...props} />);
    const sources = container.querySelectorAll('source');
    fireEvent.error(sources[sources.length - 1]);
    expect(container.querySelector('video')).toBeNull();
    expect(screen.getByAltText('Portal walkthrough')).toHaveAttribute(
      'src',
      'a.webp',
    );
  });
});
