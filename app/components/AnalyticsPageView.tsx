'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { track } from '@/lib/analytics';

export default function AnalyticsPageView() {
  const pathname = usePathname();
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (pathname === lastPathRef.current) return;
    lastPathRef.current = pathname;

    track('page_view', {
      page_title: document.title,
    });
  }, [pathname]);

  return null;
}
