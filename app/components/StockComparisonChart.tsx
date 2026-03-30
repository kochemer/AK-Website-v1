'use client';

import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';

export type StockSeries = {
  ticker: string;
  label: string;
  currency: string;
  priceHistory: { date: string; close: number }[];
};

type Props = { series: StockSeries[] };

type Period = '1M' | '3M' | '6M' | '1Y';

const PERIOD_DAYS: Record<Period, number> = {
  '1M': 30,
  '3M': 90,
  '6M': 182,
  '1Y': 365,
};

const SERIES_COLORS: Record<string, string> = {
  'PNDORA.CO': '#8B6914',
  'SIG': '#2563eb',
  'CFR.SW': '#16a34a',
  'MC.PA': '#9333ea',
};

const DEFAULT_COLOR = '#6b7280';

// Format date for X axis tick
function formatXTick(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

// Custom tooltip
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const date = label ? new Date(label).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-sm px-3 py-2 shadow-sm text-[12px] font-sans">
      <p className="text-[var(--color-text-secondary)] mb-1.5">{date}</p>
      {payload.map(p => {
        const pct = (p.value - 100).toFixed(1);
        const isUp = p.value >= 100;
        return (
          <div key={p.name} className="flex items-center gap-2 mb-0.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
            <span className="text-[var(--color-text-primary)] font-medium">{p.name}</span>
            <span className={isUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
              {isUp ? '+' : ''}{pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function StockComparisonChart({ series }: Props) {
  const [period, setPeriod] = useState<Period>('1Y');
  const [activeSeries, setActiveSeries] = useState<Set<string>>(
    new Set(series.map(s => s.ticker))
  );

  const chartData = useMemo(() => {
    const cutoff = new Date(Date.now() - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000);

    // Filter each series to the period and normalise to 100
    const filtered = series.map(s => {
      const pts = s.priceHistory.filter(p => new Date(p.date) >= cutoff);
      const base = pts[0]?.close;
      if (!base || base === 0) return { ticker: s.ticker, points: [] as { date: string; value: number }[] };
      return {
        ticker: s.ticker,
        points: pts.map(p => ({ date: p.date, value: (p.close / base) * 100 })),
      };
    });

    // Collect all unique dates
    const allDates = Array.from(
      new Set(filtered.flatMap(s => s.points.map(p => p.date)))
    ).sort();

    // Build rows
    return allDates.map(date => {
      const row: Record<string, string | number> = { date };
      for (const s of filtered) {
        const pt = s.points.find(p => p.date === date);
        if (pt !== undefined) {
          row[s.ticker] = Math.round(pt.value * 100) / 100;
        }
      }
      return row;
    });
  }, [series, period]);

  const toggleSeries = (ticker: string) => {
    setActiveSeries(prev => {
      const next = new Set(prev);
      if (next.has(ticker)) {
        if (next.size > 1) next.delete(ticker); // keep at least one
      } else {
        next.add(ticker);
      }
      return next;
    });
  };

  if (series.length === 0) return null;

  return (
    <section className="mb-12">
      <p className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-secondary)] font-sans font-semibold mb-4">
        Financial Performance
      </p>

      {/* Period selector */}
      <div className="flex items-center gap-2 mb-3" role="group" aria-label="Select time period">
        {(['1M', '3M', '6M', '1Y'] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1 rounded-[3px] text-[12px] font-medium font-sans border transition-colors ${
              period === p
                ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                : 'bg-transparent text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]'
            }`}
          >
            {p}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-[var(--color-text-secondary)] font-sans">
          Indexed to 100 at period start
        </span>
      </div>

      {/* Company toggles */}
      <div className="flex flex-wrap gap-2 mb-4">
        {series.map(s => {
          const color = SERIES_COLORS[s.ticker] ?? DEFAULT_COLOR;
          const isActive = activeSeries.has(s.ticker);
          return (
            <button
              key={s.ticker}
              onClick={() => toggleSeries(s.ticker)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] text-[12px] font-sans border transition-colors ${
                isActive
                  ? 'border-transparent text-white'
                  : 'bg-transparent border-[var(--color-border)] text-[var(--color-text-secondary)]'
              }`}
              style={isActive ? { background: color, borderColor: color } : undefined}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="date"
              tickFormatter={formatXTick}
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)', fontFamily: 'sans-serif' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)', fontFamily: 'sans-serif' }}
              tickLine={false}
              axisLine={false}
              domain={['auto', 'auto']}
              tickFormatter={v => `${v}`}
              width={36}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ display: 'none' }} />
            {series
              .filter(s => activeSeries.has(s.ticker))
              .map(s => (
                <Line
                  key={s.ticker}
                  type="monotone"
                  dataKey={s.ticker}
                  name={s.label}
                  stroke={SERIES_COLORS[s.ticker] ?? DEFAULT_COLOR}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
