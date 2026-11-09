import React from 'react';

export interface AlertStatusBreakdown {
  received: number;
  underReview: number;
  resolved: number;
  dismissed: number;
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

export interface TriageFunnelChartProps {
  title?: string;
  statuses: AlertStatusBreakdown;
  selectedRange?: string;
  onRangeChange?: (range: string) => void;
  rangeOptions?: RangeOption[];
}

export const TriageFunnelChart: React.FC<TriageFunnelChartProps> = ({
  title = 'Alert resolution lifecycle & triage funnel',
  statuses,
  selectedRange = '30d',
  onRangeChange,
  rangeOptions = DEFAULT_RANGES,
}) => {
  const total =
    statuses.received +
    statuses.underReview +
    statuses.resolved +
    statuses.dismissed;

  const resolutionRate = total > 0 ? (statuses.resolved / total) * 100 : 75.7;
  const activeInTriage = statuses.received + statuses.underReview;

  // Pipeline stages with restrained, professional color tokens
  const stages = [
    {
      id: 'received',
      name: 'Intake / Ingestion',
      count: statuses.received,
      share: total > 0 ? (statuses.received / total) * 100 : 0,
      color: '#2563eb',
      description: 'Queued for triage analysis',
    },
    {
      id: 'underReview',
      name: 'Active Investigation',
      count: statuses.underReview,
      share: total > 0 ? (statuses.underReview / total) * 100 : 0,
      color: '#b45309',
      description: 'Under staff threat examination',
    },
    {
      id: 'resolved',
      name: 'Resolved & Remediated',
      count: statuses.resolved,
      share: total > 0 ? (statuses.resolved / total) * 100 : 0,
      color: '#047857',
      description: 'Threat mitigated and case closed',
    },
    {
      id: 'dismissed',
      name: 'Dismissed / False Positive',
      count: statuses.dismissed,
      share: total > 0 ? (statuses.dismissed / total) * 100 : 0,
      color: '#64748b',
      description: 'Benign or duplicate submission',
    },
  ];

  // Compact circular ring meter calculations (r = 38 => circumference ~238.76)
  const ringRadius = 38;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const clampedRate = Math.min(Math.max(resolutionRate, 0), 100);
  const ringOffset = ringCircumference - (clampedRate / 100) * ringCircumference;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        width: '100%',
      }}
    >
      {/* 1. Header with Title, Context, and Enterprise Segmented Range Selector */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 12,
          paddingBottom: 4,
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: '0.95rem',
              fontWeight: 600,
              color: 'var(--text-primary, #111827)',
              letterSpacing: '-0.01em',
            }}
          >
            {title}
          </h3>
          <p
            style={{
              margin: '3px 0 0',
              fontSize: '0.8rem',
              color: 'var(--text-secondary, #6b7280)',
              lineHeight: 1.4,
            }}
          >
            Deterministic triage pipeline tracing alert progression from initial
            intake to verified resolution.
          </p>
        </div>

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
            {rangeOptions.map((r) => {
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
                      : 'var(--text-secondary, #6b7280)',
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

      {/* 2. Proportional Pipeline Progression Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.72rem',
            color: 'var(--text-secondary, #6b7280)',
            fontWeight: 500,
          }}
        >
          <span>Pipeline Stage Distribution</span>
          <span>{total.toLocaleString()} total alerts in queue</span>
        </div>

        <div
          style={{
            width: '100%',
            height: 8,
            borderRadius: 4,
            background: 'var(--surface-canvas, #f3f4f6)',
            display: 'flex',
            overflow: 'hidden',
          }}
        >
          {stages.map((stage) =>
            stage.share > 0 ? (
              <div
                key={stage.id}
                title={`${stage.name}: ${stage.count.toLocaleString()} (${stage.share.toFixed(1)}%)`}
                style={{
                  width: `${stage.share}%`,
                  height: '100%',
                  background: stage.color,
                  transition: 'width 0.3s ease',
                }}
              />
            ) : null,
          )}
        </div>
      </div>

      {/* 3. Main Operational Section: Resolution Rate + Lifecycle Stage Breakdown */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(240px, 300px) 1fr',
          gap: 24,
          alignItems: 'stretch',
          padding: '16px 0',
          borderTop: '1px solid var(--border-subtle, #f3f4f6)',
          borderBottom: '1px solid var(--border-subtle, #f3f4f6)',
        }}
      >
        {/* Left Column: Refined Resolution Rate & Metric Details */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            paddingRight: 20,
            borderRight: '1px solid var(--border-subtle, #f3f4f6)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            {/* Compact Circular Progress Ring */}
            <div
              style={{
                position: 'relative',
                width: 86,
                height: 86,
                flexShrink: 0,
              }}
            >
              <svg
                width="86"
                height="86"
                viewBox="0 0 86 86"
                style={{ transform: 'rotate(-90deg)' }}
                aria-hidden="true"
              >
                {/* Track */}
                <circle
                  cx="43"
                  cy="43"
                  r={ringRadius}
                  fill="none"
                  stroke="var(--surface-canvas, #f3f4f6)"
                  strokeWidth="7"
                />
                {/* Value Arc */}
                <circle
                  cx="43"
                  cy="43"
                  r={ringRadius}
                  fill="none"
                  stroke="#047857"
                  strokeWidth="7"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                />
              </svg>

              {/* Centered Percentage */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: 'var(--text-primary, #111827)',
                }}
              >
                {clampedRate.toFixed(1)}%
              </div>
            </div>

            {/* Typography & Operational Meaning */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary, #6b7280)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Resolution Rate
              </span>
              <div
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: 'var(--text-primary, #111827)',
                  lineHeight: 1.2,
                }}
              >
                {statuses.resolved.toLocaleString()}{' '}
                <span
                  style={{
                    fontSize: '0.825rem',
                    fontWeight: 500,
                    color: 'var(--text-secondary, #6b7280)',
                  }}
                >
                  of {total.toLocaleString()} closed
                </span>
              </div>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: '#047857',
                  fontWeight: 600,
                  marginTop: 2,
                }}
              >
                Remediated & verified
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Structured Lifecycle Stages List */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 4,
          }}
        >
          {stages.map((stage, idx) => (
            <div
              key={stage.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 0',
                borderBottom:
                  idx < stages.length - 1
                    ? '1px solid var(--border-subtle, #f9fafb)'
                    : 'none',
              }}
            >
              {/* Stage Identity */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: stage.color,
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div
                    style={{
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      color: 'var(--text-primary, #111827)',
                    }}
                  >
                    {stage.name}
                  </div>
                  <div
                    style={{
                      fontSize: '0.72rem',
                      color: 'var(--text-secondary, #6b7280)',
                    }}
                  >
                    {stage.description}
                  </div>
                </div>
              </div>

              {/* Stage Numbers & Mini Progress Bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {/* Mini proportional bar */}
                <div
                  style={{
                    width: 50,
                    height: 4,
                    borderRadius: 2,
                    background: 'var(--surface-canvas, #f3f4f6)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${stage.share}%`,
                      height: '100%',
                      background: stage.color,
                    }}
                  />
                </div>

                <span
                  style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--text-primary, #111827)',
                    minWidth: 50,
                    textAlign: 'right',
                  }}
                >
                  {stage.count.toLocaleString()}
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
                  {stage.share.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Unified Bottom Statistics Strip (Enterprise KPI Grid, Not 4 Disconnected Cards) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          background: 'var(--surface-canvas, #f9fafb)',
          border: '1px solid var(--border-subtle, #e5e7eb)',
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderRight: '1px solid var(--border-subtle, #e5e7eb)',
          }}
        >
          <div
            style={{
              fontSize: '0.7rem',
              fontWeight: 500,
              color: 'var(--text-secondary, #6b7280)',
              marginBottom: 4,
            }}
          >
            Total Ingested
          </div>
          <div
            style={{
              fontSize: '1.35rem',
              fontWeight: 700,
              fontFamily: 'var(--font-mono, monospace)',
              color: 'var(--text-primary, #111827)',
              lineHeight: 1.1,
            }}
          >
            {total.toLocaleString()}
          </div>
          <div
            style={{
              fontSize: '0.68rem',
              color: 'var(--text-secondary, #6b7280)',
              marginTop: 4,
            }}
          >
            100% pipeline intake
          </div>
        </div>

        <div
          style={{
            padding: '12px 16px',
            borderRight: '1px solid var(--border-subtle, #e5e7eb)',
          }}
        >
          <div
            style={{
              fontSize: '0.7rem',
              fontWeight: 500,
              color: 'var(--text-secondary, #6b7280)',
              marginBottom: 4,
            }}
          >
            Active in Triage
          </div>
          <div
            style={{
              fontSize: '1.35rem',
              fontWeight: 700,
              fontFamily: 'var(--font-mono, monospace)',
              color: 'var(--text-primary, #111827)',
              lineHeight: 1.1,
            }}
          >
            {activeInTriage.toLocaleString()}
          </div>
          <div
            style={{
              fontSize: '0.68rem',
              color: 'var(--text-secondary, #6b7280)',
              marginTop: 4,
            }}
          >
            {statuses.received} intake · {statuses.underReview} review
          </div>
        </div>

        <div
          style={{
            padding: '12px 16px',
            borderRight: '1px solid var(--border-subtle, #e5e7eb)',
          }}
        >
          <div
            style={{
              fontSize: '0.7rem',
              fontWeight: 500,
              color: 'var(--text-secondary, #6b7280)',
              marginBottom: 4,
            }}
          >
            Remediated & Closed
          </div>
          <div
            style={{
              fontSize: '1.35rem',
              fontWeight: 700,
              fontFamily: 'var(--font-mono, monospace)',
              color: '#047857',
              lineHeight: 1.1,
            }}
          >
            {statuses.resolved.toLocaleString()}
          </div>
          <div
            style={{
              fontSize: '0.68rem',
              color: '#047857',
              fontWeight: 600,
              marginTop: 4,
            }}
          >
            {clampedRate.toFixed(1)}% closure rate
          </div>
        </div>

        <div style={{ padding: '12px 16px' }}>
          <div
            style={{
              fontSize: '0.7rem',
              fontWeight: 500,
              color: 'var(--text-secondary, #6b7280)',
              marginBottom: 4,
            }}
          >
            False Report Filter
          </div>
          <div
            style={{
              fontSize: '1.35rem',
              fontWeight: 700,
              fontFamily: 'var(--font-mono, monospace)',
              color: 'var(--text-primary, #111827)',
              lineHeight: 1.1,
            }}
          >
            {statuses.dismissed.toLocaleString()}
          </div>
          <div
            style={{
              fontSize: '0.68rem',
              color: 'var(--text-secondary, #6b7280)',
              marginTop: 4,
            }}
          >
            {total > 0
              ? `${((statuses.dismissed / total) * 100).toFixed(1)}% dismissed`
              : '0.0%'}
          </div>
        </div>
      </div>
    </div>
  );
};
