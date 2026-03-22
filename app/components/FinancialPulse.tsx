import type { FinancialData } from '@/lib/utils/loadCompetitorIntel';
import Sparkline from './Sparkline';

type Props = {
  financials: FinancialData | null;
  isPublic: boolean;
};

export default function FinancialPulse({ financials, isPublic }: Props) {
  if (!isPublic) {
    return (
      <div className="text-[11px] text-[var(--color-text-secondary)] font-sans px-2 py-1 border border-[var(--color-border)] rounded inline-block">
        Private
      </div>
    );
  }

  if (!financials) {
    return (
      <div className="text-[11px] text-[var(--color-text-secondary)] font-sans">
        Data unavailable
      </div>
    );
  }

  const isUp = financials.change1w >= 0;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[13px] font-sans font-semibold text-[var(--color-text-primary)]">
        {financials.currency} {financials.price.toLocaleString()}
      </span>
      <span
        className={`text-[11px] font-sans font-medium px-1.5 py-0.5 rounded ${
          isUp
            ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
            : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
        }`}
      >
        {isUp ? '▲' : '▼'} {Math.abs(financials.change1w).toFixed(2)}% 1w
      </span>
      <span className="text-[11px] text-[var(--color-text-secondary)] font-sans">
        {financials.ticker} · {financials.parentName}
      </span>
      {financials.priceHistory && financials.priceHistory.length >= 3 && (
        <span className="ml-auto">
          <Sparkline
            data={financials.priceHistory.map(p => p.close)}
            positive={isUp}
          />
        </span>
      )}
    </div>
  );
}
