import React, { useState } from 'react';

export interface AlertTimelinePoint {
  date: string;
  label: string;
  resolved: number;
  received: number;
  underReview?: number;
}

export interface RangeOption {
  key: string;
  label: string;
}

const DEFAULT_RANGES: RangeOption[] = [
  { key: '7d', label: '7D' },
  { key: '14d', label: '14D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: 'all', label: 'All' },
];

export interface LineAreaChartProps {
  title?: string;
  data: AlertTimelinePoint[];
  selectedRange?: string;
  onRangeChange?: (range: string) => void;
  rangeOptions?: RangeOption[];
  summaryMetrics?: {
    totalResolved: number;
    totalReceived: number;
    totalUnderReview?: number;
    totalDismissed?: number;
    resolutionRate: number;
  };
}

export const LineAreaChart: React.FC<LineAreaChartProps> = ({
  title = 'Alert resolution lifecycle & triage pipeline',
  data,
  selectedRange = '30d',
  onRangeChange,
  rangeOptions = DEFAULT_RANGES,
  summaryMetrics,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const points = data && data.length > 0 ? data : [];

  // SVG coordinates setup
  const width = 640;
  const height = 190;
  const padX = 40;
  const padYTop = 24;
  const padYBottom = 34;

  const maxVal = Math.max(
    ...points.map((p) =>
      Math.max(p.received || 0, p.resolved || 0, p.underReview || 0),
    ),
    10,
  );

  const chartHeight = height - padYTop - padYBottom;

  const calculatedPoints = points.map((pt, idx) => {
    const cx =
      points.length > 1
        ? padX + (idx / (points.length - 1)) * (width - padX * 2)
        : width / 2;

    const cyResolved =
      padYTop + chartHeight - (pt.resolved / maxVal) * chartHeight;
    const cyReceived =
      padYTop + chartHeight - (pt.received / maxVal) * chartHeight;
    const cyReview =
      padYTop + chartHeight - ((pt.underReview || 0) / maxVal) * chartHeight;

    return {
      ...pt,
      cx,
      cyResolved,
      cyReceived,
      cyReview,
    };
  });

  // Construct smooth bezier curve path for an array of (cx, cy)
  function makeSmoothPath(coords: { cx: number; cy: number }[]): string {
    if (coords.length === 0) return '';
    if (coords.length === 1) return `M ${coords[0].cx} ${coords[0].cy}`;
    return coords.reduce((acc, pt, i, arr) => {
      if (i === 0) return `M ${pt.cx} ${pt.cy}`;
      const prev = arr[i - 1];
      const cp1x = prev.cx + (pt.cx - prev.cx) / 2;
      const cp1y = prev.cy;
      const cp2x = prev.cx + (pt.cx - prev.cx) / 2;
      const cp2y = pt.cy;
      return `${acc} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${pt.cx} ${pt.cy}`;
    }, '');
  }

  const resolvedLineD = makeSmoothPath(
    calculatedPoints.map((p) => ({ cx: p.cx, cy: p.cyResolved })),
  );
  const receivedLineD = makeSmoothPath(
    calculatedPoints.map((p) => ({ cx: p.cx, cy: p.cyReceived })),
  );

  // Closed area paths for gradient fill
  const baselineY = padYTop + chartHeight;
  const firstPt = calculatedPoints[0];
  const lastPt = calculatedPoints[calculatedPoints.length - 1];

  const resolvedAreaD =
    firstPt && lastPt
      ? `${resolvedLineD} L ${lastPt.cx} ${baselineY} L ${firstPt.cx} ${baselineY} Z`
      : '';
  const receivedAreaD =
    firstPt && lastPt
      ? `${receivedLineD} L ${lastPt.cx} ${baselineY} L ${firstPt.cx} ${baselineY} Z`
      : '';

  const activePoint =
    hoveredIdx !== null && calculatedPoints[hoveredIdx]
      ? calculatedPoints[hoveredIdx]
      : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        width: '100%',
      }}
    >
      {/* Header with Title and Range Filters */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: '0.95rem',
              fontWeight: 600,
              color: 'var(--text-primary, #111827)',
            }}
          >
            {title}
          </h3>
          <p
            style={{
              margin: '3px 0 0',
              fontSize: '0.8rem',
              color: 'var(--text-secondary, #6b7280)',
            }}
          >
            Temporal tracking of incident triage, incoming alert intake, and
            investigative closure.
          </p>
        </div>

        {/* Legend & Filter Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          {/* Legend */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontSize: '0.78rem',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: 'var(--text-primary, #111827)',
                fontWeight: 500,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 3,
                  borderRadius: 2,
                  background: '#10b981',
                }}
              />
              Resolved
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: 'var(--text-primary, #111827)',
                fontWeight: 500,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 3,
                  borderRadius: 2,
                  background: '#3b82f6',
                }}
              />
              Received
            </span>
          </div>

          {/* Range Pills */}
          {onRangeChange && (
            <div
              style={{
                display: 'inline-flex',
                background: 'var(--surface-canvas, #f3f4f6)',
                border: '1px solid var(--border-subtle, #e5e7eb)',
                borderRadius: 6,
                padding: 2,
              }}
            >
              {rangeOptions.map((r) => {
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
                      fontWeight: isSelected ? 700 : 500,
                      border: 'none',
                      background: isSelected
                        ? 'var(--surface-raised, #ffffff)'
                        : 'transparent',
                      color: isSelected
                        ? 'var(--text-primary, #111827)'
                        : 'var(--text-secondary, #6b7280)',
                      cursor: 'pointer',
                      boxShadow: isSelected
                        ? '0 1px 2px rgba(0,0,0,0.06)'
                        : 'none',
                    }}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* SVG Line Chart Canvas */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          background: 'var(--surface-muted, #fafafa)',
          borderRadius: 8,
          border: '1px solid var(--border-subtle, #f3f4f6)',
          padding: '8px 12px',
          boxSizing: 'border-box',
        }}
      >
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          style={{ overflow: 'visible', display: 'block' }}
        >
          <defs>
            {/* Resolved gradient */}
            <linearGradient id="resolvedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.32" />
              <stop offset="80%" stopColor="#10b981" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>

            {/* Received gradient */}
            <linearGradient id="receivedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
              <stop offset="80%" stopColor="#3b82f6" stopOpacity="0.02" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal gridlines */}
          {[0, 0.33, 0.66, 1].map((pct, idx) => {
            const y = padYTop + chartHeight * (1 - pct);
            const val = Math.round(maxVal * pct);
            return (
              <g key={idx}>
                <line
                  x1={padX}
                  y1={y}
                  x2={width - padX}
                  y2={y}
                  stroke="var(--border-subtle, #e5e7eb)"
                  strokeDasharray="4 4"
                  strokeWidth="0.8"
                />
                <text
                  x={padX - 8}
                  y={y + 3}
                  fontSize="9"
                  fill="var(--text-secondary, #9ca3af)"
                  textAnchor="end"
                  fontFamily="var(--font-mono, monospace)"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Area Fills */}
          {receivedAreaD && (
            <path d={receivedAreaD} fill="url(#receivedGrad)" />
          )}
          {resolvedAreaD && (
            <path d={resolvedAreaD} fill="url(#resolvedGrad)" />
          )}

          {/* Stroke Lines */}
          {receivedLineD && (
            <path
              d={receivedLineD}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {resolvedLineD && (
            <path
              d={resolvedLineD}
              fill="none"
              stroke="#10b981"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Interactive Hover Vertical Line */}
          {activePoint && (
            <line
              x1={activePoint.cx}
              y1={padYTop}
              x2={activePoint.cx}
              y2={baselineY}
              stroke="var(--border-strong, #6b7280)"
              strokeDasharray="2 2"
              strokeWidth="1.2"
            />
          )}

          {/* Interactive Data Points */}
          {calculatedPoints.map((pt, idx) => {
            const isHovered = hoveredIdx === idx;
            return (
              <g
                key={idx}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Invisible hover trigger column */}
                <rect
                  x={pt.cx - (width / points.length) * 0.5}
                  y={padYTop}
                  width={width / points.length}
                  height={chartHeight + 10}
                  fill="transparent"
                />

                {/* Received Dot */}
                <circle
                  cx={pt.cx}
                  cy={pt.cyReceived}
                  r={isHovered ? 5.5 : 3}
                  fill="#ffffff"
                  stroke="#3b82f6"
                  strokeWidth={isHovered ? 2.5 : 1.8}
                />

                {/* Resolved Dot */}
                <circle
                  cx={pt.cx}
                  cy={pt.cyResolved}
                  r={isHovered ? 6 : 3.5}
                  fill="#ffffff"
                  stroke="#10b981"
                  strokeWidth={isHovered ? 2.8 : 2}
                />

                {/* X-axis date labels */}
                {(points.length <= 14 || idx % 2 === 0) && (
                  <text
                    x={pt.cx}
                    y={height - 10}
                    fontSize="9.5"
                    fill={
                      isHovered
                        ? 'var(--text-primary, #111827)'
                        : 'var(--text-secondary, #6b7280)'
                    }
                    fontWeight={isHovered ? 700 : 500}
                    textAnchor="middle"
                  >
                    {pt.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Box */}
        {activePoint && (
          <div
            style={{
              position: 'absolute',
              left: `${(activePoint.cx / width) * 100}%`,
              top: 10,
              transform:
                activePoint.cx > width * 0.75
                  ? 'translateX(-100%)'
                  : 'translateX(-50%)',
              background: 'var(--surface-raised, #ffffff)',
              border: '1px solid var(--border-subtle, #e5e7eb)',
              borderRadius: 8,
              padding: '8px 12px',
              boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
              pointerEvents: 'none',
              zIndex: 10,
              minWidth: 150,
            }}
          >
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--text-secondary, #6b7280)',
                marginBottom: 4,
              }}
            >
              {activePoint.date || activePoint.label}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                fontSize: '0.8rem',
              }}
            >
              <span style={{ color: '#10b981', fontWeight: 600 }}>
                ● Resolved:
              </span>
              <strong style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                {activePoint.resolved.toLocaleString()}
              </strong>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                fontSize: '0.8rem',
              }}
            >
              <span style={{ color: '#3b82f6', fontWeight: 600 }}>
                ● Received:
              </span>
              <strong style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                {activePoint.received.toLocaleString()}
              </strong>
            </div>
            {activePoint.underReview !== undefined && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  fontSize: '0.8rem',
                }}
              >
                <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                  ● Under Review:
                </span>
                <strong style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                  {activePoint.underReview.toLocaleString()}
                </strong>
              </div>
            )}
            <div
              style={{
                marginTop: 4,
                paddingTop: 4,
                borderTop: '1px solid var(--border-subtle, #f3f4f6)',
                fontSize: '0.72rem',
                color: 'var(--text-secondary, #6b7280)',
                textAlign: 'right',
              }}
            >
              Resolution Rate:{' '}
              <strong style={{ color: '#10b981' }}>
                {activePoint.received > 0
                  ? `${Math.round(
                      (activePoint.resolved / activePoint.received) * 100,
                    )}%`
                  : '100%'}
              </strong>
            </div>
          </div>
        )}
      </div>

      {/* Summary KPI Strip below the Line Graph */}
      {summaryMetrics && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 12,
          }}
        >
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: 'var(--surface-muted, #f9fafb)',
              border: '1px solid var(--border-subtle, #e5e7eb)',
            }}
          >
            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                color: 'var(--text-secondary, #6b7280)',
                textTransform: 'uppercase',
              }}
            >
              Total Resolved
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                marginTop: 2,
              }}
            >
              <strong
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: '#10b981',
                  fontFamily: 'var(--font-mono, monospace)',
                }}
              >
                {summaryMetrics.totalResolved.toLocaleString()}
              </strong>
              <span
                style={{
                  fontSize: '0.72rem',
                  color: '#10b981',
                  fontWeight: 700,
                }}
              >
                ✓ closed
              </span>
            </div>
          </div>

          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: 'var(--surface-muted, #f9fafb)',
              border: '1px solid var(--border-subtle, #e5e7eb)',
            }}
          >
            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                color: 'var(--text-secondary, #6b7280)',
                textTransform: 'uppercase',
              }}
            >
              Total Received
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                marginTop: 2,
              }}
            >
              <strong
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: '#3b82f6',
                  fontFamily: 'var(--font-mono, monospace)',
                }}
              >
                {summaryMetrics.totalReceived.toLocaleString()}
              </strong>
              <span
                style={{
                  fontSize: '0.72rem',
                  color: '#3b82f6',
                  fontWeight: 700,
                }}
              >
                intake
              </span>
            </div>
          </div>

          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: 'var(--surface-muted, #f9fafb)',
              border: '1px solid var(--border-subtle, #e5e7eb)',
            }}
          >
            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                color: 'var(--text-secondary, #6b7280)',
                textTransform: 'uppercase',
              }}
            >
              Resolution Rate
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                marginTop: 2,
              }}
            >
              <strong
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: '#10b981',
                  fontFamily: 'var(--font-mono, monospace)',
                }}
              >
                {summaryMetrics.resolutionRate.toFixed(1)}%
              </strong>
              <span
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--text-secondary, #6b7280)',
                }}
              >
                efficiency
              </span>
            </div>
          </div>

          {summaryMetrics.totalUnderReview !== undefined && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: 'var(--surface-muted, #f9fafb)',
                border: '1px solid var(--border-subtle, #e5e7eb)',
              }}
            >
              <div
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary, #6b7280)',
                  textTransform: 'uppercase',
                }}
              >
                Under Review
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 8,
                  marginTop: 2,
                }}
              >
                <strong
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    color: '#f59e0b',
                    fontFamily: 'var(--font-mono, monospace)',
                  }}
                >
                  {summaryMetrics.totalUnderReview.toLocaleString()}
                </strong>
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: '#f59e0b',
                    fontWeight: 700,
                  }}
                >
                  active
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
