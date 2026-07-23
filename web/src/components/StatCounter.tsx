import { useEffect, useRef, useState } from "react";

/** Parses "10,000+" -> { target: 10000, prefix: "", suffix: "+" } etc. Returns null for non-numeric values like "Filipino-trained". */
function parseValue(raw: string) {
  if (!/\d/.test(raw)) return null;
  const match = raw.match(/^([^\d]*)([\d,.]+)(.*)$/);
  if (!match) return null;
  const [, prefix, numeric, suffix] = match;
  const decimals = numeric.includes(".") ? numeric.split(".")[1].length : 0;
  const target = Number(numeric.replace(/,/g, ""));
  return { prefix, target, suffix, decimals };
}

function formatValue(value: number, decimals: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function StatCounter({ value, durationMs = 1400 }: { value: string; durationMs?: number }) {
  const parsed = parseValue(value);
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || !parsed) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (now: number) => {
            const progress = Math.min((now - start) / durationMs, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(parsed.target * eased);
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [parsed, durationMs]);

  if (!parsed) {
    return <span ref={ref}>{value}</span>;
  }

  return (
    <span ref={ref}>
      {parsed.prefix}
      {formatValue(display, parsed.decimals)}
      {parsed.suffix}
    </span>
  );
}
