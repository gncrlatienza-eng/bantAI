/*
 * The real app: BantAI 1.7's first-run tour, screen-recorded on a phone
 * (assets/landing/demo/MANIFEST.md covers the cut and the PII review).
 * It plays muted while on screen; the chapter list beside it follows the
 * video and seeks it, and doubles as the video's text description.
 * Reduced motion: nothing plays until the visitor presses play.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import tourMp4 from '../../../assets/landing/demo/bantai-tour.mp4';
import tourWebm from '../../../assets/landing/demo/bantai-tour.webm';
import tourPoster from '../../../assets/landing/demo/bantai-tour-poster.webp';

/** Start times (s) of each tour card in bantai-tour.mp4. */
const CHAPTERS = [
  {
    at: 0,
    title: 'All',
    body: 'Your real messages, checked and found legitimate.',
  },
  {
    at: 3.25,
    title: 'Spam',
    body: 'Promos and marketing blasts, kept out of your way.',
  },
  {
    at: 6.25,
    title: 'Unknown',
    body: 'Texts it isn’t sure about, with their links hidden.',
  },
  {
    at: 10.5,
    title: 'Alerts',
    body: 'Likely scams land here instead of your inbox.',
  },
  {
    at: 14,
    title: 'Swipe to act',
    body: 'Report or block a sender without opening the text.',
  },
  {
    at: 15.75,
    title: 'Scam Waves',
    body: 'One scam sent to many people, grouped so you can spot it.',
  },
] as const;

function chapterAt(time: number): number {
  let index = 0;
  CHAPTERS.forEach((c, i) => {
    if (time >= c.at) index = i;
  });
  return index;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Tour() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  // Set once the visitor pauses, so scrolling back never overrides them.
  const userPaused = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || typeof IntersectionObserver === 'undefined') return;
    if (prefersReducedMotion()) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !userPaused.current) {
          void video.play()?.catch(() => {});
        } else if (!entry.isIntersecting) {
          video.pause();
        }
      },
      { threshold: 0.45 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  // On phones the chapters are a swipeable row: keep the current one in view
  // (horizontally only, so the page itself never scrolls).
  useEffect(() => {
    const list = listRef.current;
    if (!list || list.scrollWidth <= list.clientWidth) return;
    const item = list.children[active] as HTMLElement | undefined;
    if (!item) return;
    list.scrollTo({
      left: item.offsetLeft - 16,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  }, [active]);

  function toggle() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      userPaused.current = false;
      void video.play()?.catch(() => {});
    } else {
      userPaused.current = true;
      video.pause();
    }
  }

  function seek(index: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = CHAPTERS[index].at + 0.05;
    setActive(index);
    userPaused.current = false;
    void video.play()?.catch(() => {});
  }

  const chapterButton = (index: number) => {
    const c = CHAPTERS[index];
    return (
      <li key={c.title}>
        <button
          type="button"
          className="lv-chapter"
          aria-current={active === index ? 'step' : undefined}
          onClick={() => seek(index)}
        >
          <b>{c.title}</b>
          <span>{c.body}</span>
        </button>
      </li>
    );
  };

  return (
    <section
      className="landing__section lv-tour"
      id="tour"
      aria-labelledby="tour-title"
    >
      <div className="landing__section-inner lv-tour__stage">
        <header className="lv-tour__head">
          <h2 id="tour-title" className="lv-h2">
            The real app, on a real phone.
          </h2>
          <p className="lv-lede">
            BantAI’s first-run tour, recorded on an Android phone. Tap a step to
            jump to it.
          </p>
        </header>

        <ol ref={listRef} className="lv-tour__chapters">
          {CHAPTERS.map((_, i) => chapterButton(i))}
        </ol>

        <figure className="lv-tour__device">
          <div className="ak-phone ak-phone--video">
            <div className="ak-phone__screen">
              <video
                ref={videoRef}
                muted
                loop
                playsInline
                preload="none"
                poster={tourPoster}
                aria-label="Screen recording of the BantAI app tour: the All, Spam and Unknown filters, the Alerts tab, swiping an alert to act on it, and Scam Waves."
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onTimeUpdate={(e) => {
                  const next = chapterAt(e.currentTarget.currentTime);
                  setActive((prev) => (prev === next ? prev : next));
                }}
              >
                <source src={tourWebm} type="video/webm" />
                <source src={tourMp4} type="video/mp4" />
              </video>
            </div>
          </div>
          <button
            type="button"
            className="lv-icon-btn lv-tour__toggle"
            aria-label={
              playing ? 'Pause the tour video' : 'Play the tour video'
            }
            onClick={toggle}
          >
            {playing ? (
              <Pause aria-hidden="true" strokeWidth={2} />
            ) : (
              <Play aria-hidden="true" strokeWidth={2} />
            )}
          </button>
        </figure>
      </div>
    </section>
  );
}
