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

const DEFAULT_DATA: TrendDataPoint[] = [
  { label: 'Mon', value: 240, smishing: 180, suspicious: 60 },
  { label: 'Tue', value: 380, smishing: 310, suspicious: 70 },
  { label: 'Wed', value: 520, smishing: 420, suspicious: 100 },
  { label: 'Thu', value: 680, smishing: 540, suspicious: 140 },
  { label: 'Fri', value: 950, smishing: 790, suspicious: 160 },
  { label: 'Sat', value: 710, smishing: 580, suspicious: 130 },
  { label: 'Sun', value: 430, smishing: 350, suspicious: 80 },
];

const RANGES: { key: TrendRange; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7D' },
  { key: '14d', label: '14D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
];

// BantAI web design mineral palette tokens
const COLOR_SMISHING = '#b5444d'; // --status-threat / --palette-carmine
const COLOR_SUSPICIOUS = '#8f5522'; // --status-suspicious / --palette-burnt-amber

export const TrendLineChart: React.FC<TrendLineChartProps> = ({
  data,
  selectedRange = '30d',
  onRangeChange,
  categories,
  categoryTotals,
  loading = false,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const chartData = data && data.length > 0 ? data : DEFAULT_DATA;

  // Chart dimensions in SVG viewBox coordinate space
  const svgWidth = 840;
  const svgHeight = 260;
  const padLeft = 48;
  const padRight = 24;
  const padTop = 20;
  const padBottom = 38;

  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  // Maximum ceiling computation
  const rawMax = Math.max(
    ...chartData.map((d) => Math.max(d.smishing || 0, d.suspicious || 0)),
    1,
  );
  // Round up to clean integer interval
  const maxVal = Math.max(Math.ceil(rawMax * 1.15), 10);

  // Y-axis tick divisions (4 intervals)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    val: Math.round(maxVal * pct),
    y: padTop + plotHeight - pct * plotHeight,
  }));

  // Coordinate projection for points
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

  // Construct smooth Catmull-Rom / cubic spline curve path
  const makeSplinePath = (pts: { x: number; y: number }[]): string => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? 0 : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(
        1,
      )} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
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
    () => makeSplinePath(smishingCoords),
    [smishingCoords],
  );
  const suspiciousLinePath = useMemo(
    () => makeSplinePath(suspiciousCoords),
    [suspiciousCoords],
  );

  const baselineY = padTop + plotHeight;
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
        gap: 16,
        opacity: loading ? 0.65 : 1,
        transition: 'opacity 0.2s ease',
        pointerEvents: loading ? 'none' : 'auto',
      }}
    >
      {/* 1. Top Controls Header: Series Legend & Segmented Range Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 14,
          fontSize: '0.8125rem',
        }}
      >
        {/* Threat Type Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--text-secondary, #6d6870)',
              fontWeight: 500,
            }}
          >
            <span
              style={{
                width: 14,
                height: 3,
                borderRadius: 1.5,
                background: COLOR_SMISHING,
              }}
            />
            Smishing (Scam)
          </span>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--text-secondary, #6d6870)',
              fontWeight: 500,
            }}
          >
            <span
              style={{
                width: 14,
                height: 3,
                borderRadius: 1.5,
                background: COLOR_SUSPICIOUS,
              }}
            />
            Suspicious (Spam)
          </span>
        </div>

        {/* Date Range Segmented Controls */}
        {onRangeChange && (
          <div
            role="group"
            aria-label="Threat trends range selector"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'var(--surface-canvas, #f2efe8)',
              border: '1px solid var(--border-default, #e5e7eb)',
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
                    padding: '3px 9px',
                    borderRadius: 4,
                    fontSize: '0.74rem',
                    fontWeight: isSelected ? 600 : 500,
                    border: 'none',
                    background: isSelected
                      ? 'var(--surface-raised, #fbf9f4)'
                      : 'transparent',
                    color: isSelected
                      ? 'var(--text-primary, #211f24)'
                      : 'var(--text-secondary, #6d6870)',
                    cursor: 'pointer',
                    boxShadow: isSelected
                      ? '0 1px 2px rgba(0,0,0,0.06)'
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

      {/* 2. Responsive Interactive SVG Line Graph */}
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
          <defs>
            {/* Area gradient for Smishing (Carmine) */}
            <linearGradient id="smishing-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLOR_SMISHING} stopOpacity="0.14" />
              <stop offset="100%" stopColor={COLOR_SMISHING} stopOpacity="0.00" />
            </linearGradient>

            {/* Area gradient for Suspicious (Burnt Amber) */}
            <linearGradient id="suspicious-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLOR_SUSPICIOUS} stopOpacity="0.10" />
              <stop
                offset="100%"
                stopColor={COLOR_SUSPICIOUS}
                stopOpacity="0.00"
              />
            </linearGradient>
          </defs>

          {/* Horizontal Gridlines & Y-Axis Labels */}
          {yTicks.map((t, idx) => (
            <g key={idx}>
              <line
                x1={padLeft}
                y1={t.y}
                x2={svgWidth - padRight}
                y2={t.y}
                stroke="var(--border-subtle, #e5e7eb)"
                strokeDasharray={idx === 0 ? 'none' : '3 3'}
                strokeWidth="1"
              />
              <text
                x={padLeft - 10}
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

          {/* X-Axis Baseline */}
          <line
            x1={padLeft}
            y1={baselineY}
            x2={svgWidth - padRight}
            y2={baselineY}
            stroke="var(--border-subtle, #e5e7eb)"
            strokeWidth="1.2"
          />

          {/* Area Fills */}
          <path d={smishingAreaPath} fill="url(#smishing-gradient)" />
          <path d={suspiciousAreaPath} fill="url(#suspicious-gradient)" />

          {/* Continuous Spline Lines */}
          <path
            d={smishingLinePath}
            fill="none"
            stroke={COLOR_SMISHING}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={suspiciousLinePath}
            fill="none"
            stroke={COLOR_SUSPICIOUS}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* X-Axis Date Labels */}
          {points.map((pt, idx) => {
            // Filter labels to prevent overcrowding on dense 30D / 90D ranges
            const showLabel =
              points.length <= 14
                ? true
                : points.length <= 35
                ? idx % 3 === 0 || idx === points.length - 1
                : idx % 6 === 0 || idx === points.length - 1;

            if (!showLabel) return null;

            return (
              <text
                key={`label-${idx}`}
                x={pt.x}
                y={baselineY + 18}
                textAnchor="middle"
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

          {/* Active Hover Scrubber & Data Points */}
          {activePt && (
            <g>
              {/* Vertical Crosshair Line */}
              <line
                x1={activePt.x}
                y1={padTop}
                x2={activePt.x}
                y2={baselineY}
                stroke="var(--palette-warm-ink, #211f24)"
                strokeDasharray="2 2"
                strokeWidth="1"
                opacity="0.45"
              />

              {/* Point on Smishing Line */}
              <circle
                cx={activePt.x}
                cy={activePt.ySmishing}
                r="6"
                fill={COLOR_SMISHING}
                opacity="0.25"
              />
              <circle
                cx={activePt.x}
                cy={activePt.ySmishing}
                r="3.5"
                fill={COLOR_SMISHING}
                stroke="var(--surface-raised, #ffffff)"
                strokeWidth="2"
              />

              {/* Point on Suspicious Line */}
              <circle
                cx={activePt.x}
                cy={activePt.ySuspicious}
                r="6"
                fill={COLOR_SUSPICIOUS}
                opacity="0.25"
              />
              <circle
                cx={activePt.x}
                cy={activePt.ySuspicious}
                r="3.5"
                fill={COLOR_SUSPICIOUS}
                stroke="var(--surface-raised, #ffffff)"
                strokeWidth="2"
              />
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

        {/* Hover Tooltip Overlay */}
        {activePt && (
          <div
            style={{
              position: 'absolute',
              top: 10,
              left: `${Math.min(
                Math.max((activePt.x / svgWidth) * 100, 15),
                85,
              )}%`,
              transform: 'translateX(-50%)',
              background: 'var(--surface-raised, #ffffff)',
              border: '1px solid var(--border-default, #e5e7eb)',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: '0.75rem',
              boxShadow: '0 4px 12px rgba(33, 31, 36, 0.08)',
              pointerEvents: 'none',
              zIndex: 10,
              minWidth: 150,
            }}
          >
            <div
              style={{
                fontWeight: 700,
                color: 'var(--text-primary, #211f24)',
                borderBottom: '1px solid var(--border-subtle, #f3f4f6)',
                paddingBottom: 4,
                marginBottom: 6,
                fontFamily: 'var(--font-mono, monospace)',
              }}
            >
              {activePt.date || activePt.label}
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
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

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  borderTop: '1px solid var(--border-subtle, #f3f4f6)',
                  paddingTop: 4,
                  marginTop: 2,
                }}
              >
                <span style={{ color: 'var(--text-secondary, #6d6870)', fontWeight: 600 }}>
                  Total Threats:
                </span>
                <strong
                  style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    color: 'var(--text-primary, #211f24)',
                  }}
                >
                  {((activePt.smishing || 0) + (activePt.suspicious || 0)).toLocaleString()}
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
            gap: 16,
            flexWrap: 'wrap',
            borderTop: '1px solid var(--border-subtle, #e5e7eb)',
            paddingTop: 10,
            marginTop: 4,
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
            Scam Types in Period:
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
