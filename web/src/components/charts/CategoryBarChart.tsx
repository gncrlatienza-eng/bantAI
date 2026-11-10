import React from 'react';

export interface CategoryBarItem {
  label: string;
  count: number;
  share: number; // 0 to 1
  color?: string;
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
];

export interface CategoryBarChartProps {
  title?: string;
  total: number;
  totalLabel?: string;
  items: CategoryBarItem[];
  emptyMessage?: string;
  selectedRange?: string;
  onRangeChange?: (range: string) => void;
  rangeOptions?: RangeOption[];
}

export const CategoryBarChart: React.FC<CategoryBarChartProps> = ({
  title = 'Threats by scam category',
  total,
  totalLabel = 'Threats',
  items,
  emptyMessage = 'No threat category data for this period',
  selectedRange = '30d',
  onRangeChange,
  rangeOptions = DEFAULT_RANGES,
}) => {
  // Sort items descending by count
  const sorted = [...items].sort((a, b) => b.count - a.count);
  const maxCount = sorted.length > 0 ? Math.max(...sorted.map((i) => i.count), 1) : 1;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        width: '100%',
      }}
    >
      {/* Header with Title and Range Filter */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: '0.95rem',
              fontWeight: 600,
              color: 'var(--text-primary, #211f24)',
            }}
          >
            {title}
          </h3>
          <span
            style={{
              fontSize: '0.78rem',
              color: 'var(--text-secondary, #6d6870)',
              marginTop: 2,
              display: 'block',
            }}
          >
            {total.toLocaleString()} total categorized {totalLabel.toLowerCase()}
          </span>
        </div>

        {onRangeChange && (
          <div
            style={{
              display: 'inline-flex',
              background: 'var(--surface-canvas, #f2efe8)',
              border: '1px solid var(--border-default)',
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

      {total === 0 || sorted.length === 0 ? (
        <div
          style={{
            padding: 32,
            textAlign: 'center',
            color: 'var(--text-secondary, #6d6870)',
            fontSize: '0.875rem',
          }}
        >
          {emptyMessage}
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            marginTop: 4,
          }}
        >
          {sorted.map((item, idx) => {
            const barPct = Math.max(2, Math.round((item.count / maxCount) * 100));
            const sharePct = (item.share * 100).toFixed(1);

            return (
              <div
                key={item.label}
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
                    fontSize: '0.825rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary, #6d6870)',
                        fontFamily: 'var(--font-mono, monospace)',
                        minWidth: 16,
                      }}
                    >
                      {idx + 1}.
                    </span>
                    <span
                      style={{
                        fontWeight: 600,
                        color: 'var(--text-primary, #211f24)',
                      }}
                    >
                      {item.label}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono, monospace)',
                        fontWeight: 600,
                        color: 'var(--text-primary, #211f24)',
                        fontSize: '0.85rem',
                      }}
                    >
                      {item.count.toLocaleString()}
                    </span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary, #6d6870)',
                        minWidth: 42,
                        textAlign: 'right',
                        fontFamily: 'var(--font-mono, monospace)',
                      }}
                    >
                      {sharePct}%
                    </span>
                  </div>
                </div>

                {/* Horizontal Progress Bar Track */}
                <div
                  style={{
                    width: '100%',
                    height: 6,
                    borderRadius: 3,
                    background: 'var(--surface-canvas, #f2efe8)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${barPct}%`,
                      height: '100%',
                      borderRadius: 3,
                      background: item.color || 'var(--palette-ash-violet, #6d6870)',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

