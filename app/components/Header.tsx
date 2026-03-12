'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { getMessages, detectLocaleFromPathname } from '@/lib/i18n/messages';
import NavLinks from './NavLinks';
import LanguageSwitcher from './LanguageSwitcher';
import InstallPwaButton from './InstallPwaButton';
import EnableNotificationsButton from './EnableNotificationsButton';

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <span className="block w-5 h-4 relative">
      <span
        className={`absolute left-0 block w-5 h-0.5 bg-current transition-all duration-200 ${
          open ? 'top-1.5 rotate-45' : 'top-0'
        }`}
      />
      <span
        className={`absolute left-0 top-1.5 block w-5 h-0.5 bg-current transition-all duration-200 ${
          open ? 'opacity-0' : 'opacity-100'
        }`}
      />
      <span
        className={`absolute left-0 block w-5 h-0.5 bg-current transition-all duration-200 ${
          open ? 'top-1.5 -rotate-45' : 'top-3'
        }`}
      />
    </span>
  );
}

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
  const secondaryLinks = [
    { href: '/email-digest', label: t.nav.emailDigest },
    { href: `${prefix}/support`, label: t.nav.support },
    { href: `${prefix}/feedback`, label: t.nav.feedback },
  ];

  return (
    <header
      className="sticky top-0 z-30 bg-[var(--color-bg)]/85 backdrop-blur border-b border-[var(--color-accent)]"
      style={{ boxShadow: '0 1px 10px 0 rgba(0,0,0,0.03)' }}
    >
      {/* Desktop: single row — Logo | Nav | spacer | PWA | Notifications | Globe */}
      <div className="hidden md:flex md:items-center md:justify-between md:px-4 md:py-0.5 lg:px-6 md:h-14">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity shrink-0">
          <Image src="/favicon.png" alt="Luxury Intelligence" width={36} height={36} className="flex-shrink-0" />
          <span className="font-sans font-semibold text-base lg:text-lg tracking-tight">Luxury Intelligence</span>
        </Link>
        <nav className="flex items-center min-w-0 mx-4 lg:mx-6">
          <ul className="flex items-center gap-1 lg:gap-2 text-sm font-medium font-sans flex-wrap">
            <NavLinks />
          </ul>
        </nav>
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <InstallPwaButton />
          <EnableNotificationsButton />
          <LanguageSwitcher />
        </div>
      </div>

      {/* Mobile: Logo | PWA | Notifications | Globe | Hamburger */}
      <div className="flex md:hidden items-center justify-between px-4 py-2 h-14">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0">
          <Image src="/favicon.png" alt="Luxury Intelligence" width={24} height={24} className="flex-shrink-0" />
          <span className="font-sans font-semibold text-sm tracking-tight">Luxury Intelligence</span>
        </Link>
        <div className="flex items-center gap-2">
          <InstallPwaButton />
          <EnableNotificationsButton />
          <LanguageSwitcher />
          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            className="p-2 rounded text-gray-700 hover:bg-gray-100 focus-visible:outline-none"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            <HamburgerIcon open={mobileMenuOpen} />
          </button>
        </div>
      </div>

      {/* Mobile drawer: primary + Subscribe CTA at top, secondary at bottom */}
      {mobileMenuOpen && (
        <div
            className="md:hidden border-t border-[var(--color-accent)] bg-[var(--color-surface)]"
          role="dialog"
          aria-label="Navigation menu"
        >
          <div className="px-4 py-4 space-y-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Menu</p>
              <ul className="space-y-0">
                {primaryLinks.map((link) => {
                  const isActive = pathname.replace(/\/$/, '') === link.href.replace(/\/$/, '');
                  return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block py-3 font-medium border-b border-gray-100 no-underline relative ${isActive ? 'text-[var(--color-accent)] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[var(--color-accent)]' : 'text-gray-900 hover:text-[var(--color-accent)]'}`}
                    >
                      {link.label}
                    </Link>
                  </li>
                  );
                })}
                <li className="pt-3">
                  <Link
                    href={`${prefix}/subscribe`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="inline-flex items-center justify-center bg-[var(--color-accent)] text-white px-5 py-2.5 rounded-[3px] font-medium w-full text-center transition-transform duration-200 hover:scale-105"
                  >
                    {t.nav.subscribeCta}
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">More</p>
              <ul className="space-y-0">
                {secondaryLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="link-underline block py-3 text-gray-600 hover:text-gray-900 border-b border-gray-100 last:border-b-0"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
