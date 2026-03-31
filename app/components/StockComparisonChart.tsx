'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import {
  createChart,
  LineSeries,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type DeepPartial,
  type ChartOptions,
} from 'lightweight-charts';

export type StockSeries = {
  ticker: string;
  label: string;
  currency: string;
  priceHistory: { date: string; close: number }[];
};

type Props = { series: StockSeries[] };
type Period = '1M' | '3M' | '6M' | '1Y' | 'ALL';

const PERIOD_DAYS: Record<Period, number | null> = {
  '1M': 30,
  '3M': 90,
  '6M': 182,
  '1Y': 365,
  'ALL': null,
};

const SERIES_COLORS: Record<string, string> = {
  'PNDORA.CO': '#C9A84C',   // gold — Pandora (reference brand)
  'SIG':       '#5B8FE8',   // clear blue — Signet
  'CFR.SW':    '#4EC9A0',   // teal — Richemont (Cartier / Van Cleef)
  'MC.PA':     '#B07FE8',   // violet — LVMH (Tiffany / Bulgari)
};
const DEFAULT_COLOR = '#9E9484';

export default function StockComparisonChart({ series }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRefs   = useRef<Map<string, ISeriesApi<'Line', any>>>(new Map());

  const [period, setPeriod]             = useState<Period>('1Y');
  const [activeSeries, setActiveSeries] = useState<Set<string>>(
    new Set(series.map(s => s.ticker))
  );

  // Pre-sort each series once
  const lineDataMap = useMemo<Map<string, LineData[]>>(() => {
    const map = new Map<string, LineData[]>();
    for (const s of series) {
      const data: LineData[] = s.priceHistory
        .map(p => ({
          time: p.date.slice(0, 10) as LineData['time'],
          value: p.close,
        }))
        .sort((a, b) => (a.time as string).localeCompare(b.time as string));
      map.set(s.ticker, data);
    }
    return map;
  }, [series]);

  // Filter to selected period
  const filteredDataMap = useMemo<Map<string, LineData[]>>(() => {
    const days = PERIOD_DAYS[period];
    const cutoff = days
      ? new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
      : null;
    const map = new Map<string, LineData[]>();
    for (const [ticker, data] of lineDataMap) {
      map.set(ticker, cutoff ? data.filter(d => (d.time as string) >= cutoff) : data);
    }
    return map;
  }, [lineDataMap, period]);

  // ── Create chart once on mount ──
  useEffect(() => {
    if (!containerRef.current) return;

    const opts: DeepPartial<ChartOptions> = {
      layout: {
        background:  { type: ColorType.Solid, color: 'transparent' },
        textColor:   'rgba(158,148,132,0.85)',   // --text-secondary warm tone
        fontFamily:  "'IBM Plex Mono', 'Courier New', monospace",
        fontSize:    10,
      },
      grid: {
        vertLines: { color: 'rgba(201,168,76,0.06)' },   // faint gold verticals
        horzLines: { color: 'rgba(201,168,76,0.06)' },
      },
      rightPriceScale: {
        borderVisible: false,
      },
      timeScale: {
        borderVisible: false,
        fixLeftEdge:   true,
        fixRightEdge:  true,
        rightOffset:   2,
      },
      crosshair: {
        horzLine: { labelVisible: true },
        vertLine: { labelVisible: true },
      },
      handleScroll: true,
      handleScale:  true,
      width:  containerRef.current.clientWidth,
      height: 300,
    };

    const chart = createChart(containerRef.current, opts);
    chartRef.current = chart;

    // Add one line series per ticker
    for (const s of series) {
      const color = SERIES_COLORS[s.ticker] ?? DEFAULT_COLOR;
      const ls = chart.addSeries(LineSeries, {
        color,
        lineWidth:        2,
        priceLineVisible: false,
        lastValueVisible: true,
        title:            s.label,
      });
      seriesRefs.current.set(s.ticker, ls);
    }

    // Responsive resize
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w) chart.applyOptions({ width: w });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRefs.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync data when period or visibility changes ──
  useEffect(() => {
    for (const s of series) {
      const ls = seriesRefs.current.get(s.ticker);
      if (!ls) continue;
      const visible = activeSeries.has(s.ticker);
      ls.setData(visible ? (filteredDataMap.get(s.ticker) ?? []) : []);
    }
    chartRef.current?.timeScale().fitContent();
  }, [filteredDataMap, activeSeries, series]);

  const toggleSeries = (ticker: string) => {
    setActiveSeries(prev => {
      const next = new Set(prev);
      if (next.has(ticker)) {
        if (next.size > 1) next.delete(ticker);
      } else {
        next.add(ticker);
      }
      return next;
    });
  };

  if (!series.length) return null;

  return (
    <section className="mb-12">
      {/* Section header */}
      <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
        <p className="intel-section-label">Financial Performance</p>
        <span className="font-ibm-mono text-[10px] text-[var(--color-text-secondary)] tracking-[0.08em] opacity-60">
          USD · CONVERTED
        </span>
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        {/* Period selector */}
        <div className="flex items-center gap-1" role="group" aria-label="Select time period">
          {(['1M', '3M', '6M', '1Y', 'ALL'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`font-ibm-mono text-[10px] tracking-[0.08em] px-2.5 py-1 border transition-colors duration-150 ${
                period === p
                  ? 'border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent)]/8'
                  : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]/50 hover:text-[var(--color-accent)]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-[var(--color-border)]" aria-hidden />

        {/* Company toggles */}
        <div className="flex flex-wrap gap-1.5">
          {series.map(s => {
            const color    = SERIES_COLORS[s.ticker] ?? DEFAULT_COLOR;
            const isActive = activeSeries.has(s.ticker);
            return (
              <button
                key={s.ticker}
                onClick={() => toggleSeries(s.ticker)}
                className="font-ibm-mono text-[10px] tracking-[0.05em] px-2.5 py-1 border transition-all duration-150 flex items-center gap-1.5"
                style={{
                  borderColor: isActive ? color : 'var(--color-border)',
                  color: isActive ? color : 'var(--color-text-secondary)',
                  background: isActive ? `${color}12` : 'transparent',
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: isActive ? color : 'var(--color-border)' }}
                  aria-hidden
                />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart — LWC renders into this div */}
      <div ref={containerRef} style={{ width: '100%', height: 300 }} />
    </section>
  );
}
