import React from 'react';

export interface DonutSegment {
  label: string;
  count: number;
  share: number; // 0 to 1
  color: string;
  sublabel?: string;
}

export interface RangeOption {
  key: string;
  label: string;
}

const DEFAULT_RANGES: RangeOption[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7D' },
  { key: '14d', label: '14D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: 'all', label: 'All' },
];

export interface DonutChartProps {
  title?: string;
  total: number;
  totalLabel?: string;
  segments: DonutSegment[];
  emptyMessage?: string;
  selectedRange?: string;
  onRangeChange?: (range: string) => void;
  rangeOptions?: RangeOption[];
}

export const DonutChart: React.FC<DonutChartProps> = ({
  title,
  total,
  totalLabel = 'Total',
  segments,
  emptyMessage = 'No data available for this period',
  selectedRange = '30d',
  onRangeChange,
  rangeOptions = DEFAULT_RANGES,
}) => {
  // Pre-calculate cumulative offsets for standard 100-circumference circle
  // Radius r = 15.91549430918954 => 2 * pi * r = 100.
  // Standard start is 12 o'clock, which is offset = 25.
  let cumulativePercent = 0;
  const renderedSegments = segments.map((seg) => {
    const percent = Math.max(0, Math.min(100, seg.share * 100));
    const offset = 25 - cumulativePercent;
    cumulativePercent += percent;
    return {
      ...seg,
      percent,
      offset,
    };
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        width: '100%',
      }}
    >
      {/* Chart Header with Title and Range Filter */}
      {(title || onRangeChange) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          {title && (
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
          )}

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
      )}

      {total === 0 || segments.length === 0 ? (
        <div
          style={{
            padding: 32,
            textAlign: 'center',
            color: 'var(--text-secondary, #6b7280)',
            fontSize: '0.875rem',
          }}
        >
          {emptyMessage}
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-around',
            gap: 24,
          }}
        >
          {/* SVG Donut Ring */}
          <div
            style={{
              position: 'relative',
              width: 170,
              height: 170,
              flexShrink: 0,
            }}
          >
            <svg
              width="170"
              height="170"
              viewBox="0 0 42 42"
              style={{ transform: 'rotate(0deg)' }}
              aria-hidden="true"
            >
              {/* Background Track Ring */}
              <circle
                cx="21"
                cy="21"
                r="15.91549430918954"
                fill="transparent"
                stroke="var(--border-subtle, #e5e7eb)"
                strokeWidth="3.6"
              />

              {/* Dynamic Segments */}
              {renderedSegments.map((seg, idx) => (
                <circle
                  key={`${seg.label}-${idx}`}
                  cx="21"
                  cy="21"
                  r="15.91549430918954"
                  fill="transparent"
                  stroke={seg.color}
                  strokeWidth="3.8"
                  strokeDasharray={`${seg.percent.toFixed(2)} ${(
                    100 - seg.percent
                  ).toFixed(2)}`}
                  strokeDashoffset={seg.offset.toFixed(2)}
                  strokeLinecap="butt"
                  style={{
                    transition:
                      'stroke-dasharray 0.4s ease, stroke-dashoffset 0.4s ease',
                  }}
                />
              ))}
            </svg>

            {/* Center Text inside Donut Hole */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                textAlign: 'center',
                padding: 8,
              }}
            >
              <strong
                style={{
                  fontSize: '1.35rem',
                  fontWeight: 700,
                  color: 'var(--text-primary, #111827)',
                  lineHeight: 1.1,
                  fontFamily: 'var(--font-mono, monospace)',
                }}
              >
                {total.toLocaleString()}
              </strong>
              <span
                style={{
                  fontSize: '0.68rem',
                  color: 'var(--text-secondary, #6b7280)',
                  marginTop: 3,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  fontWeight: 600,
                }}
              >
                {totalLabel}
              </span>
            </div>
          </div>

          {/* Clean Flat Legend Rows */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              flex: 1,
              minWidth: 220,
            }}
          >
            {segments.map((seg, idx) => (
              <div
                key={seg.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom:
                    idx < segments.length - 1
                      ? '1px solid var(--border-subtle, #f3f4f6)'
                      : 'none',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: seg.color,
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: 'var(--text-primary, #111827)',
                      }}
                    >
                      {seg.label}
                    </div>
                    {seg.sublabel && (
                      <div
                        style={{
                          fontSize: '0.72rem',
                          color: 'var(--text-secondary, #6b7280)',
                        }}
                      >
                        {seg.sublabel}
                      </div>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--text-primary, #111827)',
                    }}
                  >
                    {seg.count.toLocaleString()}
                  </span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary, #6b7280)',
                      fontFamily: 'var(--font-mono, monospace)',
                      minWidth: 42,
                      textAlign: 'right',
                    }}
                  >
                    {(seg.share * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
