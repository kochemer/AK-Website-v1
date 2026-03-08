'use client';

import { useEffect, useRef } from 'react';
import { track } from '@/lib/analytics';

export default function AnalyticsSubscribeView() {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    track('subscribe_view');
  }, []);

  return null;
}
