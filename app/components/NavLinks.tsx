'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getMessages, detectLocaleFromPathname } from '@/lib/i18n/messages';

/**
 * Locale-aware navigation links.
 * Detects locale from current pathname and displays labels in the correct language.
 * Links point to the locale-prefixed versions of each page when on /da or /es.
 */
export default function NavLinks() {
  const pathname = usePathname() || '/';
  const locale = detectLocaleFromPathname(pathname);
  const t = getMessages(locale);

  // Build locale prefix for links ('/da' or '/es' or '')
  const prefix = locale === 'en' ? '' : `/${locale}`;

  const links = [
    { href: `${prefix}/` || '/', label: t.nav.home },
    { href: `${prefix}/archive`, label: t.nav.archive },
    { href: '/email-digest', label: t.nav.emailDigest },
    { href: `${prefix}/subscribe`, label: t.nav.subscribe },
    { href: `${prefix}/methodology`, label: t.nav.methodology },
    { href: `${prefix}/about`, label: t.nav.about },
    { href: `${prefix}/support`, label: t.nav.support },
    { href: `${prefix}/feedback`, label: t.nav.feedback },
  ];

  return (
    <>
      {links.map((link) => (
        <li key={link.href} className="whitespace-nowrap">
          <Link
            href={link.href}
            className="text-gray-900 hover:text-gray-700 hover:underline focus-visible:underline transition-colors px-2 py-2 md:px-1.5 md:py-0.5 rounded flex items-center min-h-[44px] md:min-h-0"
          >
            {link.label}
          </Link>
        </li>
      ))}
      <li className="whitespace-nowrap">
        <Link
          href={`${prefix}/subscribe`}
          className="inline-flex items-center justify-center font-semibold text-[#06244c] bg-[#fed236] rounded-md px-2.5 py-2 md:px-3 md:py-1 text-[11px] md:text-xs transition-colors hover:bg-[#fdd01a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#06244c] focus-visible:ring-offset-1 min-h-[44px] md:min-h-0 shadow-sm"
          style={{
            boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
          }}
        >
          {t.nav.subscribeCta}
        </Link>
      </li>
    </>
  );
}

/**
 * Footer navigation links (locale-aware).
 */
export function FooterNavLinks() {
  const pathname = usePathname() || '/';
  const locale = detectLocaleFromPathname(pathname);
  const t = getMessages(locale);
  const prefix = locale === 'en' ? '' : `/${locale}`;

  const links = [
    { href: `${prefix}/` || '/', label: t.nav.home },
    { href: `${prefix}/archive`, label: t.nav.archive },
    { href: '/email-digest', label: t.nav.emailDigest },
    { href: `${prefix}/subscribe`, label: t.nav.subscribe },
    { href: `${prefix}/methodology`, label: t.nav.methodology },
    { href: `${prefix}/about`, label: t.nav.about },
    { href: `${prefix}/support`, label: t.nav.support },
    { href: `${prefix}/feedback`, label: t.nav.feedback },
  ];

  return (
    <>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="hover:underline whitespace-nowrap py-1 min-h-[44px] sm:min-h-0 flex items-center"
          style={{ minHeight: '44px' }}
        >
          {link.label}
        </Link>
      ))}
    </>
  );
}
