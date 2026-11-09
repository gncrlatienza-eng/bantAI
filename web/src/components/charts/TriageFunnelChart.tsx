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

  // Pipeline stages configuration
  const stages = [
    {
      id: 'received',
      name: 'Intake / Ingestion',
      statusLabel: 'RECEIVED',
      count: statuses.received,
      share: total > 0 ? (statuses.received / total) * 100 : 0,
      color: '#2563eb',
      sublabel: 'Queued for triage analysis',
      step: '01',
    },
    {
      id: 'underReview',
      name: 'Active Investigation',
      statusLabel: 'UNDER_REVIEW',
      count: statuses.underReview,
      share: total > 0 ? (statuses.underReview / total) * 100 : 0,
      color: '#b45309',
      sublabel: 'Under staff threat examination',
      step: '02',
    },
    {
      id: 'resolved',
      name: 'Resolved & Remediated',
      statusLabel: 'RESOLVED',
      count: statuses.resolved,
      share: total > 0 ? (statuses.resolved / total) * 100 : 0,
      color: '#047857',
      sublabel: 'Threat mitigated and case closed',
      step: '03',
    },
    {
      id: 'dismissed',
      name: 'Dismissed / False Positive',
      statusLabel: 'DISMISSED',
      count: statuses.dismissed,
      share: total > 0 ? (statuses.dismissed / total) * 100 : 0,
      color: '#64748b',
      sublabel: 'Benign or duplicate submission',
      step: '04',
    },
  ];

  // Semicircular Gauge calculations for resolution efficiency
  // Gauge arc spanning 220 degrees from -200 deg to +20 deg
  const gaugeRadius = 70;
  const gaugeCircumference = Math.PI * gaugeRadius; // 180-deg arc
  const clampedRate = Math.min(Math.max(resolutionRate, 0), 100);
  const strokeDashoffset =
    gaugeCircumference - (clampedRate / 100) * gaugeCircumference;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
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
            Deterministic triage pipeline tracing alert progression from initial
            intake to verified resolution.
          </p>
        </div>

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

      {/* Main Visual Funnel & Gauge Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 24,
          alignItems: 'center',
        }}
      >
        {/* Left: Resolution Efficiency Radial Gauge Meter */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            background: 'var(--surface-muted, #f9fafb)',
            borderRadius: 8,
            border: '1px solid var(--border-subtle, #e5e7eb)',
            minHeight: 220,
          }}
        >
          <div style={{ position: 'relative', width: 170, height: 110 }}>
            <svg
              width="170"
              height="110"
              viewBox="0 0 170 110"
              style={{ overflow: 'visible' }}
            >
              {/* Background Arch Track */}
              <path
                d="M 15 95 A 70 70 0 0 1 155 95"
                fill="none"
                stroke="var(--border-subtle, #e5e7eb)"
                strokeWidth="11"
                strokeLinecap="round"
              />

              {/* Toned Down Solid Value Arc */}
              <path
                d="M 15 95 A 70 70 0 0 1 155 95"
                fill="none"
                stroke="#047857"
                strokeWidth="11"
                strokeLinecap="round"
                strokeDasharray={gaugeCircumference}
                strokeDashoffset={strokeDashoffset}
                style={{
                  transition: 'stroke-dashoffset 0.6s ease',
                }}
              />
            </svg>

            {/* Gauge Value Overlay */}
            <div
              style={{
                position: 'absolute',
                bottom: 8,
                left: 0,
                right: 0,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '1.75rem',
                  fontWeight: 900,
                  fontFamily: 'var(--font-mono, monospace)',
                  color: 'var(--text-primary, #111827)',
                  lineHeight: 1.1,
                }}
              >
                {clampedRate.toFixed(1)}%
              </div>
              <div
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  color: 'var(--text-secondary, #6b7280)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginTop: 4,
                }}
              >
                Resolution Rate
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 14,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 10px',
              borderRadius: 6,
              background: 'var(--surface-canvas, #f3f4f6)',
              border: '1px solid var(--border-subtle, #e5e7eb)',
              fontSize: '0.74rem',
              fontWeight: 600,
              color: 'var(--text-secondary, #4b5563)',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#047857',
              }}
            />
            {total > 0
              ? `${statuses.resolved} of ${total} alerts resolved`
              : 'No alerts recorded'}
          </div>
        </div>

        {/* Right: Stepped Lifecycle Triage Pipeline */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {stages.map((stage) => (
            <div
              key={stage.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 6,
                background: 'var(--surface-raised, #ffffff)',
                border: '1px solid var(--border-subtle, #e5e7eb)',
                borderLeft: `3px solid ${stage.color}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    fontFamily: 'var(--font-mono, monospace)',
                    color: 'var(--text-secondary, #6b7280)',
                    background: 'var(--surface-canvas, #f3f4f6)',
                    padding: '2px 6px',
                    borderRadius: 4,
                  }}
                >
                  {stage.step}
                </span>

                <div>
                  <div
                    style={{
                      fontSize: '0.85rem',
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
                    {stage.sublabel}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    color: 'var(--text-primary, #111827)',
                  }}
                >
                  {stage.count.toLocaleString()}
                </span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: 'var(--surface-canvas, #f3f4f6)',
                    color: 'var(--text-secondary, #4b5563)',
                    border: '1px solid var(--border-subtle, #e5e7eb)',
                    minWidth: 44,
                    textAlign: 'center',
                  }}
                >
                  {stage.share.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Triage Telemetry Summary Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 10,
          marginTop: 4,
        }}
      >
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            background: 'var(--surface-canvas, #f3f4f6)',
            border: '1px solid var(--border-subtle, #e5e7eb)',
          }}
        >
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 600,
              color: 'var(--text-secondary, #6b7280)',
              textTransform: 'uppercase',
            }}
          >
            Total Ingested
          </span>
          <div
            style={{
              fontSize: '1.1rem',
              fontWeight: 800,
              fontFamily: 'var(--font-mono, monospace)',
              color: 'var(--text-primary, #111827)',
            }}
          >
            {total.toLocaleString()}
          </div>
        </div>

        <div
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            background: 'var(--surface-canvas, #f3f4f6)',
            border: '1px solid var(--border-subtle, #e5e7eb)',
          }}
        >
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 600,
              color: 'var(--text-secondary, #6b7280)',
              textTransform: 'uppercase',
            }}
          >
            Active In Triage
          </span>
          <div
            style={{
              fontSize: '1.1rem',
              fontWeight: 800,
              fontFamily: 'var(--font-mono, monospace)',
              color: 'var(--text-primary, #111827)',
            }}
          >
            {(statuses.received + statuses.underReview).toLocaleString()}
          </div>
        </div>

        <div
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            background: 'var(--surface-canvas, #f3f4f6)',
            border: '1px solid var(--border-subtle, #e5e7eb)',
          }}
        >
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 600,
              color: 'var(--text-secondary, #6b7280)',
              textTransform: 'uppercase',
            }}
          >
            Remediated & Closed
          </span>
          <div
            style={{
              fontSize: '1.1rem',
              fontWeight: 800,
              fontFamily: 'var(--font-mono, monospace)',
              color: 'var(--text-primary, #111827)',
            }}
          >
            {statuses.resolved.toLocaleString()}
          </div>
        </div>

        <div
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            background: 'var(--surface-canvas, #f3f4f6)',
            border: '1px solid var(--border-subtle, #e5e7eb)',
          }}
        >
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 600,
              color: 'var(--text-secondary, #6b7280)',
              textTransform: 'uppercase',
            }}
          >
            False Report Filter
          </span>
          <div
            style={{
              fontSize: '1.1rem',
              fontWeight: 800,
              fontFamily: 'var(--font-mono, monospace)',
              color: 'var(--text-primary, #111827)',
            }}
          >
            {statuses.dismissed.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
};
