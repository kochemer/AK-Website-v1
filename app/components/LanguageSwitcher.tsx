'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useEffect, useState } from 'react';

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

export default function LanguageSwitcher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isSpanish = pathname?.startsWith('/es');
  const isDanish = pathname?.startsWith('/da');

  const getEnglishPath = () => {
    if (!pathname) return '/';
    if (pathname.startsWith('/es') || pathname.startsWith('/da')) {
      const withoutLang = pathname.replace(/^\/(es|da)/, '') || '/';
      return withoutLang;
    }
    return pathname;
  };
  const getSpanishPath = () => {
    if (!pathname) return '/es';
    if (pathname.startsWith('/es')) return pathname;
    if (pathname.startsWith('/da')) return pathname.replace('/da', '/es');
    return pathname === '/' ? '/es' : `/es${pathname}`;
  };
  const getDanishPath = () => {
    if (!pathname) return '/da';
    if (pathname.startsWith('/da')) return pathname;
    if (pathname.startsWith('/es')) return pathname.replace('/es', '/da');
    return pathname === '/' ? '/da' : `/da${pathname}`;
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className="relative flex items-center" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="p-2 rounded text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 min-h-[36px] md:min-h-0 flex items-center justify-center"
        aria-label="Choose language"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <GlobeIcon className="w-5 h-5" />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 py-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-50"
          role="menu"
        >
          <Link
            href={getEnglishPath()}
            onClick={() => setOpen(false)}
            className={`block px-3 py-2 text-sm font-medium transition-colors ${
              !isSpanish && !isDanish ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-50'
            }`}
            role="menuitem"
          >
            English
          </Link>
          <Link
            href={getSpanishPath()}
            onClick={() => setOpen(false)}
            className={`block px-3 py-2 text-sm font-medium transition-colors ${
              isSpanish ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-50'
            }`}
            role="menuitem"
          >
            Español
          </Link>
          <Link
            href={getDanishPath()}
            onClick={() => setOpen(false)}
            className={`block px-3 py-2 text-sm font-medium transition-colors ${
              isDanish ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-50'
            }`}
            role="menuitem"
          >
            Dansk
          </Link>
        </div>
      )}
    </div>
  );
}
