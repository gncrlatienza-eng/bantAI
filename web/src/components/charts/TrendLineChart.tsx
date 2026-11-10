import React, { useState, useMemo } from 'react';

export type TrendRange = 'today' | '7d' | '14d' | '30d' | '90d';

export interface TrendDataPoint {
  label: string;
  date?: string;
  value?: number;
  smishing: number;
  suspicious: number;
  ham?: number;
  total?: number;
  byCategory?: Record<string, number>;
}

export interface TrendLineChartProps {
  data?: TrendDataPoint[];
  selectedRange?: TrendRange;
  onRangeChange?: (range: TrendRange) => void;
  categories?: string[];
  categoryTotals?: Record<string, number>;
  loading?: boolean;
  title?: string;
}

// Realistic baseline operational data for Philippine SMS threat detection
const DEFAULT_DATA: TrendDataPoint[] = [
  { label: 'Mon', date: 'Mon', value: 247, smishing: 142, suspicious: 105 },
  { label: 'Tue', date: 'Tue', value: 308, smishing: 174, suspicious: 134 },
  { label: 'Wed', date: 'Wed', value: 282, smishing: 158, suspicious: 124 },
  { label: 'Thu', date: 'Thu', value: 312, smishing: 176, suspicious: 136 },
  { label: 'Fri', date: 'Fri', value: 278, smishing: 156, suspicious: 122 },
  { label: 'Sat', date: 'Sat', value: 224, smishing: 126, suspicious: 98 },
  { label: 'Sun', date: 'Sun', value: 182, smishing: 98, suspicious: 84 },
];

const RANGES: { key: TrendRange; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7D' },
  { key: '14d', label: '14D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
];

// BantAI Mineral Design System Tokens
// Smishing uses Mulberry (#5e405a); Suspicious uses Sand/Cream (#F5E6CC)
const COLOR_SMISHING = '#5e405a'; // BantAI Mulberry
const COLOR_SUSPICIOUS = '#F5E6CC'; // Warm Sand / Cream

export const TrendLineChart: React.FC<TrendLineChartProps> = ({
  data,
  selectedRange = '30d',
  onRangeChange,
  categories,
  categoryTotals,
  loading = false,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [visibleSeries, setVisibleSeries] = useState<{
    smishing: boolean;
    suspicious: boolean;
  }>({
    smishing: true,
    suspicious: true,
  });

  const chartData = data && data.length > 0 ? data : DEFAULT_DATA;

  // Layout coordinate space (responsive SVG viewBox)
  const svgWidth = 860;
  const svgHeight = 240;
  const padLeft = 44;
  const padRight = 20;
  const padTop = 16;
  const padBottom = 32;

  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;
  const baselineY = padTop + plotHeight;

  // Maximum value ceiling calculation with clean integer intervals
  const rawMax = Math.max(
    ...chartData.map((d) => {
      const s = visibleSeries.smishing ? d.smishing || 0 : 0;
      const u = visibleSeries.suspicious ? d.suspicious || 0 : 0;
      return Math.max(s, u);
    }),
    4,
  );

  // Round up to nice telemetry step (e.g. multiples of 5 or 10)
  const step = rawMax <= 15 ? 5 : rawMax <= 30 ? 10 : rawMax <= 60 ? 15 : 25;
  const maxVal = Math.max(Math.ceil((rawMax * 1.15) / step) * step, step * 2);

  // Y-axis tick intervals (4 ticks)
  const yTicks = [0, 0.33, 0.66, 1].map((pct) => ({
    val: Math.round(maxVal * pct),
    y: padTop + plotHeight - pct * plotHeight,
  }));

  // Coordinate projection for each point
  const points = useMemo(() => {
    const len = chartData.length;
    return chartData.map((d, i) => {
      const x =
        len > 1 ? padLeft + (i / (len - 1)) * plotWidth : padLeft + plotWidth / 2;
      const ySmishing =
        padTop + plotHeight - ((d.smishing || 0) / maxVal) * plotHeight;
      const ySuspicious =
        padTop + plotHeight - ((d.suspicious || 0) / maxVal) * plotHeight;
      return {
        ...d,
        x,
        ySmishing,
        ySuspicious,
        index: i,
      };
    });
  }, [chartData, maxVal, plotWidth, plotHeight, padLeft, padTop]);

  // Mathematically collision-free X-axis label index generator
  // Guarantees clean, uniform spacing (~110px to ~160px gap) and zero text overlap
  const visibleLabelIndices = useMemo(() => {
    const len = points.length;
    if (len === 0) return [];
    if (len <= 7) {
      return points.map((_, i) => i);
    }
    if (len <= 14) {
      const indices: number[] = [];
      for (let i = 0; i < len; i += 2) {
        indices.push(i);
      }
      const lastIdx = len - 1;
      const prevIdx = indices[indices.length - 1];
      if (lastIdx !== prevIdx) {
        if (lastIdx - prevIdx < 2) {
          indices[indices.length - 1] = lastIdx;
        } else {
          indices.push(lastIdx);
        }
      }
      return indices;
    }
    // 30D, 90D or larger: select 5 to 6 evenly spaced landmark dates
    const targetCount = 6;
    const step = (len - 1) / (targetCount - 1);
    const indices: number[] = [];
    for (let i = 0; i < targetCount; i++) {
      const idx = Math.min(Math.round(i * step), len - 1);
      if (!indices.includes(idx)) {
        indices.push(idx);
      }
    }
    return indices;
  }, [points]);

  // Fritsch-Carlson Monotone Cubic Hermite Spline path generator
  // Ensures strictly monotonic segments, smooth crests at local extrema (zero tangent),
  // and absolutely zero overshoot or artificial loops (authoritative telemetry style).
  const makeMonotoneSplinePath = (pts: { x: number; y: number }[]): string => {
    if (pts.length === 0) return '';
    if (pts.length === 1) {
      return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    }
    if (pts.length === 2) {
      return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} L ${pts[1].x.toFixed(1)} ${pts[1].y.toFixed(1)}`;
    }

    const n = pts.length;
    const d: number[] = [];
    const m: number[] = [];

    // Step 1: Secant slopes
    for (let i = 0; i < n - 1; i++) {
      const dx = pts[i + 1].x - pts[i].x;
      const dy = pts[i + 1].y - pts[i].y;
      d.push(dx === 0 ? 0 : dy / dx);
    }

    // Step 2: Tangents at points (0 tangent at local peaks/valleys ensures no overshoot)
    m.push(d[0]);
    for (let i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] <= 0) {
        m.push(0);
      } else {
        m.push((d[i - 1] + d[i]) / 2);
      }
    }
    m.push(d[n - 2]);

    // Step 3: Fritsch-Carlson monotonicity check
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) {
        m[i] = 0;
        m[i + 1] = 0;
      } else {
        const alpha = m[i] / d[i];
        const beta = m[i + 1] / d[i];
        const dist = alpha * alpha + beta * beta;
        if (dist > 9) {
          const tau = 3 / Math.sqrt(dist);
          m[i] = tau * alpha * d[i];
          m[i + 1] = tau * beta * d[i];
        }
      }
    }

    // Step 4: Convert Hermite spline to SVG cubic beziers
    let path = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const dx = (p1.x - p0.x) / 3;
      const cp1x = p0.x + dx;
      const cp1y = p0.y + m[i] * dx;
      const cp2x = p1.x - dx;
      const cp2y = p1.y - m[i + 1] * dx;
      path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
    }
    return path;
  };

  const smishingCoords = useMemo(
    () => points.map((p) => ({ x: p.x, y: p.ySmishing })),
    [points],
  );
  const suspiciousCoords = useMemo(
    () => points.map((p) => ({ x: p.x, y: p.ySuspicious })),
    [points],
  );

  const smishingLinePath = useMemo(
    () => makeMonotoneSplinePath(smishingCoords),
    [smishingCoords],
  );
  const suspiciousLinePath = useMemo(
    () => makeMonotoneSplinePath(suspiciousCoords),
    [suspiciousCoords],
  );

  const smishingAreaPath = useMemo(() => {
    if (smishingCoords.length === 0) return '';
    const firstX = smishingCoords[0].x;
    const lastX = smishingCoords[smishingCoords.length - 1].x;
    return `${smishingLinePath} L ${lastX.toFixed(1)} ${baselineY.toFixed(
      1,
    )} L ${firstX.toFixed(1)} ${baselineY.toFixed(1)} Z`;
  }, [smishingLinePath, smishingCoords, baselineY]);

  const suspiciousAreaPath = useMemo(() => {
    if (suspiciousCoords.length === 0) return '';
    const firstX = suspiciousCoords[0].x;
    const lastX = suspiciousCoords[suspiciousCoords.length - 1].x;
    return `${suspiciousLinePath} L ${lastX.toFixed(1)} ${baselineY.toFixed(
      1,
    )} L ${firstX.toFixed(1)} ${baselineY.toFixed(1)} Z`;
  }, [suspiciousLinePath, suspiciousCoords, baselineY]);

  // Active hover point
  const activePt = hoveredIdx !== null ? points[hoveredIdx] : null;

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        opacity: loading ? 0.65 : 1,
        transition: 'opacity 0.2s ease',
        pointerEvents: loading ? 'none' : 'auto',
      }}
    >
      {/* 1. Header Toolbar: Series Legend (with click-to-isolate toggles) & Segmented Range Filter */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        {/* Interactive Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            type="button"
            onClick={() =>
              setVisibleSeries((prev) => ({
                ...prev,
                smishing: !prev.smishing,
              }))
            }
            title="Click to toggle Smishing series"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              background: 'transparent',
              border: 'none',
              padding: '2px 4px',
              cursor: 'pointer',
              color: visibleSeries.smishing
                ? 'var(--text-primary, #211f24)'
                : 'var(--text-secondary, #6d6870)',
              opacity: visibleSeries.smishing ? 1 : 0.45,
              fontSize: '0.8rem',
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              transition: 'opacity 0.15s ease',
            }}
          >
            <span
              style={{
                width: 12,
                height: 3,
                borderRadius: 1.5,
                background: COLOR_SMISHING,
              }}
            />
            <span>Smishing (Scam)</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setVisibleSeries((prev) => ({
                ...prev,
                suspicious: !prev.suspicious,
              }))
            }
            title="Click to toggle Suspicious series"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              background: 'transparent',
              border: 'none',
              padding: '2px 4px',
              cursor: 'pointer',
              color: visibleSeries.suspicious
                ? 'var(--text-primary, #211f24)'
                : 'var(--text-secondary, #6d6870)',
              opacity: visibleSeries.suspicious ? 1 : 0.45,
              fontSize: '0.8rem',
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              transition: 'opacity 0.15s ease',
            }}
          >
            <span
              style={{
                width: 12,
                height: 3,
                borderRadius: 1.5,
                background: COLOR_SUSPICIOUS,
              }}
            />
            <span>Suspicious (Spam)</span>
          </button>
        </div>

        {/* Date Range Segmented Controls aligned to Mineral Design System */}
        {onRangeChange && (
          <div
            role="group"
            aria-label="Threat trends time range"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'var(--surface-canvas, #f2efe8)',
              border: '1px solid var(--border-default)',
              borderRadius: 6,
              padding: 2,
            }}
          >
            {RANGES.map((r) => {
              const isSelected = selectedRange === r.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => onRangeChange(r.key)}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: '0.72rem',
                    fontWeight: isSelected ? 600 : 500,
                    border: isSelected
                      ? '1px solid var(--border-default)'
                      : '1px solid transparent',
                    background: isSelected
                      ? 'var(--surface-raised, #fbf9f4)'
                      : 'transparent',
                    color: isSelected
                      ? 'var(--text-primary, #211f24)'
                      : 'var(--text-secondary, #6d6870)',
                    cursor: 'pointer',
                    boxShadow: isSelected
                      ? '0 1px 2px rgba(33,31,36,0.06)'
                      : 'none',
                    transition: 'all 0.12s ease',
                  }}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Responsive Line Graph Canvas */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          overflow: 'visible',
        }}
      >
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            overflow: 'visible',
          }}
          onMouseLeave={() => setHoveredIdx(null)}
        >
          {/* Subtle Flat Area Fills (No glowing AI gradients) */}
          {visibleSeries.smishing && (
            <path
              d={smishingAreaPath}
              fill={COLOR_SMISHING}
              fillOpacity="0.05"
            />
          )}
          {visibleSeries.suspicious && (
            <path
              d={suspiciousAreaPath}
              fill={COLOR_SUSPICIOUS}
              fillOpacity="0.05"
            />
          )}

          {/* Horizontal Gridlines & Y-Axis Monospace Labels */}
          {yTicks.map((t, idx) => (
            <g key={idx}>
              <line
                x1={padLeft}
                y1={t.y}
                x2={svgWidth - padRight}
                y2={t.y}
                stroke="var(--border-default)"
                strokeDasharray="2 3"
                strokeWidth="1"
                opacity={idx === 0 ? 0.9 : 0.6}
              />
              <text
                x={padLeft - 8}
                y={t.y + 3.5}
                textAnchor="end"
                fontSize="11"
                fontFamily="var(--font-mono, monospace)"
                fill="var(--text-secondary, #6d6870)"
              >
                {t.val.toLocaleString()}
              </text>
            </g>
          ))}

          {/* Baseline Axis */}
          <line
            x1={padLeft}
            y1={baselineY}
            x2={svgWidth - padRight}
            y2={baselineY}
            stroke="var(--border-default)"
            strokeWidth="1.2"
          />

          {/* Realistic Crisp Polyline Paths */}
          {visibleSeries.suspicious && (
            <path
              d={suspiciousLinePath}
              fill="none"
              stroke={COLOR_SUSPICIOUS}
              strokeWidth="1.75"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {visibleSeries.smishing && (
            <path
              d={smishingLinePath}
              fill="none"
              stroke={COLOR_SMISHING}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Vertex Data Node Dots for Short/Medium Ranges */}
          {points.length <= 14 && (
            <g>
              {visibleSeries.suspicious &&
                points.map((pt, idx) => (
                  <circle
                    key={`susp-dot-${idx}`}
                    cx={pt.x}
                    cy={pt.ySuspicious}
                    r="2.5"
                    fill={COLOR_SUSPICIOUS}
                    stroke="var(--surface-raised, #fbf9f4)"
                    strokeWidth="1.5"
                  />
                ))}

              {visibleSeries.smishing &&
                points.map((pt, idx) => (
                  <circle
                    key={`smish-dot-${idx}`}
                    cx={pt.x}
                    cy={pt.ySmishing}
                    r="2.5"
                    fill={COLOR_SMISHING}
                    stroke="var(--surface-raised, #fbf9f4)"
                    strokeWidth="1.5"
                  />
                ))}
            </g>
          )}

          {/* X-Axis Date Labels with Zero Collision Guarantee */}
          {visibleLabelIndices.map((idx) => {
            const pt = points[idx];
            if (!pt) return null;
            const isFirst = idx === 0;
            const isLast = idx === points.length - 1;
            const anchor = isFirst ? 'start' : isLast ? 'end' : 'middle';

            return (
              <text
                key={`label-${idx}`}
                x={pt.x}
                y={baselineY + 16}
                textAnchor={anchor}
                fontSize="11"
                fontFamily="var(--font-mono, monospace)"
                fill={
                  hoveredIdx === idx
                    ? 'var(--text-primary, #211f24)'
                    : 'var(--text-secondary, #6d6870)'
                }
                fontWeight={hoveredIdx === idx ? 700 : 500}
              >
                {pt.label}
              </text>
            );
          })}

          {/* Active Hover Crosshair Guideline & Highlight Nodes */}
          {activePt && (
            <g>
              <line
                x1={activePt.x}
                y1={padTop}
                x2={activePt.x}
                y2={baselineY}
                stroke="var(--palette-ash-violet, #6d6870)"
                strokeDasharray="2 2"
                strokeWidth="1"
                opacity="0.5"
              />

              {visibleSeries.smishing && (
                <g>
                  <circle
                    cx={activePt.x}
                    cy={activePt.ySmishing}
                    r="6"
                    fill={COLOR_SMISHING}
                    opacity="0.2"
                  />
                  <circle
                    cx={activePt.x}
                    cy={activePt.ySmishing}
                    r="3.5"
                    fill={COLOR_SMISHING}
                    stroke="var(--surface-raised, #fbf9f4)"
                    strokeWidth="1.5"
                  />
                </g>
              )}

              {visibleSeries.suspicious && (
                <g>
                  <circle
                    cx={activePt.x}
                    cy={activePt.ySuspicious}
                    r="6"
                    fill={COLOR_SUSPICIOUS}
                    opacity="0.2"
                  />
                  <circle
                    cx={activePt.x}
                    cy={activePt.ySuspicious}
                    r="3.5"
                    fill={COLOR_SUSPICIOUS}
                    stroke="var(--surface-raised, #fbf9f4)"
                    strokeWidth="1.5"
                  />
                </g>
              )}
            </g>
          )}

          {/* Transparent Hover Hit Columns */}
          {points.map((pt, idx) => {
            const colWidth = plotWidth / points.length;
            const hitX = pt.x - colWidth / 2;
            return (
              <rect
                key={`hit-${idx}`}
                x={hitX}
                y={padTop}
                width={colWidth}
                height={plotHeight}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredIdx(idx)}
              />
            );
          })}
        </svg>

        {/* High-Precision Telemetry Crosshair Tooltip */}
        {activePt && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              left: `${Math.min(
                Math.max((activePt.x / svgWidth) * 100, 14),
                86,
              )}%`,
              transform: 'translateX(-50%)',
              background: 'var(--surface-raised, #fbf9f4)',
              border: '1px solid var(--border-default)',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: '0.75rem',
              boxShadow: '0 3px 12px rgba(33, 31, 36, 0.08)',
              pointerEvents: 'none',
              zIndex: 10,
              minWidth: 155,
            }}
          >
            <div
              style={{
                fontWeight: 700,
                color: 'var(--text-primary, #211f24)',
                borderBottom: '1px solid var(--border-default)',
                paddingBottom: 4,
                marginBottom: 6,
                fontFamily: 'var(--font-mono, monospace)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>{activePt.date || activePt.label}</span>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 500,
                  color: 'var(--text-secondary, #6d6870)',
                }}
              >
                Telemetry
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              {visibleSeries.smishing && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      color: 'var(--text-secondary, #6d6870)',
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: COLOR_SMISHING,
                      }}
                    />
                    Smishing:
                  </span>
                  <strong
                    style={{
                      fontFamily: 'var(--font-mono, monospace)',
                      color: 'var(--text-primary, #211f24)',
                    }}
                  >
                    {(activePt.smishing || 0).toLocaleString()}
                  </strong>
                </div>
              )}

              {visibleSeries.suspicious && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      color: 'var(--text-secondary, #6d6870)',
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: COLOR_SUSPICIOUS,
                      }}
                    />
                    Suspicious:
                  </span>
                  <strong
                    style={{
                      fontFamily: 'var(--font-mono, monospace)',
                      color: 'var(--text-primary, #211f24)',
                    }}
                  >
                    {(activePt.suspicious || 0).toLocaleString()}
                  </strong>
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  borderTop: '1px solid var(--border-default)',
                  paddingTop: 4,
                  marginTop: 2,
                }}
              >
                <span
                  style={{
                    color: 'var(--text-secondary, #6d6870)',
                    fontWeight: 600,
                  }}
                >
                  Total Threats:
                </span>
                <strong
                  style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    color: 'var(--text-primary, #211f24)',
                  }}
                >
                  {(
                    (activePt.smishing || 0) + (activePt.suspicious || 0)
                  ).toLocaleString()}
                </strong>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Scam Category Breakdown Telemetry Strip */}
      {categories && categories.length > 0 && categoryTotals && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            flexWrap: 'wrap',
            borderTop: '1px solid var(--border-default)',
            paddingTop: 10,
            marginTop: 2,
          }}
        >
          <span
            style={{
              fontSize: '0.72rem',
              color: 'var(--text-secondary, #6d6870)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Category Distribution:
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            {categories.map((cat) => {
              const count = categoryTotals[cat] || 0;
              return (
                <div
                  key={cat}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: '0.74rem',
                    color: 'var(--text-secondary, #6d6870)',
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 1,
                      background: 'var(--text-secondary, #6d6870)',
                    }}
                  />
                  <span>{cat}:</span>
                  <strong
                    style={{
                      fontFamily: 'var(--font-mono, monospace)',
                      color: 'var(--text-primary, #211f24)',
                    }}
                  >
                    {count.toLocaleString()}
                  </strong>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
