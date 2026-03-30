'use client';

import dynamic from 'next/dynamic';
import type { StockSeries } from './StockComparisonChart';

const StockComparisonChart = dynamic(
  () => import('./StockComparisonChart'),
  { ssr: false, loading: () => <div className="h-[280px]" /> }
);

export default function StockChartSection({ series }: { series: StockSeries[] }) {
  if (!series.length) return null;
  return <StockComparisonChart series={series} />;
}
