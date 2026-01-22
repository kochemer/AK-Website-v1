'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const VALID_N_VALUES = [3, 4, 5, 6, 7] as const;
const DEFAULT_N = 7;

type TopNValue = typeof VALID_N_VALUES[number];

function isValidN(value: number | null | undefined): value is TopNValue {
  return value !== null && value !== undefined && VALID_N_VALUES.includes(value as TopNValue);
}

function getNFromStorage(): TopNValue | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('topN');
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (isValidN(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    // localStorage might not be available
  }
  return null;
}

export default function TopNSelector() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Initialize with URL param or default (server-safe)
  // Don't access localStorage during initial render to avoid hydration mismatch
  const getInitialN = (): TopNValue => {
    const urlN = searchParams.get('n');
    if (urlN) {
      const parsed = parseInt(urlN, 10);
      if (isValidN(parsed)) {
        return parsed;
      }
    }
    // Always return default on server - localStorage will be checked in useEffect
    return DEFAULT_N;
  };
  
  const [currentN, setCurrentN] = useState<TopNValue>(getInitialN);

  // After hydration, sync with localStorage and URL params
  useEffect(() => {
    
    const urlN = searchParams.get('n');
    if (urlN) {
      const parsed = parseInt(urlN, 10);
      if (isValidN(parsed) && parsed !== currentN) {
        setCurrentN(parsed);
        try {
          localStorage.setItem('topN', parsed.toString());
        } catch (e) {
          // Ignore localStorage errors
        }
      }
    } else {
      // No URL param - check localStorage (client-side only)
      const storedN = getNFromStorage();
      if (storedN && storedN !== currentN) {
        setCurrentN(storedN);
      } else if (!storedN && currentN !== DEFAULT_N) {
        setCurrentN(DEFAULT_N);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleChange = (newN: TopNValue) => {
    setCurrentN(newN);
    
    // Update localStorage
    try {
      localStorage.setItem('topN', newN.toString());
    } catch (e) {
      // Ignore localStorage errors
    }
    
    // Update URL query param
    const params = new URLSearchParams(searchParams.toString());
    if (newN === DEFAULT_N) {
      // Remove param if default
      params.delete('n');
    } else {
      params.set('n', newN.toString());
    }
    
    const newUrl = params.toString() 
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    
    router.push(newUrl, { scroll: false });
  };

  return (
    <div className="flex items-center gap-1 sm:gap-1.5">
      <span className="text-xs sm:text-xs text-black/45">Show:</span>
      {VALID_N_VALUES.map((n) => (
        <button
          key={n}
          onClick={() => handleChange(n)}
          className={`px-2 sm:px-2 py-1.5 sm:py-1 text-xs sm:text-xs text-black/45 rounded transition-colors cursor-pointer min-w-[36px] sm:min-w-[28px] min-h-[36px] sm:min-h-0 flex items-center justify-center ${
            currentN === n
              ? 'bg-black/[0.04] font-medium text-black/60'
              : 'bg-transparent hover:bg-black/[0.02] hover:text-black/50'
          }`}
          style={{ minHeight: '36px', minWidth: '36px' }}
          aria-label={`Show ${n} articles per category`}
          aria-pressed={currentN === n}
        >
          {n}
        </button>
      ))}
      <span className="text-xs sm:text-xs text-black/45 hidden sm:inline">per category</span>
    </div>
  );
}
