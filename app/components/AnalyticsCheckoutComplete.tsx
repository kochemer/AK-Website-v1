'use client';

import { useEffect, useRef } from 'react';
import { track } from '@/lib/analytics';
import { setUserPlan } from '@/lib/analytics/identity';

const PLAN_VALUE: Record<string, number> = {
  supporter_monthly: 1,
  patron_monthly: 3,
};

type Props = { plan: string | null };

export default function AnalyticsCheckoutComplete({ plan }: Props) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    track('checkout_complete', {
      plan: plan ?? 'unknown',
      value: plan ? (PLAN_VALUE[plan] ?? null) : null,
      currency: 'EUR',
    });
    if (plan) {
      setUserPlan(plan);
    }
  }, [plan]);

  return null;
}
