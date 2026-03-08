'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getMessages, detectLocaleFromPathname } from '@/lib/i18n/messages';

/** Primary nav only: Home, Archive, About, Methodology + Subscribe CTA (filled button). */
export default function NavLinks() {
  const pathname = usePathname() || '/';
  const locale = detectLocaleFromPathname(pathname);
  const t = getMessages(locale);
  const prefix = locale === 'en' ? '' : `/${locale}`;

  const primaryLinks = [
    { href: `${prefix}/` || '/', label: t.nav.home },
    { href: `${prefix}/archive`, label: t.nav.archive },
    { href: `${prefix}/about`, label: t.nav.about },
    { href: `${prefix}/methodology`, label: t.nav.methodology },
  ];

  return (
    <>
      {primaryLinks.map((link) => (
        <li key={link.href} className="whitespace-nowrap">
          <Link
            href={link.href}
            className="text-gray-900 hover:text-gray-700 hover:underline focus-visible:underline transition-colors px-2 py-2 md:px-1.5 md:py-0.5 rounded flex items-center min-h-[44px] md:min-h-0"
          >
            {link.label}
          </Link>
        </li>
      ))}
      <li className="whitespace-nowrap ml-4 md:ml-6 pl-4 md:pl-6 border-l border-[var(--color-accent)] flex items-center">
        <Link
          href={`${prefix}/subscribe`}
          className="inline-flex items-center justify-center bg-[var(--color-accent)] text-white px-5 py-2 rounded-sm font-medium transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1 min-h-[44px] md:min-h-0"
        >
          {t.nav.subscribeCta}
        </Link>
      </li>
    </>
  );
}

/**
 * Footer: primary (Home, Archive, About, Methodology) + secondary (Email Digest, Support, Feedback).
 */
export function FooterNavLinks() {
  const pathname = usePathname() || '/';
  const locale = detectLocaleFromPathname(pathname);
  const t = getMessages(locale);
  const prefix = locale === 'en' ? '' : `/${locale}`;

  const primary = [
    { href: `${prefix}/` || '/', label: t.nav.home },
    { href: `${prefix}/archive`, label: t.nav.archive },
    { href: `${prefix}/about`, label: t.nav.about },
    { href: `${prefix}/methodology`, label: t.nav.methodology },
  ];
  const secondary = [
    { href: '/email-digest', label: t.nav.emailDigest },
    { href: `${prefix}/support`, label: t.nav.support },
    { href: `${prefix}/feedback`, label: t.nav.feedback },
  ];

  return (
    <>
      {primary.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="hover:underline whitespace-nowrap py-1 min-h-[44px] sm:min-h-0 flex items-center"
        >
          {link.label}
        </Link>
      ))}
      {secondary.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="hover:underline whitespace-nowrap py-1 min-h-[44px] sm:min-h-0 flex items-center"
        >
          {link.label}
        </Link>
      ))}
    </>
  );
}
