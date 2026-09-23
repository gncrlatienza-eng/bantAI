/*
 * Landing-page reveal helper.
 *
 * A dead-simple IntersectionObserver hook every section uses to opt into a
 * subtle "enter once" transition. The element is tagged with `data-reveal`
 * so the landing.css motion vocabulary (`[data-reveal]` → `.is-in`) can
 * apply the transition. Once a node has entered, we stop observing it so
 * repeated scrolling never re-triggers.
 *
 * The hook exists on the landing page only — the portal has its own
 * motion budget and does not need this.
 *
 * Reduced motion: the observer still fires (to set `.is-in`), but the
 * landing.css rules under `prefers-reduced-motion: reduce` collapse the
 * transition to instant so nothing animates.
 */

import { useEffect, useRef } from 'react';

interface RevealOptions {
  /** rootMargin passed to IntersectionObserver. Default reveals slightly
   *  before the element scrolls fully into view. */
  rootMargin?: string;
  /** intersection ratio at which the node is considered "in". */
  threshold?: number;
}

export function useReveal<T extends HTMLElement = HTMLElement>(
  options: RevealOptions = {},
) {
  const rootRef = useRef<T | null>(null);
  const { rootMargin = '0px 0px -12% 0px', threshold = 0.12 } = options;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const targets = Array.from(
      root.querySelectorAll<HTMLElement>('[data-reveal]'),
    );
    if (targets.length === 0) return;

    // Signal to CSS that JS took over. Only now does the initial hidden
    // state apply. This means non-JS renderings and headless/print paths
    // continue to show every block at full opacity.
    root.classList.add('is-reveal-active');

    // Guard: if the browser lacks IntersectionObserver, reveal everything
    // immediately so nothing stays hidden.
    if (typeof IntersectionObserver === 'undefined') {
      targets.forEach((t) => t.classList.add('is-in'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin, threshold },
    );

    targets.forEach((t) => observer.observe(t));

    // Safety net: if the observer has not fired for a target within 3s
    // (e.g. in a synthetic full-page paint that skips scroll events), just
    // reveal it. Better to skip the animation than leave content hidden.
    const safety = window.setTimeout(() => {
      targets.forEach((t) => {
        if (!t.classList.contains('is-in')) {
          t.classList.add('is-in');
        }
      });
    }, 3000);

    return () => {
      window.clearTimeout(safety);
      observer.disconnect();
    };
  }, [rootMargin, threshold]);

  return rootRef;
}
