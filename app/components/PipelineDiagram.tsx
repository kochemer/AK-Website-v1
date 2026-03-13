'use client';

import { useEffect, useRef, useState } from 'react';

const CY = 58;  // circle centre y within SVG
const CR = 22;  // circle radius (smaller to fit 5 nodes)

// Evenly spaced across a 900-wide canvas with 90px margin each side
const NODES = [
  { x:  90, label: 'Discovery', sublabel: 'RSS & Tavily'    },
  { x: 270, label: 'Curation',  sublabel: 'Filter & dedup'  },
  { x: 450, label: 'Ranking',   sublabel: 'AI reranking'    },
  { x: 630, label: 'Summaries', sublabel: 'AI synthesis'    },
  { x: 810, label: 'Publishing', sublabel: 'Web · Email · Pod' },
] as const;

// ── Icons centred at (0,0) ──────────────────────────────────────────────────

function AntennaIcon() {
  return (
    <g stroke="var(--color-accent)" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M-7 0 Q0 -11 7 0"  strokeWidth="1.4" />
      <path d="M-4 2 Q0 -5  4 2"  strokeWidth="1.4" />
      <line x1="0" y1="2" x2="0" y2="8" strokeWidth="1.4" />
      <circle cx="0" cy="8" r="1.6" fill="var(--color-accent)" stroke="none" />
    </g>
  );
}

function FilterIcon() {
  return (
    <g stroke="var(--color-accent)" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M-8 -7 L8 -7 L3 0 L3 6 L-3 9 L-3 0 Z" strokeWidth="1.4" />
    </g>
  );
}

function GaugeIcon() {
  return (
    <g stroke="var(--color-accent)" fill="none" strokeLinecap="round">
      <path d="M-9 5 A10 10 0 0 1 9 5" strokeWidth="1.4" />
      <line x1="0" y1="5" x2="-6" y2="-3" strokeWidth="1.4" />
      <circle cx="0" cy="5" r="1.8" fill="var(--color-accent)" stroke="none" />
    </g>
  );
}

function SparkIcon() {
  return (
    <g fill="var(--color-accent)" stroke="none">
      <path d="M0 -8 L1.8 -2.5 L7.5 -0.8 L1.8 1.5 L3.2 7 L0 3.5 L-3.2 7 L-1.8 1.5 L-7.5 -0.8 L-1.8 -2.5 Z"
            opacity="0.9" />
    </g>
  );
}

function SendIcon() {
  return (
    <g stroke="var(--color-accent)" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M-8 -5 L9 0 L-8 5 L-5 0 Z" strokeWidth="1.4" />
      <line x1="-5" y1="0" x2="0" y2="0" strokeWidth="1.4" />
    </g>
  );
}

const ICONS = [
  <AntennaIcon key="a" />,
  <FilterIcon  key="f" />,
  <GaugeIcon   key="g" />,
  <SparkIcon   key="s" />,
  <SendIcon    key="e" />,
];

export default function PipelineDiagram() {
  const ref                            = useRef<HTMLDivElement>(null);
  const [animated,   setAnimated]   = useState(false);
  const [activeNode, setActiveNode] = useState(-1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setAnimated(true);
      setActiveNode(4);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setAnimated(true);
        setTimeout(() => setActiveNode(0),  100);
        setTimeout(() => setActiveNode(1),  500);
        setTimeout(() => setActiveNode(2),  900);
        setTimeout(() => setActiveNode(3), 1300);
        setTimeout(() => setActiveNode(4), 1700);
        observer.disconnect();
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Segment: right edge of node i → left edge of node i+1
  const segs = NODES.slice(0, -1).map((node, i) => ({
    x1: node.x + CR,
    x2: NODES[i + 1].x - CR,
    delay: i * 0.4,
  }));

  return (
    <div ref={ref} className="py-6 px-1 select-none overflow-x-auto">
      <svg
        viewBox="0 0 900 140"
        className="w-full min-w-[420px] max-w-3xl mx-auto overflow-visible"
        aria-hidden="true"
      >
        {/* ── Connecting dashed paths ── */}
        {segs.map((s, i) => (
          <g key={i}>
            <path
              d={`M ${s.x1} ${CY} L ${s.x2} ${CY}`}
              stroke="var(--color-accent)"
              strokeWidth="1"
              strokeDasharray="5 4"
              fill="none"
              style={{
                opacity: animated ? 0.6 : 0,
                strokeDashoffset: animated ? 0 : 150,
                transition: `opacity 0.5s ${s.delay}s ease-out, stroke-dashoffset 1.2s ${s.delay}s ease-out`,
              }}
            />
            {/* Arrowhead */}
            <path
              d={`M ${s.x2} ${CY} L ${s.x2 - 6} ${CY - 3.5} M ${s.x2} ${CY} L ${s.x2 - 6} ${CY + 3.5}`}
              stroke="var(--color-accent)"
              strokeWidth="1.1"
              strokeLinecap="round"
              fill="none"
              style={{
                opacity: animated ? 0.6 : 0,
                transition: `opacity 0.4s ${s.delay + 0.3}s ease-out`,
              }}
            />
          </g>
        ))}

        {/* ── Nodes ── */}
        {NODES.map((node, i) => {
          const isActive = activeNode >= i;
          return (
            <g key={node.label} transform={`translate(${node.x}, ${CY})`}>

              {/* Outer pulse ring */}
              <circle
                r="32"
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth="1"
                style={{
                  opacity: isActive ? 0.2 : 0,
                  transition: 'opacity 0.6s ease-out',
                }}
              />

              {/* Main circle */}
              <circle
                r={CR}
                fill="var(--color-accent-light)"
                stroke="var(--color-accent)"
                strokeWidth={isActive ? 1.8 : 1}
                style={{
                  opacity: animated ? 1 : 0,
                  transition: `opacity 0.5s ${i * 0.12}s ease-out, stroke-width 0.4s ease-out`,
                }}
              />

              {/* Icon */}
              <g style={{ opacity: isActive ? 1 : 0.3, transition: 'opacity 0.5s ease-out' }}>
                {ICONS[i]}
              </g>

              {/* Node label */}
              <text
                textAnchor="middle"
                y="40"
                style={{
                  fontFamily: 'var(--font-courier-prime, var(--font-mono, monospace))',
                  fontSize: '8.5px',
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase' as const,
                  fill: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  fontWeight: 600,
                  transition: 'fill 0.5s ease-out',
                }}
              >
                {node.label}
              </text>

              {/* Sublabel */}
              <text
                textAnchor="middle"
                y="53"
                style={{
                  fontFamily: 'var(--font-dm-sans, var(--font-sans, sans-serif))',
                  fontSize: '7.5px',
                  fill: 'var(--color-text-secondary)',
                  opacity: isActive ? 0.8 : 0.3,
                  transition: 'opacity 0.5s ease-out',
                }}
              >
                {node.sublabel}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
