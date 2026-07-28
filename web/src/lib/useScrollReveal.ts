import { useEffect } from "react";

/**
 * Observes every [data-reveal] element currently in the DOM and adds
 * "reveal-visible" the first time each one enters the viewport.
 * Call once per page component; re-runs whenever the page's route changes
 * because the component (and its effect) remounts.
 */
export function useScrollReveal() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);
}
