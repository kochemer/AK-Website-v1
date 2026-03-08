'use client';

import { useEffect, useRef } from 'react';
import { track } from '@/lib/analytics';

type Props = { weekLabel: string };

export default function AnalyticsDigestView({ weekLabel }: Props) {
  const lastFiredRef = useRef<string | null>(null);

  useEffect(() => {
    if (weekLabel === lastFiredRef.current) return;
    lastFiredRef.current = weekLabel;
    track('digest_view', { week: weekLabel });
  }, [weekLabel]);

  return null;
}
