import React, { useState } from 'react';

export type TrendRange = 'today' | '7d' | '14d' | '30d' | '90d';

export interface BarDataPoint {
  label: string;
  date?: string;
  value?: number;
  smishing: number;
  suspicious: number;
  ham?: number;
  byCategory?: Record<string, number>;
}

export interface BarChartProps {
  data?: BarDataPoint[];
  selectedRange?: TrendRange;
  onRangeChange?: (range: TrendRange) => void;
  categories?: string[];
  categoryTotals?: Record<string, number>;
  loading?: boolean;
  title?: string;
}

const DEFAULT_DATA: BarDataPoint[] = [
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

export const BarChart: React.FC<BarChartProps> = ({
  data,
  selectedRange = '30d',
  onRangeChange,
  categories,
  categoryTotals,
  loading = false,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const chartData = data && data.length > 0 ? data : DEFAULT_DATA;
  const rawMax = Math.max(
    ...chartData.map((d) => (d.smishing || 0) + (d.suspicious || 0)),
    1,
  );
  // Round up to clean scale ceiling
  const maxVal = Math.max(Math.ceil(rawMax * 1.15), 10);

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
      {/* Top Controls Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          fontSize: '0.8125rem',
        }}
      >
        {/* Threat Type Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--text-secondary, #6d6870)',
              fontWeight: 500,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: '#9e444c',
              }}
            />
            Smishing (Scam)
          </span>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--text-secondary, #6d6870)',
              fontWeight: 500,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: '#a57147',
              }}
            />
            Suspicious (Spam)
          </span>
        </div>

        {/* Date Range Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          {/* Segmented Range Controls */}
          {onRangeChange && (
            <div
              role="group"
              aria-label="Time range selector"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: 'var(--surface-canvas, #f3f4f6)',
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
                        ? 'var(--surface-raised, #ffffff)'
                        : 'transparent',
                      color: isSelected
                        ? 'var(--text-primary, #111827)'
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
      </div>

      {/* Main Chart Area */}
      <div
        style={{
          height: 220,
          position: 'relative',
          display: 'flex',
          alignItems: 'flex-end',
          gap: chartData.length > 20 ? 4 : chartData.length > 10 ? 8 : 16,
          paddingTop: 24,
          paddingBottom: 28,
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        {chartData.map((item, idx) => {
          const smishingCount = item.smishing || 0;
          const suspiciousCount = item.suspicious || 0;
          const totalThreats = smishingCount + suspiciousCount;

          const smishingHeight = (smishingCount / maxVal) * 160;
          const suspiciousHeight = (suspiciousCount / maxVal) * 160;
          const isHovered = hoveredIdx === idx;

          // Extract category breakdown if present
          const categoriesInPeriod = item.byCategory
            ? Object.entries(item.byCategory).filter(([, count]) => count > 0)
            : [];

          return (
            <div
              key={item.date || item.label || idx}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end',
                height: '100%',
                position: 'relative',
                cursor: 'pointer',
                minWidth: 8,
              }}
            >
              {/* Tooltip */}
              {isHovered && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    marginBottom: 10,
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: '0.75rem',
                    color: 'var(--text-primary)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                    whiteSpace: 'nowrap',
                    zIndex: 20,
                    pointerEvents: 'none',
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>
                    {item.label}
                    {item.date ? ` (${item.date})` : ''}
                  </div>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    Total threats: <strong>{totalThreats}</strong>
                  </div>
                  <div style={{ color: '#9e444c', marginTop: 2 }}>
                    Smishing: <strong>{smishingCount}</strong>
                  </div>
                  <div style={{ color: '#a57147', marginTop: 2 }}>
                    Suspicious: <strong>{suspiciousCount}</strong>
                  </div>

                  {categoriesInPeriod.length > 0 && (
                    <div
                      style={{
                        marginTop: 6,
                        paddingTop: 6,
                        borderTop: '1px solid var(--border-default)',
                        fontSize: '0.7rem',
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          color: 'var(--text-secondary)',
                          marginBottom: 2,
                        }}
                      >
                        Scam Categories:
                      </div>
                      {categoriesInPeriod.slice(0, 4).map(([cat, cnt]) => (
                        <div key={cat} style={{ color: 'var(--text-primary)' }}>
                          • {cat}: <strong>{cnt}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Stacked Bar */}
              <div
                style={{
                  width: '100%',
                  maxWidth: chartData.length > 20 ? 14 : 30,
                  display: 'flex',
                  flexDirection: 'column-reverse',
                  borderRadius: '3px 3px 0 0',
                  overflow: 'hidden',
                  background:
                    totalThreats === 0
                      ? 'color-mix(in srgb, var(--border-default) 40%, transparent)'
                      : 'transparent',
                  height:
                    totalThreats === 0
                      ? '4px'
                      : `${Math.max(smishingHeight + suspiciousHeight, 4)}px`,
                  transition: 'all 0.15s ease',
                }}
              >
                <div
                  style={{
                    height: `${smishingHeight}px`,
                    background: isHovered ? '#83343b' : '#9e444c',
                    transition: 'background-color 0.15s ease',
                  }}
                />
                <div
                  style={{
                    height: `${suspiciousHeight}px`,
                    background: isHovered ? '#885731' : '#a57147',
                    transition: 'background-color 0.15s ease',
                  }}
                />
              </div>

              {/* X-Axis Label */}
              <span
                style={{
                  position: 'absolute',
                  bottom: -24,
                  fontSize: chartData.length > 20 ? '0.65rem' : '0.75rem',
                  color: isHovered
                    ? 'var(--text-primary)'
                    : 'var(--text-secondary)',
                  fontWeight: isHovered ? 700 : 500,
                  whiteSpace: 'nowrap',
                  transform: chartData.length > 20 ? 'rotate(-30deg)' : 'none',
                }}
              >
                {/* For crowded 30d/90d views, show every other label or formatted */}
                {chartData.length > 20 && idx % 3 !== 0 && !isHovered
                  ? ''
                  : item.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Scam Category Breakdown Telemetry Strip */}
      {categories && categories.length > 0 && categoryTotals && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
            borderTop: '1px solid var(--border-subtle, #e5e7eb)',
            paddingTop: 10,
            marginTop: 8,
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
                      color: 'var(--text-primary, #111827)',
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
