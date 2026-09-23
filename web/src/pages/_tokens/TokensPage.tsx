/*
 * Dev-only design token surface.
 *
 * Renders every Layer 2 semantic token with a swatch, sample text, and
 * a live WCAG 2.2 contrast ratio. Ratios are computed from the resolved
 * CSS variable values at runtime, so if a hex value changes in palette.css
 * the readouts update on the next reload.
 *
 * Registered only when import.meta.env.DEV is true. See AppRoutes.tsx.
 */

import React from 'react';

/* ---------- Contrast math (WCAG 2.2 relative luminance) ---------- */

function hexToRgb(hex: string): [number, number, number] | null {
  const cleaned = hex.trim().replace(/^#/, '');
  if (cleaned.length !== 3 && cleaned.length !== 6) return null;
  const expanded =
    cleaned.length === 3
      ? cleaned
          .split('')
          .map((c) => c + c)
          .join('')
      : cleaned;
  const num = parseInt(expanded, 16);
  if (Number.isNaN(num)) return null;
  return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff];
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a: string, b: string): number | null {
  const rgbA = hexToRgb(a);
  const rgbB = hexToRgb(b);
  if (!rgbA || !rgbB) return null;
  const lA = luminance(rgbA);
  const lB = luminance(rgbB);
  const [hi, lo] = lA > lB ? [lA, lB] : [lB, lA];
  return (hi + 0.05) / (lo + 0.05);
}

function resolveVar(name: string): string {
  if (typeof window === 'undefined') return '';
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  if (raw.startsWith('#')) return raw;
  if (raw.startsWith('var(')) {
    const inner = raw.slice(4, -1).trim();
    return resolveVar(inner);
  }
  return raw;
}

/* ---------- Token registry ---------- */

type TokenRow = {
  name: string;
  role: string;
  /* Optional pairs the token is intended to be seen against. */
  contrastAgainst?: string[];
};

const FOUNDATION: TokenRow[] = [
  { name: '--surface-canvas', role: 'Page background' },
  { name: '--surface-raised', role: 'Cards, panels, sidebar' },
  { name: '--surface-selected', role: 'Selected nav / brand tint' },
  {
    name: '--text-primary',
    role: 'Headings, numbers, high-emphasis body',
    contrastAgainst: ['--surface-canvas', '--surface-raised'],
  },
  {
    name: '--text-secondary',
    role: 'Labels, muted metadata',
    contrastAgainst: ['--surface-canvas', '--surface-raised'],
  },
];

const IDENTITY: TokenRow[] = [
  {
    name: '--brand-primary',
    role: 'Identity, primary action, active navigation',
    contrastAgainst: ['--surface-canvas'],
  },
  { name: '--brand-soft', role: 'Selected background tint' },
  {
    name: '--action-primary-bg',
    role: 'Primary CTA background',
    contrastAgainst: ['--action-primary-text'],
  },
];

const INFO: TokenRow[] = [
  {
    name: '--info-fg',
    role: 'AI-generated insight, model metadata',
    contrastAgainst: ['--surface-canvas', '--surface-raised'],
  },
];

const SEMANTIC: TokenRow[] = [
  {
    name: '--status-unknown',
    role: 'Insufficient conclusion (NOT safe)',
    contrastAgainst: ['--surface-canvas'],
  },
  {
    name: '--status-verified',
    role: 'Verified / benign',
    contrastAgainst: ['--surface-canvas'],
  },
  {
    name: '--status-suspicious',
    role: 'Investigate',
    contrastAgainst: ['--surface-canvas'],
  },
  {
    name: '--status-threat',
    role: 'Likely smishing',
    contrastAgainst: ['--surface-canvas', '--text-on-threat'],
  },
  {
    name: '--status-critical',
    role: 'Critical (only if backend defines it)',
    contrastAgainst: ['--surface-canvas', '--text-on-threat'],
  },
];

const CHART: TokenRow[] = [
  { name: '--chart-1', role: 'Categorical series 1' },
  { name: '--chart-2', role: 'Categorical series 2' },
  { name: '--chart-3', role: 'Categorical series 3' },
  { name: '--chart-4', role: 'Categorical series 4' },
  { name: '--chart-5', role: 'Categorical series 5' },
];

/* Semantic status glyphs. Unicode placeholders; Phase D swaps for Phosphor. */
const STATUS_GLYPHS: Record<string, string> = {
  '--status-unknown': '?',
  '--status-verified': '✓',
  '--status-suspicious': '◆',
  '--status-threat': '▲',
  '--status-critical': '▲',
};

const STATUS_LABELS: Record<string, string> = {
  '--status-unknown': 'Unknown',
  '--status-verified': 'Verified',
  '--status-suspicious': 'Suspicious',
  '--status-threat': 'Likely Smishing',
  '--status-critical': 'Critical',
};

/* ---------- UI ---------- */

function ContrastBadge({ ratio }: { ratio: number | null }) {
  if (ratio == null) {
    return <span style={{ color: 'var(--text-secondary)' }}>ratio n/a</span>;
  }
  const rounded = ratio.toFixed(2);
  const passAaBody = ratio >= 4.5;
  const passAaLarge = ratio >= 3;
  const passAaaBody = ratio >= 7;
  const label = passAaaBody
    ? 'AAA body'
    : passAaBody
      ? 'AA body'
      : passAaLarge
        ? 'AA large only'
        : 'Fail';
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.75rem',
        color: passAaBody ? 'var(--status-verified)' : 'var(--status-threat)',
      }}
    >
      {rounded}:1 &middot; {label}
    </span>
  );
}

function Swatch({ token }: { token: TokenRow }) {
  const [resolved, setResolved] = React.useState<string>('');
  React.useEffect(() => {
    setResolved(resolveVar(token.name));
  }, [token.name]);

  return (
    <li
      style={{
        display: 'grid',
        gridTemplateColumns: '80px 1fr',
        gap: '16px',
        alignItems: 'center',
        padding: '12px 16px',
        background: 'var(--surface-raised)',
        borderRadius: 8,
      }}
    >
      <div
        aria-hidden
        style={{
          width: 80,
          height: 56,
          borderRadius: 6,
          background: `var(${token.name})`,
          border: '1px solid var(--text-secondary)',
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <code
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            color: 'var(--text-primary)',
          }}
        >
          {token.name}
        </code>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {token.role}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
          }}
        >
          {resolved || 'resolving...'}
        </span>
        {token.contrastAgainst?.map((against) => (
          <div
            key={against}
            style={{ display: 'flex', gap: 8, alignItems: 'center' }}
          >
            <span
              style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}
            >
              vs <code>{against}</code>
            </span>
            <ContrastBadge
              ratio={contrastRatio(resolved, resolveVar(against))}
            />
          </div>
        ))}
      </div>
    </li>
  );
}

function StatusBadgeSample({ token }: { token: string }) {
  const isDark = token === '--status-threat' || token === '--status-critical';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 6,
        background: `var(${token})`,
        color: isDark ? 'var(--text-on-threat)' : 'var(--surface-raised)',
        fontFamily: 'var(--font-sans)',
        fontSize: '0.85rem',
        fontWeight: 600,
      }}
    >
      <span aria-hidden style={{ fontSize: '0.9rem' }}>
        {STATUS_GLYPHS[token]}
      </span>
      {STATUS_LABELS[token]}
    </span>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2
        style={{
          margin: 0,
          marginBottom: 4,
          fontFamily: 'var(--font-sans)',
          fontSize: '1.25rem',
          color: 'var(--text-primary)',
          fontWeight: 600,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          margin: 0,
          marginBottom: 16,
          color: 'var(--text-secondary)',
          fontSize: '0.9rem',
          maxWidth: '65ch',
        }}
      >
        {description}
      </p>
      {children}
    </section>
  );
}

export function TokensPage() {
  /*
   * Opt this page into the mineral theme by setting data-theme on <html>.
   * This makes semantic tokens resolve at document root, so getComputedStyle
   * lookups in the contrast readouts find them. Removed on unmount so other
   * pages remain on legacy tokens until we migrate them in Phase C+.
   */
  React.useEffect(() => {
    const previous = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', 'mineral');
    return () => {
      if (previous == null) {
        document.documentElement.removeAttribute('data-theme');
      } else {
        document.documentElement.setAttribute('data-theme', previous);
      }
    };
  }, []);

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: 'var(--surface-canvas)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-sans)',
        padding: '48px 32px 96px',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <header style={{ marginBottom: 32 }}>
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              letterSpacing: '0.05em',
            }}
          >
            BantAI design tokens / dev only
          </p>
          <h1
            style={{
              margin: '4px 0 8px',
              fontSize: '1.75rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            Token surface
          </h1>
          <p
            style={{
              margin: 0,
              color: 'var(--text-secondary)',
              fontSize: '0.95rem',
              maxWidth: '65ch',
            }}
          >
            Every Layer 2 semantic token with sample surface and live WCAG 2.2
            contrast against its intended pairings. Ratios recompute on reload
            from the resolved CSS variable values.
          </p>
        </header>

        <Section
          title="Foundation"
          description="Canvas, surfaces, and text. Text tokens are checked against both surfaces."
        >
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'grid',
              gap: 12,
            }}
          >
            {FOUNDATION.map((t) => (
              <Swatch key={t.name} token={t} />
            ))}
          </ul>
        </Section>

        <Section
          title="Identity"
          description="Mulberry family. Used for BantAI itself: brand, primary action, active navigation, selection. Never for danger, safety, or confidence."
        >
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'grid',
              gap: 12,
            }}
          >
            {IDENTITY.map((t) => (
              <Swatch key={t.name} token={t} />
            ))}
          </ul>
        </Section>

        <Section
          title="Information"
          description="Petrol. Used for AI-generated insight, model metadata, analytical explanations. Never for brand or threat."
        >
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'grid',
              gap: 12,
            }}
          >
            {INFO.map((t) => (
              <Swatch key={t.name} token={t} />
            ))}
          </ul>
        </Section>

        <Section
          title="Semantic states"
          description="Classification only. Color plus icon plus label. Confidence renders as a neutral number or bar elsewhere, never as a color."
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 20,
            }}
          >
            {SEMANTIC.map((t) => (
              <StatusBadgeSample key={t.name} token={t.name} />
            ))}
          </div>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'grid',
              gap: 12,
            }}
          >
            {SEMANTIC.map((t) => (
              <Swatch key={t.name} token={t} />
            ))}
          </ul>
        </Section>

        <Section
          title="Chart palette"
          description="Categorical series 1 through 5. Draw in order. Threat, verified, and suspicious colors do not appear in this list; they enter charts only when the axis is literally that semantic dimension."
        >
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'grid',
              gap: 12,
            }}
          >
            {CHART.map((t) => (
              <Swatch key={t.name} token={t} />
            ))}
          </ul>
        </Section>

        <Section
          title="Motion"
          description="Locked per correction 6. All UI transitions use --motion-fast through --motion-slow with --motion-ease. Reduced-motion collapses all durations to 0ms."
        >
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              margin: 0,
            }}
          >
            --motion-fast: 150ms &middot; --motion-base: 200ms &middot;
            --motion-slow: 250ms
          </p>
        </Section>
      </div>
    </main>
  );
}

export default TokensPage;
