import React from 'react';

interface MediaLoopProps {
  webm: string;
  mp4: string;
  poster: string;
  label: string;
  className?: string;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Muted looping capture that plays only while at least half on screen.
 * Reduced motion, no IntersectionObserver, or a failed load → the poster image.
 */
export function MediaLoop({
  webm,
  mp4,
  poster,
  label,
  className,
}: MediaLoopProps) {
  const ref = React.useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = React.useState(false);
  const canAnimate =
    !failed &&
    !prefersReducedMotion() &&
    typeof globalThis.IntersectionObserver === 'function';

  React.useEffect(() => {
    const video = ref.current;
    if (!canAnimate || !video) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          void video.play()?.catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: [0, 0.5] },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [canAnimate]);

  if (!canAnimate) {
    return (
      <img
        className={className}
        src={poster}
        alt={label}
        loading="lazy"
        decoding="async"
      />
    );
  }
  // When every <source> fails, browsers fire `error` on the last source, not the video.
  const onError = () => setFailed(true);
  return (
    <video
      ref={ref}
      className={className}
      muted
      loop
      playsInline
      preload="none"
      poster={poster}
      aria-label={label}
      onError={onError}
    >
      <source src={webm} type="video/webm" />
      <source src={mp4} type="video/mp4" onError={onError} />
    </video>
  );
}
