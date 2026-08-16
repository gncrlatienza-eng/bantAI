import React, { useState } from 'react';

interface PointData {
  day: string;
  value: number;
  precision: number;
  recall: number;
  f1: number;
  note: string;
  isRetrain?: boolean;
}

export const LineAreaChart: React.FC = () => {
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);

  const points: PointData[] = [
    {
      day: 'Apr 14',
      value: 91.2,
      precision: 92.4,
      recall: 90.1,
      f1: 91.2,
      note: 'Baseline XLM-RoBERTa Checkpoint',
    },
    {
      day: 'Apr 19',
      value: 92.5,
      precision: 93.1,
      recall: 91.8,
      f1: 92.4,
      note: 'Ingested 14,000 Taglish Smishing Logs',
    },
    {
      day: 'Apr 24',
      value: 93.1,
      precision: 94.0,
      recall: 92.2,
      f1: 93.1,
      note: 'Fine-tuned Learning Rate & Weight Decay',
    },
    {
      day: 'Apr 29',
      value: 93.6,
      precision: 94.5,
      recall: 92.7,
      f1: 93.6,
      note: 'Regular Scheduled Daily Evaluation',
    },
    {
      day: 'May 04',
      value: 94.1,
      precision: 95.0,
      recall: 93.2,
      f1: 94.1,
      note: 'Pre-Retrain Performance Baseline',
    },
    {
      day: 'May 09',
      value: 95.4,
      precision: 96.2,
      recall: 94.6,
      f1: 95.4,
      note: '⚡ Retrain Event Deployed (+1.3% Accuracy Gain)',
      isRetrain: true,
    },
    {
      day: 'May 13',
      value: 95.8,
      precision: 96.7,
      recall: 94.9,
      f1: 95.8,
      note: 'Active Production Checkpoint v2.4',
    },
  ];

  // SVG dimensions
  const width = 640;
  const height = 210;
  const paddingX = 45;
  const minY = 90.0;
  const maxY = 97.0;

  // Calculate coordinates accurately
  const calculatedPoints = points.map((pt, idx) => {
    const cx = paddingX + (idx / (points.length - 1)) * (width - paddingX * 2);
    // Y mapped from minY (145px) to maxY (25px)
    const cy = 145 - ((pt.value - minY) / (maxY - minY)) * 120;
    return { ...pt, cx, cy };
  });

  // Construct smooth SVG path d attribute using bezier curves passing exactly through (cx, cy)
  const pathD = calculatedPoints.reduce((acc, pt, i, arr) => {
    if (i === 0) return `M ${pt.cx} ${pt.cy}`;
    const prev = arr[i - 1];
    const cp1x = prev.cx + (pt.cx - prev.cx) / 2;
    const cp1y = prev.cy;
    const cp2x = prev.cx + (pt.cx - prev.cx) / 2;
    const cp2y = pt.cy;
    return `${acc} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${pt.cx} ${pt.cy}`;
  }, '');

  // Closed path for gradient area fill
  const firstPt = calculatedPoints[0];
  const lastPt = calculatedPoints[calculatedPoints.length - 1];
  const areaD = `${pathD} L ${lastPt.cx} 160 L ${firstPt.cx} 160 Z`;

  const activePoint =
    activePointIndex !== null ? calculatedPoints[activePointIndex] : null;

  return (
    <div
      style={{
        width: '100%',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* SVG Container with embedded Date Labels for 100% Pixel-Perfect Alignment */}
      <div style={{ position: 'relative', width: '100%', overflow: 'visible' }}>
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ overflow: 'visible' }}
        >
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.45" />
              <stop offset="60%" stopColor="#2563eb" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0.0" />
            </linearGradient>

            <filter id="dotGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Horizontal Grid lines */}
          <line
            x1={paddingX - 10}
            y1="25"
            x2={width - paddingX + 10}
            y2="25"
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="4 4"
          />
          <line
            x1={paddingX - 10}
            y1="70"
            x2={width - paddingX + 10}
            y2="70"
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="4 4"
          />
          <line
            x1={paddingX - 10}
            y1="115"
            x2={width - paddingX + 10}
            y2="115"
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="4 4"
          />
          <line
            x1={paddingX - 10}
            y1="160"
            x2={width - paddingX + 10}
            y2="160"
            stroke="rgba(255,255,255,0.1)"
          />

          {/* Area Fill */}
          <path d={areaD} fill="url(#areaGrad)" />

          {/* Smooth Curve Line */}
          <path
            d={pathD}
            fill="none"
            stroke="#60a5fa"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Vertical Crosshair Guideline on Active Point Hover */}
          {activePoint && (
            <line
              x1={activePoint.cx}
              y1="20"
              x2={activePoint.cx}
              y2="180"
              stroke="#60a5fa"
              strokeDasharray="3 3"
              strokeWidth="1.5"
              style={{ transition: 'all 0.15s ease' }}
            />
          )}

          {/* Interactive Data Dots (Sitting directly above dates at exact cx) */}
          {calculatedPoints.map((pt, idx) => {
            const isHovered = activePointIndex === idx;

            return (
              <g
                key={pt.day}
                onMouseEnter={() => setActivePointIndex(idx)}
                onMouseLeave={() => setActivePointIndex(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Outer halo highlight */}
                <circle
                  cx={pt.cx}
                  cy={pt.cy}
                  r={isHovered ? 12 : 7}
                  fill={
                    isHovered
                      ? 'rgba(96, 165, 250, 0.35)'
                      : 'rgba(59, 130, 246, 0.15)'
                  }
                  style={{
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />

                {/* Main Dot */}
                <circle
                  cx={pt.cx}
                  cy={pt.cy}
                  r={isHovered ? 6 : 4.5}
                  fill={pt.isRetrain ? '#34d399' : '#ffffff'}
                  stroke={pt.isRetrain ? '#10b981' : '#2563eb'}
                  strokeWidth={isHovered ? 3 : 2}
                  filter={isHovered ? 'url(#dotGlow)' : undefined}
                  style={{
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />

                {/* Date Label rendered INSIDE SVG at exact cx for 100% alignment */}
                <text
                  x={pt.cx}
                  y="192"
                  textAnchor="middle"
                  fill={isHovered ? '#60a5fa' : '#94a3b8'}
                  fontSize="12"
                  fontWeight={isHovered ? '800' : '600'}
                  style={{ transition: 'fill 0.15s ease' }}
                >
                  {pt.day}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip Box when hovering over dots */}
        {activePoint && (
          <div
            style={{
              position: 'absolute',
              top: Math.max(10, activePoint.cy - 115),
              left:
                Math.min(Math.max(8, (activePoint.cx / width) * 100), 82) + '%',
              transform: 'translateX(-50%)',
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              border: '1px solid #3b82f6',
              boxShadow:
                '0 12px 30px rgba(0, 0, 0, 0.8), 0 0 15px rgba(59, 130, 246, 0.35)',
              borderRadius: 10,
              padding: '10px 14px',
              color: '#ffffff',
              zIndex: 50,
              pointerEvents: 'none',
              minWidth: 190,
              whiteSpace: 'nowrap',
              animation: 'fadeIn 0.15s ease',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                paddingBottom: 6,
                marginBottom: 8,
              }}
            >
              <strong style={{ fontSize: '0.8125rem', color: '#60a5fa' }}>
                {activePoint.day}
              </strong>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  color: '#34d399',
                }}
              >
                {activePoint.value}% Accuracy
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '4px 12px',
                fontSize: '0.75rem',
                marginBottom: 6,
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Precision:</span>{' '}
                <strong>{activePoint.precision}%</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Recall:</span>{' '}
                <strong>{activePoint.recall}%</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>F1-Score:</span>{' '}
                <strong>{activePoint.f1}%</strong>
              </div>
            </div>

            <div
              style={{
                fontSize: '0.6875rem',
                color: '#94a3b8',
                background: 'rgba(255, 255, 255, 0.04)',
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              {activePoint.note}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
