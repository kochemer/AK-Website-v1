import type { FinancialData } from '@/lib/utils/loadCompetitorIntel';

type Props = {
  financials: FinancialData | null;
  isPublic: boolean;
};

export default function FinancialPulse({ financials, isPublic }: Props) {
  if (!isPublic) {
    return (
      <div className="font-ibm-mono text-[10px] tracking-[0.15em] text-[var(--color-text-secondary)] px-2 py-0.5 border border-[var(--color-border)] rounded-sm inline-flex items-center gap-1">
        <span className="opacity-50">⬤</span> PRIVATE
      </div>
    );
  }

  if (!financials) {
    return (
      <div className="font-ibm-mono text-[10px] text-[var(--color-text-secondary)] tracking-[0.1em]">
        — DATA UNAVAILABLE
      </div>
    );
  }

  const isUp = financials.change1w >= 0;
  const changeAbs = Math.abs(financials.change1w).toFixed(2);

  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      {/* Price — mono, primary */}
      <span className="font-ibm-mono text-[13px] font-medium text-[var(--color-text-primary)] tracking-tight">
        {financials.currency}&thinsp;{financials.price.toLocaleString()}
      </span>

      {/* Directional badge */}
      <span
        className={`font-ibm-mono text-[10px] font-semibold px-2 py-0.5 rounded-sm inline-flex items-center gap-1 fin-land ${
          isUp
            ? 'bg-emerald-950/60 text-emerald-400 dark:bg-emerald-950/60 dark:text-emerald-400'
            : 'bg-red-950/60 text-red-400 dark:bg-red-950/60 dark:text-red-400'
        }`}
      >
        {isUp ? '▲' : '▼'} {changeAbs}%
        <span className="opacity-60 font-normal">1W</span>
      </span>

      {/* Ticker + parent — small, muted, mono */}
      <span className="font-ibm-mono text-[10px] text-[var(--color-text-secondary)] tracking-[0.08em] opacity-70">
        {financials.ticker} · {financials.parentName}
      </span>
    </div>
  );
}
